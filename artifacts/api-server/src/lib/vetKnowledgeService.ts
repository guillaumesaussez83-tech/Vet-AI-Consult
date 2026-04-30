/**
 * vetKnowledgeService.ts — RAG vétérinaire (ANMV / EMA / RESAPATH)
 *
 * Gère :
 *  - La création automatique de l'extension pgvector + table + index HNSW au démarrage
 *  - L'ingestion des entrées de connaissances avec déduplication SHA-256
 *  - La recherche vectorielle par similarité cosinus
 *  - Le formatage du contexte RAG pour injection dans les prompts Claude
 *
 * Dégradation gracieuse : si OPENAI_API_KEY est absent, toutes les
 * fonctions retournent silencieusement des résultats vides sans crasher.
 */

import crypto from "crypto";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { VET_KNOWLEDGE_DATA } from "./vetKnowledgeData";
import type { KnowledgeEntry } from "./vetKnowledgeData";

// ─── Client OpenAI (lazy, guarded) ───────────────────────────────────────────

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!process.env["OPENAI_API_KEY"]) return null;
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });
  }
  return _openai;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const RAG_SIMILARITY_THRESHOLD = 0.35; // seuil similarité cosinus (1 - distance)
const RAG_TOP_K = 4;

// ─── Setup pgvector au démarrage ─────────────────────────────────────────────

