/**
 * Bench de latence des clients IA (OpenAI + Anthropic).
 *
 * BUT : déterminer si le keep-alive agit, en observant le TTFB par appel.
 *   - 1er appel = FROID (établit une nouvelle connexion TCP/TLS).
 *   - appels suivants = CHAUDS (réutilisent la connexion si le pooling fonctionne).
 *   - FROID lent + CHAUDS rapides  => le keep-alive / pooling agit.
 *   - tous les appels aussi lents   => re-handshake à chaque fois (pas de réutilisation).
 *
 * Pour chaque appel on mesure :
 *   - TTFB        : temps jusqu'au 1er token (inclut connexion + envoi + 1er octet serveur)
 *   - GÉNÉRATION  : temps du 1er token au dernier token (séparé du TTFB)
 *   - TOTAL       : TTFB + génération
 * Plus, en référence, le coût d'un handshake TLS isolé (TCP+TLS) vers chaque hôte,
 * pour comparer au delta (FROID - CHAUD) et chiffrer ce que le keep-alive économise.
 *
 * SÉCURITÉ :
 *   - les clés ne sont JAMAIS loggées. On lit uniquement les variables d'env,
 *     on n'affiche que « présent / MANQUANT ».
 *   - aucune clé n'est écrite dans ce fichier.
 *
 * EXÉCUTION : via `railway run` pour que Railway injecte les variables d'env.
 *   railway run node artifacts/api-server/bench/ai-latency.mjs
 *
 * Appels réels minuscules (max_tokens ~64). Coût négligeable.
 */

import { performance } from "node:perf_hooks";
import tls from "node:tls";
import https from "node:https";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// ---- Paramètres (surchargeable par env, défauts raisonnables) ----
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 5); // 1 froid + 4 chauds
const MAX_TOKENS = Number(process.env.BENCH_MAX_TOKENS ?? 64);
const TLS_SAMPLES = Number(process.env.BENCH_TLS_SAMPLES ?? 3);
const PROMPT =
  "Bench de latence. Réponds par une seule phrase courte, sans préambule.";

const OPENAI_MODEL = "gpt-4o-mini"; // = GPT_MODEL (lib/constants)
const ANTHROPIC_MODEL = "claude-sonnet-4-6"; // = AI_MODEL (lib/constants)

const OPENAI_HOST = "api.openai.com";

// ---- Variables d'env (lecture seule, jamais affichées en clair) ----
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
const ANTHROPIC_BASE_URL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

// ---- Petits utilitaires de formatage ----
const ms = (n) => (n === null || n === undefined ? "  —  " : `${n.toFixed(1)} ms`);
const pad = (s, n) => String(s).padStart(n);

function present(v) {
  return v ? "présent" : "MANQUANT";
}

function median(arr) {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Coût d'un handshake « à froid » isolé : TCP connect + négociation TLS,
 * mesuré du début de connexion jusqu'à l'event secureConnect.
 * Aucune donnée applicative n'est envoyée, aucune clé utilisée.
 */
function tlsHandshakeMs(host, port = 443) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const socket = tls.connect(
      { host, port, servername: host },
      () => {
        const dt = performance.now() - t0;
        socket.end();
        resolve(dt);
      },
    );
    socket.once("error", reject);
    socket.setTimeout(10_000, () => {
      socket.destroy();
      reject(new Error(`TLS timeout vers ${host}`));
    });
  });
}

async function measureTlsBaseline(label, host) {
  if (!host) {
    console.log(`  ${label} : hôte indéterminé, mesure ignorée.`);
    return null;
  }
  const samples = [];
  for (let i = 0; i < TLS_SAMPLES; i++) {
    try {
      samples.push(await tlsHandshakeMs(host));
    } catch (e) {
      console.log(`  ${label} (${host}) : échec handshake — ${e.message}`);
    }
  }
  if (samples.length === 0) return null;
  const med = median(samples);
  console.log(
    `  ${label} (${host}) : handshake TCP+TLS médian ${ms(med)} ` +
      `(min ${ms(Math.min(...samples))}, n=${samples.length})`,
  );
  return med;
}

// ---- Un appel mesuré, en streaming, pour OpenAI ----
async function openaiCall(client) {
  const t0 = performance.now();
  let tFirst = null;
  let outTokens = null;
  const stream = await client.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: PROMPT }],
    stream: true,
    stream_options: { include_usage: true },
  });
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta && tFirst === null) tFirst = performance.now();
    if (chunk.usage?.completion_tokens != null) outTokens = chunk.usage.completion_tokens;
  }
  const tEnd = performance.now();
  return {
    ttfb: (tFirst ?? tEnd) - t0,
    gen: tEnd - (tFirst ?? tEnd),
    total: tEnd - t0,
    outTokens,
  };
}

// ---- Un appel mesuré, en streaming, pour Anthropic ----
async function anthropicCall(client) {
  const t0 = performance.now();
  let tFirst = null;
  let outTokens = null;
  const stream = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: PROMPT }],
    stream: true,
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && tFirst === null) tFirst = performance.now();
    if (event.type === "message_delta" && event.usage?.output_tokens != null) {
      outTokens = event.usage.output_tokens;
    }
  }
  const tEnd = performance.now();
  return {
    ttfb: (tFirst ?? tEnd) - t0,
    gen: tEnd - (tFirst ?? tEnd),
    total: tEnd - t0,
    outTokens,
  };
}

