#!/usr/bin/env node
// =============================================================================
// test_attachment_base64_null.mjs — Vérifie que dataBase64 = NULL quand fileUrl
//
// Usage:
//   DATABASE_URL="postgresql://user:pass@host:5432/db" \
//   API_BASE="https://app.vetoai.fr" \
//   AUTH_TOKEN="Bearer eyJ..." \
//   CLINIC_ID="org_xxx" \
//   CONSULTATION_ID="42" \
//   node test_attachment_base64_null.mjs
//
// Ce script :
//  1. POST /api/consultations/:id/attachments avec fileUrl (HTTPS)
//  2. Lit la ligne en DB → vérifie data_base64 IS NULL
//  3. POST avec dataBase64 (petit fichier) → vérifie que data_base64 IS NOT NULL
//  4. POST avec fileUrl HTTP (pas HTTPS) → vérifie HTTP 400
//  5. POST sans fileUrl ni dataBase64 → vérifie HTTP 400
//  6. POST avec base64 > 5MB → vérifie HTTP 413
//  7. Nettoie les lignes de test
// =============================================================================
import pg from 'pg';

const { Client } = pg;

const DB_URL    = process.env.DATABASE_URL;
const API_BASE  = (process.env.API_BASE  ?? 'https://app.vetoai.fr').replace(/\/$/, '');
const TOKEN     = process.env.AUTH_TOKEN;
const CLINIC_ID = process.env.CLINIC_ID;
const CONS_ID   = process.env.CONSULTATION_ID;

if (!DB_URL || !TOKEN || !CLINIC_ID || !CONS_ID) {
  console.error('Requis: DATABASE_URL, AUTH_TOKEN, CLINIC_ID, CONSULTATION_ID');
  process.exit(1);
}

const ENDPOINT = `${API_BASE}/api/consultations/${CONS_ID}/attachments`;

// ---- HTTP helper -----------------------------------------------------------

async function post(body) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': TOKEN,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// ---- DB helper -------------------------------------------------------------

async function getRow(id) {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const res = await client.query(
      `SELECT id, file_url, data_base64, file_name, file_size, mime_type, clinic_id
       FROM consultation_attachments WHERE id = $1 AND clinic_id = $2`,
      [id, CLINIC_ID]
    );
    return res.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

async function deleteRows(ids) {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    for (const id of ids) {
      await client.query(`DELETE FROM consultation_attachments WHERE id = $1`, [id]);
    }
    console.log(`  Cleanup: ${ids.length} ligne(s) supprimée(s)`);
  } finally {
    await client.end();
  }
}

// ---- Tests -----------------------------------------------------------------

const createdIds = [];
let passCount = 0, failCount = 0;

function ok(label) { console.log(`  ✅ PASS — ${label}`); passCount++; }
function fail(label, detail) { console.log(`  ❌ FAIL — ${label}: ${detail}`); failCount++; }

// Test 1 — fileUrl valide → data_base64 NULL en DB
console.log('\n[1] POST avec fileUrl HTTPS valide');
{
  const r = await post({
    fileUrl:  'https://cdn.vetoai.fr/test/sample.pdf',
    fileName: 'test_attachment.pdf',
    fileSize: 12345,
    mimeType: 'application/pdf',
  });
  if (r.status !== 201) {
    fail('HTTP 201 attendu', `got ${r.status}: ${JSON.stringify(r.json)}`);
  } else {
    const id = r.json?.id ?? r.json?.data?.id;
    createdIds.push(id);
    const row = await getRow(id);
    if (!row)             fail('Ligne non trouvée en DB', id);
    else if (row.data_base64 !== null) fail('data_base64 doit être NULL', String(row.data_base64).substring(0, 40));
    else if (!row.file_url)            fail('file_url doit être non-NULL', JSON.stringify(row));
    else ok(`id=${id} — file_url="${row.file_url}", data_base64=NULL`);
  }
}

// Test 2 — base64 petit → data_base64 stocké
console.log('\n[2] POST avec dataBase64 (sans fileUrl)');
{
  const b64 = Buffer.from('Hello VetoAI test').toString('base64');
  const r = await post({
    dataBase64: b64,
    fileName:   'hello.txt',
    mimeType:   'text/plain',
    fileSize:   17,
  });
  if (r.status !== 201) {
    fail('HTTP 201 attendu', `got ${r.status}: ${JSON.stringify(r.json)}`);
  } else {
    const id = r.json?.id ?? r.json?.data?.id;
    createdIds.push(id);
    const row = await getRow(id);
    if (!row)             fail('Ligne non trouvée en DB', id);
    else if (row.data_base64 === null) fail('data_base64 ne doit PAS être NULL', 'got null');
    else if (row.file_url !== null)    fail('file_url doit être NULL', String(row.file_url));
    else ok(`id=${id} — data_base64 stocké, file_url=NULL`);
  }
}

// Test 3 — fileUrl HTTP (pas HTTPS) → 400
console.log('\n[3] POST avec fileUrl HTTP (non sécurisé) → 400 attendu');
{
  const r = await post({ fileUrl: 'http://cdn.vetoai.fr/test.pdf', fileName: 'bad.pdf' });
  if (r.status === 400) ok(`HTTP 400 reçu — "${r.json?.error}"`);
  else fail('HTTP 400 attendu', `got ${r.status}: ${JSON.stringify(r.json)}`);
}

// Test 4 — ni fileUrl ni dataBase64 → 400
console.log('\n[4] POST sans fileUrl ni dataBase64 → 400 attendu');
{
  const r = await post({ fileName: 'orphan.pdf' });
  if (r.status === 400) ok(`HTTP 400 reçu — "${r.json?.error}"`);
  else fail('HTTP 400 attendu', `got ${r.status}: ${JSON.stringify(r.json)}`);
}

// Test 5 — base64 > 5 MB → 413
console.log('\n[5] POST avec base64 > 5 MB → 413 attendu');
{
  const oversize = 'A'.repeat(Math.ceil((5 * 1024 * 1024 + 1) * 4 / 3));
  const r = await post({ dataBase64: oversize, fileName: 'huge.bin' });
  if (r.status === 413) ok(`HTTP 413 reçu — "${r.json?.error}"`);
  else fail('HTTP 413 attendu', `got ${r.status}`);
}

// Test 6 — cross-clinic isolation
console.log('\n[6] Isolation multi-tenant — un autre clinicId ne doit pas voir la pièce jointe');
{
  if (createdIds[0]) {
    const client = new Client({ connectionString: DB_URL });
    await client.connect();
    try {
      const res = await client.query(
        `SELECT id FROM consultation_attachments
         WHERE id = $1 AND clinic_id != $2`,
        [createdIds[0], CLINIC_ID]
      );
      if (res.rows.length === 0) ok('Aucune ligne accessible depuis une autre clinic_id');
      else fail('Fuite multi-tenant détectée', JSON.stringify(res.rows));
    } finally {
      await client.end();
    }
  } else {
    fail('id Test 1 non disponible', 'skip');
  }
}

// ---- Cleanup ---------------------------------------------------------------
console.log('\n=== Nettoyage ===');
await deleteRows(createdIds.filter(Boolean));

// ---- Verdict ---------------------------------------------------------------
console.log(`\n=== Verdict: ${passCount} ✅  ${failCount} ❌ ===`);
if (failCount > 0) process.exit(1);