export async function setupVetKnowledge(): Promise<void> {
  const openai = getOpenAI();
  if (!openai) {
    logger.warn(
      "OPENAI_API_KEY absent — base de connaissances vétérinaires désactivée (dégradation gracieuse)"
    );
    return;
  }

  try {
    // 1. Extension pgvector
    await db.execute(sql.raw(`CREATE EXTENSION IF NOT EXISTS vector`));

    // 2. Table principale
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS vet_knowledge_entries (
        id          SERIAL PRIMARY KEY,
        source      TEXT NOT NULL,
        categorie   TEXT NOT NULL,
        titre       TEXT NOT NULL,
        contenu     TEXT NOT NULL,
        metadata    JSONB,
        content_sha TEXT NOT NULL UNIQUE,
        embedding   vector(${EMBEDDING_DIMS}),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `));

    // 3. Index HNSW pour la recherche par similarité cosinus (pgvector ≥ 0.5)
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS idx_vet_knowledge_embedding
        ON vet_knowledge_entries
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    `));

    // 4. Index de filtrage source/catégorie
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS idx_vet_knowledge_source
        ON vet_knowledge_entries (source, categorie)
    `));

    logger.info("pgvector + table vet_knowledge_entries initialisés");

    // 5. Ingestion des données (idempotente par SHA-256)
    const inserted = await ingestKnowledgeData(openai);
    if (inserted > 0) {
      logger.info({ inserted }, "Base de connaissances vétérinaires : nouvelles entrées vectorisées");
    } else {
      logger.info("Base de connaissances vétérinaires : déjà à jour");
    }
  } catch (err) {
    logger.error({ err }, "Erreur lors de l'initialisation RAG — service désactivé (non bloquant)");
  }
}

// ─── Ingestion avec déduplication SHA-256 ────────────────────────────────────

async function ingestKnowledgeData(openai: OpenAI): Promise<number> {
  let inserted = 0;

  for (const entry of VET_KNOWLEDGE_DATA) {
    try {
      const contentSha = sha256(`${entry.titre}\n${entry.contenu}`);

      // Vérifier si l'entrée est déjà présente (dédup idempotent)
      const existing = await db.execute(
        sql`SELECT id FROM vet_knowledge_entries WHERE content_sha = ${contentSha} LIMIT 1`
      );
      if ((existing as any).rows?.length > 0 || (existing as any).length > 0) continue;

      // Vectoriser titre + contenu pour maximiser la pertinence de la recherche
      const textToEmbed = `${entry.titre}\n${entry.contenu}`;
      const embeddingResp = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: textToEmbed,
        dimensions: EMBEDDING_DIMS,
      });
      const vector = embeddingResp.data[0]?.embedding;
      if (!vector) continue;

      const vectorLiteral = `[${vector.join(",")}]`;

      await db.execute(sql`
        INSERT INTO vet_knowledge_entries
          (source, categorie, titre, contenu, metadata, content_sha, embedding)
        VALUES (
          ${entry.source},
          ${entry.categorie},
          ${entry.titre},
          ${entry.contenu},
          ${JSON.stringify(entry.metadata ?? {})}::jsonb,
          ${contentSha},
          ${vectorLiteral}::vector
        )
        ON CONFLICT (content_sha) DO NOTHING
      `);
      inserted++;
    } catch (entryErr) {
      logger.warn({ err: entryErr, titre: entry.titre }, "Entrée RAG ignorée suite à erreur");
    }
  }

  return inserted;
}

// ─── Recherche vectorielle ────────────────────────────────────────────────────

export interface VetKnowledgeResult {
  id: number;
  source: string;
  categorie: string;
  titre: string;
  contenu: string;
  similarity: number;
}

/**
 * Recherche les entrées les plus pertinentes par similarité cosinus.
 * Retourne un tableau vide si OpenAI n'est pas configuré ou en cas d'erreur.
 */
export async function searchVetKnowledge(
  query: string,
  options?: { topK?: number; categorie?: string }
): Promise<VetKnowledgeResult[]> {
  const openai = getOpenAI();
  if (!openai) return [];

  try {
    const embeddingResp = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
      dimensions: EMBEDDING_DIMS,
    });
    const vector = embeddingResp.data[0]?.embedding;
    if (!vector) return [];

    const vectorLiteral = `[${vector.join(",")}]`;
    const topK = options?.topK ?? RAG_TOP_K;

    // Requête avec filtrage optionnel par catégorie
    let queryResult;
    if (options?.categorie) {
      queryResult = await db.execute(sql`
        SELECT
          id,
          source,
          categorie,
          titre,
          contenu,
          (1 - (embedding <=> ${vectorLiteral}::vector)) AS similarity
        FROM vet_knowledge_entries
        WHERE embedding IS NOT NULL
          AND categorie = ${options.categorie}
          AND (1 - (embedding <=> ${vectorLiteral}::vector)) >= ${RAG_SIMILARITY_THRESHOLD}
        ORDER BY embedding <=> ${vectorLiteral}::vector
        LIMIT ${topK}
      `);
    } else {
      queryResult = await db.execute(sql`
        SELECT
          id,
          source,
          categorie,
          titre,
          contenu,
          (1 - (embedding <=> ${vectorLiteral}::vector)) AS similarity
        FROM vet_knowledge_entries
        WHERE embedding IS NOT NULL
          AND (1 - (embedding <=> ${vectorLiteral}::vector)) >= ${RAG_SIMILARITY_THRESHOLD}
        ORDER BY embedding <=> ${vectorLiteral}::vector
        LIMIT ${topK}
      `);
    }

    // Drizzle avec pg.Pool retourne { rows: [...] }
    const rows = (queryResult as any).rows ?? queryResult;
    return Array.isArray(rows) ? (rows as VetKnowledgeResult[]) : [];
  } catch (err) {
    logger.warn({ err }, "searchVetKnowledge — erreur, retour vide (dégradation gracieuse)");
    return [];
  }
}

// ─── Formatage du contexte RAG pour injection dans les prompts ────────────────

/**
 * Formate les résultats RAG en bloc de texte structuré pour injection
 * dans un prompt Claude. Retourne une chaîne vide si aucun résultat.
 */
export function formatRagContext(results: VetKnowledgeResult[]): string {
  if (results.length === 0) return "";

  const sections = results.map((r, i) => {
    const sourceLabel = r.source === "RESAPATH"
      ? "RESAPATH — Surveillance antibiorésistance"
      : r.source === "EMA"
      ? "EMA — Agence européenne du médicament (vétérinaire)"
      : "ANMV — Agence nationale du médicament vétérinaire";

    return `[RÉFÉRENCE ${i + 1} — ${sourceLabel}]\nCatégorie : ${r.categorie}\n${r.titre}\n\n${r.contenu}`;
  });

  return `

--- DONNÉES VÉTÉRINAIRES OFFICIELLES (ANMV / EMA / RESAPATH) ---
Les informations suivantes proviennent de sources officielles françaises et européennes.
Tu DOIS les utiliser pour guider et affiner tes recommandations, posologies et choix thérapeutiques.

${sections.join("\n\n---\n\n")}
--- FIN DES DONNÉES OFFICIELLES ---
`;
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}
