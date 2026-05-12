import { Router } from "express";
import { db } from "@workspace/db";
import {
  ordonnancesTable,
  consultationsTable,
  patientsTable,
  ownersTable,
  actesConsultationsTable,
  actesTable,
  parametresCliniqueTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { AI_MODEL, AI_MAX_TOKENS } from "../../lib/constants";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { decrementerConsultationFEFO } from "../stock/ia-engine";
import { checkContraindications } from "../../services/contraindications";
import { validate } from "../../middlewares/validate";
import { z } from "zod";
import { CreateOrdonnanceSchema } from "../../schemas";

const router = Router();

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
// HELPER : dÃÂÃÂ©crÃÂÃÂ©menter le stock depuis le texte d'une ordonnance
// Fire-and-forget ÃÂ¢ÃÂÃÂ ne bloque jamais la rÃÂÃÂ©ponse HTTP.
// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
async function decrementeStockDepuisOrdonnance(
  clinicId: string,
  consultationId: number,
  contenu: string,
  logFn: (msg: string, data?: unknown) => void,
): Promise<void> {
  try {
    const parsePrompt = `Analyse cette ordonnance vÃÂÃÂ©tÃÂÃÂ©rinaire et extrais UNIQUEMENT la liste des mÃÂÃÂ©dicaments/produits avec leurs quantitÃÂÃÂ©s.

ORDONNANCE :
${contenu}

RÃÂÃÂ©ponds UNIQUEMENT en JSON valide, sans texte autour, format exact :
[ { "nom": "Meloxicam", "quantite": 14 }, { "nom": "Amoxicilline 500mg", "quantite": 30 } ]

RÃÂÃÂ¨gles :
- "nom" = DCI ou nom commercial exact du mÃÂÃÂ©dicament
- "quantite" = nombre d'unitÃÂÃÂ©s ÃÂÃÂ  dÃÂÃÂ©livrer
- Si quantitÃÂÃÂ© non prÃÂÃÂ©cisÃÂÃÂ©e, mettre 1
- Ignorer les vitamines, supplÃÂÃÂ©ments, conseils de soins
- Si aucun mÃÂÃÂ©dicament trouvÃÂÃÂ©, retourner []`;

    const aiResp = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: parsePrompt }],
    });

    const raw =
      aiResp.content[0].type === "text" ? aiResp.content[0].text.trim() : "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const parsed: Array<{ nom: string; quantite: number }> = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : [];

    if (parsed.length === 0) return;

    const resultats = await decrementerConsultationFEFO(clinicId, consultationId, parsed);
    const decremented = resultats.filter((r) => !r.notFound).length;
    logFn(`Stock dÃÂÃÂ©crÃÂÃÂ©mentÃÂÃÂ© depuis ordonnance: ${decremented}/${parsed.length} produits (FEFO)`);
  } catch (err) {
    // Non-bloquant ÃÂ¢ÃÂÃÂ on log uniquement
    logFn("DÃÂÃÂ©crÃÂÃÂ©mentation stock depuis ordonnance ignorÃÂÃÂ©e (non bloquante): " + String(err));
  }
}