// ---- Boucle séquentielle + synthèse pour un provider ----
async function runProvider(name, callOnce, tlsBaselineMs) {
  console.log(`\n=== ${name} : ${ROUNDS} appels séquentiels (1 froid + ${ROUNDS - 1} chauds) ===`);
  console.log(`  ${pad("appel", 7)} | ${pad("TTFB", 10)} | ${pad("génération", 12)} | ${pad("total", 10)} | tokens`);
  const rows = [];
  for (let i = 0; i < ROUNDS; i++) {
    try {
      const r = await callOnce();
      rows.push(r);
      const tag = i === 0 ? "froid" : `chaud${i}`;
      console.log(
        `  ${pad(tag, 7)} | ${pad(ms(r.ttfb), 10)} | ${pad(ms(r.gen), 12)} | ${pad(ms(r.total), 10)} | ${r.outTokens ?? "?"}`,
      );
    } catch (e) {
      console.log(`  appel ${i} ÉCHEC : ${e?.message ?? e}`);
    }
  }
  if (rows.length < 2) {
    console.log("  (pas assez d'appels réussis pour conclure)");
    return;
  }
  const cold = rows[0].ttfb;
  const warm = rows.slice(1).map((r) => r.ttfb);
  const warmMed = median(warm);
  const delta = cold - warmMed;
  console.log(`  → TTFB froid ${ms(cold)} (1er appel : inclut DNS + connexion + réveil process/serveur)`);
  console.log(`  → TTFB chaud médian ${ms(warmMed)} | écart froid−chaud ${ms(delta)}`);

  // IMPORTANT : le keep-alive ne supprime QUE le handshake de connexion. Son gain
  // maximal possible = le coût d'UN handshake. On le compare au TTFB médian pour
  // juger s'il est significatif.
  //
  // À NE PAS confondre : un grand écart froid/chaud ne PROUVE PAS la réutilisation
  // de connexion. S'il dépasse largement le coût d'un handshake (~quelques dizaines
  // de ms), il est dominé par le réveil (DNS initial, JIT du process, démarrage à
  // froid côté serveur) et par la variance du time-to-first-token — pas par le TLS.
  if (tlsBaselineMs != null && warmMed > 0) {
    const pct = (tlsBaselineMs / warmMed) * 100;
    console.log(
      `  → Plafond de gain du keep-alive = 1 handshake ≈ ${ms(tlsBaselineMs)} = ${pct.toFixed(1)} % du TTFB médian`,
    );
    if (pct < 5) {
      console.log(
        "  → LECTURE : handshake négligeable devant le TTFB ⇒ le keep-alive n'est PAS un levier de latence ici. " +
          "Le TTFB est dominé par la génération du 1er token côté serveur, pas par la connexion.",
      );
    } else {
      console.log(
        "  → LECTURE : le handshake pèse une part non négligeable du TTFB ⇒ le keep-alive peut valoir le coup. " +
          "À confirmer sur davantage d'échantillons (variance élevée).",
      );
    }
  } else {
    console.log("  → LECTURE : référence handshake indisponible, interprétation impossible.");
  }
}

async function main() {
  console.log("############ BENCH LATENCE IA ############");
  console.log(`Paramètres : rounds=${ROUNDS}, max_tokens=${MAX_TOKENS}, échantillons TLS=${TLS_SAMPLES}`);
  console.log("Variables d'env (présence uniquement, jamais la valeur) :");
  console.log(`  OPENAI_API_KEY                      : ${present(OPENAI_API_KEY)}`);
  console.log(`  AI_INTEGRATIONS_ANTHROPIC_API_KEY   : ${present(ANTHROPIC_API_KEY)}`);
  console.log(`  AI_INTEGRATIONS_ANTHROPIC_BASE_URL  : ${present(ANTHROPIC_BASE_URL)}`);

  const anthropicHost = hostnameOf(ANTHROPIC_BASE_URL);

  console.log("\n=== Référence : coût d'un handshake TCP+TLS isolé ===");
  const tlsOpenAI = await measureTlsBaseline("OpenAI", OPENAI_HOST);
  const tlsAnthropic = await measureTlsBaseline("Anthropic", anthropicHost);

  // ---- OpenAI ----
  if (OPENAI_API_KEY) {
    // Réplique l'agent keep-alive de production (httpAgent), paramètres identiques.
    const keepAliveAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 50,
    });
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      httpAgent: keepAliveAgent,
      maxRetries: 0, // mesures propres : pas de retry silencieux
    });
    await runProvider("OpenAI (gpt-4o-mini, keep-alive ON)", () => openaiCall(openai), tlsOpenAI);
  } else {
    console.log("\n=== OpenAI : ignoré (OPENAI_API_KEY manquant) ===");
  }

  // ---- Anthropic ----
  if (ANTHROPIC_API_KEY && ANTHROPIC_BASE_URL) {
    // Client par défaut (architecture fetch/undici) : on teste le pooling natif,
    // SANS rien ajouter — c'est précisément la question à trancher.
    const anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
      baseURL: ANTHROPIC_BASE_URL,
      maxRetries: 0,
    });
    await runProvider("Anthropic (claude-sonnet-4-6, défaut fetch/undici)", () => anthropicCall(anthropic), tlsAnthropic);
  } else {
    console.log("\n=== Anthropic : ignoré (AI_INTEGRATIONS_ANTHROPIC_API_KEY ou _BASE_URL manquant) ===");
  }

  console.log("\n############ FIN ############");
}

main().catch((e) => {
  console.error("Erreur fatale du bench :", e?.message ?? e);
  process.exitCode = 1;
});