router.get("/", async (req, res) => {
  try {
    const consultationId = req.query.consultationId
      ? Number(req.query.consultationId)
      : null;
    const patientId = req.query.patientId
      ? Number(req.query.patientId)
      : null;
    const cidEq = eq(ordonnancesTable.clinicId, req.clinicId);
    let rows;
    if (consultationId) {
      rows = await db
        .select()
        .from(ordonnancesTable)
        .where(and(cidEq, eq(ordonnancesTable.consultationId, consultationId)))
        .orderBy(desc(ordonnancesTable.createdAt));
    } else if (patientId) {
      rows = await db
        .select()
        .from(ordonnancesTable)
        .where(and(cidEq, eq(ordonnancesTable.patientId, patientId)))
        .orderBy(desc(ordonnancesTable.createdAt));
    } else {
      rows = await db
        .select()
        .from(ordonnancesTable)
        .where(cidEq)
        .orderBy(desc(ordonnancesTable.createdAt))
        .limit(50);
    }
    return res.json(
      rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    );
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID invalide" });
    const [row] = await db
      .select()
      .from(ordonnancesTable)
      .where(
        and(
          eq(ordonnancesTable.clinicId, req.clinicId),
          eq(ordonnancesTable.id, id),
        ),
      );
    if (!row) return res.status(404).json({ error: "Ordonnance non trouvÃÂÃÂ©e" });
    return res.json({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.post("/", validate(CreateOrdonnanceSchema), async (req, res) => {
  try {
    const {
      consultationId,
      patientId,
      veterinaire,
      contenu,
      genereIA,
      instructionsClient,
      numeroAmm,
    } = req.body;
    if (!consultationId || !contenu) {
      return res
        .status(400)
        .json({ error: "consultationId et contenu requis" });
    }
    // Anti-IDOR cross-tenant
    const [conExists] = await db
      .select({ id: consultationsTable.id })
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.clinicId, req.clinicId),
          eq(consultationsTable.id, Number(consultationId)),
        ),
      );
    if (!conExists)
      return res.status(400).json({ error: "Consultation introuvable" });

    const year = new Date().getFullYear();
    const [lastOrd] = await db
      .select({ num: ordonnancesTable.numeroOrdonnance })
      .from(ordonnancesTable)
      .where(
        and(
          eq(ordonnancesTable.clinicId, req.clinicId),
          sql`numero_ordonnance LIKE ${`ORD-${year}-%`}`,
        ),
      )
      .orderBy(desc(ordonnancesTable.id))
      .limit(1);
    const lastSeq = lastOrd?.num
      ? parseInt(lastOrd.num.split("-")[2] ?? "0")
      : 0;
    const numeroOrdonnance = `ORD-${year}-${String(lastSeq + 1).padStart(5, "0")}`;

    const [row] = await db
      .insert(ordonnancesTable)
      .values({
        consultationId: Number(consultationId),
        patientId: patientId ? Number(patientId) : null,
        veterinaire: veterinaire ?? null,
        contenu,
        numeroOrdonnance,
        genereIA: genereIA ?? false,
        instructionsClient: instructionsClient ?? null,
        numeroAmm: numeroAmm ?? null,
        clinicId: req.clinicId,
      })
      .returning();

    // DÃÂÃÂ©crÃÂÃÂ©menter le stock automatiquement (FEFO) ÃÂ¢ÃÂÃÂ fire and forget
    setImmediate(() =>
      void decrementeStockDepuisOrdonnance(
        req.clinicId,
        Number(consultationId),
        contenu,
        (msg) => req.log.info({ ordonnanceId: row.id }, msg),
      ),
    );

    return res.status(201).json({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID invalide" });
    const { contenu, instructionsClient, veterinaire, numeroAmm } = req.body;
    const updateData: Record<string, unknown> = {};
    if (contenu !== undefined) updateData.contenu = contenu;
    if (instructionsClient !== undefined)
      updateData.instructionsClient = instructionsClient;
    if (veterinaire !== undefined) updateData.veterinaire = veterinaire;
    if (numeroAmm !== undefined) updateData.numeroAmm = numeroAmm;
    const [row] = await db
      .update(ordonnancesTable)
      .set(updateData)
      .where(
        and(
          eq(ordonnancesTable.clinicId, req.clinicId),
          eq(ordonnancesTable.id, id),
        ),
      )
      .returning();
    if (!row) return res.status(404).json({ error: "Ordonnance non trouvÃÂÃÂ©e" });
    return res.json({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID invalide" });
    const [deleted] = await db
      .delete(ordonnancesTable)
      .where(
        and(
          eq(ordonnancesTable.clinicId, req.clinicId),
          eq(ordonnancesTable.id, id),
        ),
      )
      .returning();
    if (!deleted)
      return res.status(404).json({ error: "Ordonnance non trouvÃÂÃÂ©e" });
    return res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.post("/ia/generer", validate(z.object({ consultationId: z.number().int().positive() })), async (req, res) => {
  try {
    const { consultationId } = req.body;

    const [consultation] = await db
      .select({
        id: consultationsTable.id,
        date: consultationsTable.date,
        veterinaire: consultationsTable.veterinaire,
        diagnostic: consultationsTable.diagnostic,
        diagnosticIA: consultationsTable.diagnosticIA,
        ordonnance: consultationsTable.ordonnance,
        anamnese: consultationsTable.anamnese,
        examenClinique: consultationsTable.examenClinique,
        poids: consultationsTable.poids,
        temperature: consultationsTable.temperature,
        patient: {
          id: patientsTable.id,
          nom: patientsTable.nom,
          espece: patientsTable.espece,
          race: patientsTable.race,
          sexe: patientsTable.sexe,
          dateNaissance: patientsTable.dateNaissance,
          poids: patientsTable.poids,
          allergies: patientsTable.allergies,
          antecedents: patientsTable.antecedents,
          owner: {
            id: ownersTable.id,
            nom: ownersTable.nom,
            prenom: ownersTable.prenom,
          },
        },
      })
      .from(consultationsTable)
      .leftJoin(patientsTable, eq(consultationsTable.patientId, patientsTable.id))
      .leftJoin(ownersTable, eq(patientsTable.ownerId, ownersTable.id))
      .where(
        and(
          eq(consultationsTable.clinicId, req.clinicId),
          eq(consultationsTable.id, Number(consultationId)),
        ),
      );
    if (!consultation)
      return res.status(404).json({ error: "Consultation non trouvÃÂÃÂ©e" });

    const actes = await db
      .select({
        nom: actesTable.nom,
        categorie: actesTable.categorie,
        code: actesTable.code,
        quantite: actesConsultationsTable.quantite,
        description: actesConsultationsTable.description,
      })
      .from(actesConsultationsTable)
      .leftJoin(actesTable, eq(actesConsultationsTable.acteId, actesTable.id))
      .where(eq(actesConsultationsTable.consultationId, Number(consultationId)));

    const [clinique] = await db
      .select()
      .from(parametresCliniqueTable)
      .limit(1);

    const nomPatient = consultation.patient?.nom ?? "Patient inconnu";
    const espece = consultation.patient?.espece ?? "";
    const race = consultation.patient?.race ?? "";
    const poids = consultation.poids ?? consultation.patient?.poids;
    const dateNaissance = consultation.patient?.dateNaissance;
    const ageStr = dateNaissance
      ? `${Math.floor(
          (Date.now() - new Date(dateNaissance).getTime()) /
            (365.25 * 24 * 3600 * 1000),
        )} ans`
      : "âge inconnu";
    const proprietaire = consultation.patient?.owner
      ? `${consultation.patient.owner.prenom ?? ""} ${consultation.patient.owner.nom ?? ""}`.trim()
      : "";
    const allergies = consultation.patient?.allergies;
    const antecedents = consultation.patient?.antecedents;
    const medicaments =
      actes
        .filter(
          (a) =>
            a.categorie === "medicament" ||
            a.categorie === "MÃÂÃÂ©dicaments" ||
            a.code?.startsWith("MED"),
        )
        .map(
          (a) =>
            `- ${a.nom} (x${a.quantite})${a.description ? ` : ${a.description}` : ""}`,
        )
        .join("\n") ||
      actes.map((a) => `- ${a.nom} (x${a.quantite})`).join("\n");

    const prompt = `Tu es un vÃÂÃÂ©tÃÂÃÂ©rinaire expert. GÃÂÃÂ©nÃÂÃÂ¨re une ordonnance vÃÂÃÂ©tÃÂÃÂ©rinaire professionnelle en franÃÂÃÂ§ais pour la consultation suivante.

PATIENT :
- Nom : ${nomPatient}
- EspÃÂÃÂ¨ce : ${espece} ${race ? `(${race})` : ""}
- Age : ${ageStr}
- Poids : ${poids ? `${poids} kg` : "non renseignÃÂÃÂ©"}
- PropriÃÂÃÂ©taire : ${proprietaire || "non renseignÃÂÃÂ©"}
${allergies ? `- Allergies connues : ${allergies}` : ""}
${antecedents ? `- AntÃÂÃÂ©cÃÂÃÂ©dents : ${antecedents}` : ""}

CONSULTATION DU ${consultation.date} :
${consultation.anamnese ? `Motif / AnamnÃÂÃÂ¨se : ${consultation.anamnese}` : ""}
${consultation.examenClinique ? `Examen clinique : ${consultation.examenClinique}` : ""}
${consultation.temperature ? `TempÃÂÃÂ©rature : ${consultation.temperature}ÃÂÃÂ°C` : ""}
Diagnostic : ${consultation.diagnostic ?? consultation.diagnosticIA ?? "non spÃÂÃÂ©cifiÃÂÃÂ©"}
${consultation.ordonnance ? `Ordonnance saisie manuellement : ${consultation.ordonnance}` : ""}

ACTES / MÃÂÃÂDICAMENTS PRESCRITS :
${medicaments || "Aucun acte enregistrÃÂÃÂ©"}

INSTRUCTIONS :
1. GÃÂÃÂ©nÃÂÃÂ¨re le contenu complet de l'ordonnance (section CONTENU) incluant :
   - Liste de chaque mÃÂÃÂ©dicament avec : posologie prÃÂÃÂ©cise (dose/kg si pertinent), frÃÂÃÂ©quence, durÃÂÃÂ©e du traitement, voie d'administration
   - Conditions de conservation si nÃÂÃÂ©cessaire
   - PrÃÂÃÂ©cautions particuliÃÂÃÂ¨res (ÃÂÃÂ©viter ensoleillement, jeÃÂÃÂ»ne, etc.)
2. GÃÂÃÂ©nÃÂÃÂ¨re les instructions simplifiÃÂÃÂ©es pour le propriÃÂÃÂ©taire (section INSTRUCTIONS_CLIENT) :
   language clair, sans jargon mÃÂÃÂ©dical
3. Sois prÃÂÃÂ©cis, professionnel et adaptÃÂÃÂ© ÃÂÃÂ  l'espÃÂÃÂ¨ce animale

RÃÂÃÂ©ponds en JSON strict (sans markdown) :
{ "contenu": "texte complet de l'ordonnance mÃÂÃÂ©dicale", "instructionsClient": "texte simplifiÃÂÃÂ© pour le propriÃÂÃÂ©taire" }`;

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });
    const raw =
      response.content[0].type === "text" ? response.content[0].text : "";
    let parsed: { contenu: string; instructionsClient: string };
    try {
      const jsonStr = raw
        .replace(/^```json\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { contenu: raw, instructionsClient: "" };
    }

    const yearAI = new Date().getFullYear();
    const [lastOrdAI] = await db
      .select({ num: ordonnancesTable.numeroOrdonnance })
      .from(ordonnancesTable)
      .where(
        and(
          eq(ordonnancesTable.clinicId, req.clinicId),
          sql`numero_ordonnance LIKE ${`ORD-${yearAI}-%`}`,
        ),
      )
      .orderBy(desc(ordonnancesTable.id))
      .limit(1);
    const lastSeqAI = lastOrdAI?.num
      ? parseInt(lastOrdAI.num.split("-")[2] ?? "0")
      : 0;
    const numeroOrdonnanceAI = `ORD-${yearAI}-${String(lastSeqAI + 1).padStart(5, "0")}`;

    const [ordonnance] = await db
      .insert(ordonnancesTable)
      .values({
        consultationId: Number(consultationId),
        patientId: consultation.patient?.id ?? null,
        veterinaire:
          consultation.veterinaire ?? clinique?.nomClinique ?? null,
        contenu: parsed.contenu,
        numeroOrdonnance: numeroOrdonnanceAI,
        genereIA: true,
        instructionsClient: parsed.instructionsClient || null,
        clinicId: req.clinicId,
      })
      .returning();

    // DÃÂÃÂ©crÃÂÃÂ©menter le stock automatiquement (FEFO) ÃÂ¢ÃÂÃÂ fire and forget
    setImmediate(() =>
      void decrementeStockDepuisOrdonnance(
        req.clinicId,
        Number(consultationId),
        parsed.contenu,
        (msg) => req.log.info({ ordonnanceId: ordonnance.id }, msg),
      ),
    );

    return res.status(201).json({
      ...ordonnance,
      createdAt: ordonnance.createdAt.toISOString(),
      updatedAt: ordonnance.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la gÃÂÃÂ©nÃÂÃÂ©ration IA" });
  }
});


// POST /api/ordonnances/:id/check-contraindications
router.post("/:id/check-contraindications", async (req, res) => {
  try {
    const { id } = req.params;
    const { medicaments, espece } = req.body as { medicaments: string[]; espece?: string };
    if (!Array.isArray(medicaments)) {
      return res.status(400).json({ error: "medicaments must be an array of strings" });
    }
    const warnings = checkContraindications(medicaments, espece);
    return res.json({ data: warnings });
  } catch (err: any) {
    req.log.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
