#!/usr/bin/env node
// =============================================================================
// test_facture_race_condition.mjs — 20 factures en parallèle, zéro doublon
//
// Usage:
//   DATABASE_URL="postgresql://user:pass@host:5432/db" \
//   CLINIC_ID="org_test_race_$(date +%s)" \
//   node test_facture_race_condition.mjs
//
// Ce script :
//  1. Crée une consultation de test dans la DB
//  2. Lance 20 tentatives d'INSERT en parallèle avec advisory lock + hashtext
//  3. Vérifie qu'une seule facture a été créée (les 19 autres → 409 ALREADY_EXISTS)
//  4. Vérifie qu'il n'y a aucun doublon de numero_facture pour cette clinic
//  5. Nettoie les données de test
// =============================================================================
import pg from 'pg';

const { Client } = pg;
const DB_URL   = process.env.DATABASE_URL;
const CLINIC_ID = process.env.CLINIC_ID ?? `org_test_race_${Date.now()}`;

if (!DB_URL) { console.error('DATABASE_URL requis'); process.exit(1); }

// ---- Helpers ---------------------------------------------------------------

async function withClient(fn) {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try { return await fn(client); }
  finally { await client.end(); }
}

// Réplique exacte de factureService.genererNumero (tx = client ici)
async function genererNumero(client, clinicId) {
  const year = new Date().getFullYear();
  const lockRes = await client.query(
    `SELECT hashtext($1 || '_' || $2::text) AS lock_key`,
    [clinicId, year]
  );
  const lockKey = lockRes.rows[0].lock_key;
  await client.query(`SELECT pg_advisory_xact_lock($1)`, [lockKey]);

  const countRes = await client.query(
    `SELECT COUNT(*) AS count FROM factures
     WHERE clinic_id = $1
     AND EXTRACT(YEAR FROM created_at AT TIME ZONE 'Europe/Paris') = $2`,
    [clinicId, year]
  );
  const count = Number(countRes.rows[0].count) + 1;
  return `FAC-${year}-${String(count).padStart(5, '0')}`;
}

// ---- Setup -----------------------------------------------------------------

async function setup() {
  return withClient(async (client) => {
    const ownerRes = await client.query(
      `INSERT INTO owners (clinic_id, nom, prenom, email, telephone, adresse)
       VALUES ($1, 'TestRace', 'Owner', 'race@test.fr', '0600000000', '1 rue test')
       RETURNING id`,
      [CLINIC_ID]
    );
    const ownerId = ownerRes.rows[0].id;

    const patientRes = await client.query(
      `INSERT INTO patients (clinic_id, nom, espece, owner_id)
       VALUES ($1, 'TestDog', 'Chien', $2)
       RETURNING id`,
      [CLINIC_ID, ownerId]
    );
    const patientId = patientRes.rows[0].id;

    const consRes = await client.query(
      `INSERT INTO consultations (clinic_id, patient_id, veterinaire, date, statut, motif)
       VALUES ($1, $2, 'Dr Test', NOW(), 'terminee', 'Test race condition')
       RETURNING id`,
      [CLINIC_ID, patientId]
    );
    const consultationId = consRes.rows[0].id;

    console.log(`Setup: owner=${ownerId}, patient=${patientId}, consultation=${consultationId}, clinic=${CLINIC_ID}`);
    return { ownerId, patientId, consultationId };
  });
}

// ---- One attempt -----------------------------------------------------------

async function tryInsertFacture(consultationId, attempt) {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id FROM factures WHERE clinic_id = $1 AND consultation_id = $2 LIMIT 1`,
      [CLINIC_ID, consultationId]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return { attempt, status: 409, reason: 'ALREADY_EXISTS' };
    }

    const numero = await genererNumero(client, CLINIC_ID);
    const today  = new Date().toISOString().split('T')[0];

    await client.query(
      `INSERT INTO factures
         (clinic_id, consultation_id, numero, montant_ht, tva, montant_ttc, statut, date_emission)
       VALUES ($1, $2, $3, 100, 20, 120, 'en_attente', $4)`,
      [CLINIC_ID, consultationId, numero, today]
    );

    await client.query('COMMIT');
    return { attempt, status: 201, numero };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return { attempt, status: 409, reason: 'UNIQUE_VIOLATION' };
    return { attempt, status: 500, reason: err.message };
  } finally {
    await client.end();
  }
}

// ---- Cleanup ---------------------------------------------------------------

async function cleanup() {
  return withClient(async (client) => {
    await client.query(`DELETE FROM factures      WHERE clinic_id = $1`, [CLINIC_ID]);
    await client.query(`DELETE FROM consultations WHERE clinic_id = $1`, [CLINIC_ID]);
    await client.query(`DELETE FROM patients      WHERE clinic_id = $1`, [CLINIC_ID]);
    await client.query(`DELETE FROM owners        WHERE clinic_id = $1`, [CLINIC_ID]);
    console.log('Cleanup: données de test supprimées');
  });
}

// ---- Verify ----------------------------------------------------------------

async function verify(consultationId) {
  return withClient(async (client) => {
    const res = await client.query(
      `SELECT numero, COUNT(*) OVER (PARTITION BY clinic_id, numero) AS dup_count
       FROM factures WHERE clinic_id = $1 AND consultation_id = $2`,
      [CLINIC_ID, consultationId]
    );
    return res.rows;
  });
}

// ---- Main ------------------------------------------------------------------

(async () => {
  console.log('\n=== Test race condition — 20 POST /factures en parallèle ===\n');

  const { consultationId } = await setup();

  const N = 20;
  const results = await Promise.all(
    Array.from({ length: N }, (_, i) => tryInsertFacture(consultationId, i + 1))
  );

  console.log('\nRésultats:');
  results.forEach(r => {
    const icon = r.status === 201 ? '✅' : r.status === 409 ? '⚡' : '❌';
    console.log(`  [${String(r.attempt).padStart(2)}] ${icon} HTTP ${r.status} ${r.numero ?? r.reason}`);
  });

  const created   = results.filter(r => r.status === 201);
  const conflicts = results.filter(r => r.status === 409);
  const errors    = results.filter(r => r.status === 500);

  console.log(`\nSynthèse: ${created.length} créée(s), ${conflicts.length} conflits, ${errors.length} erreur(s)`);

  const dbRows = await verify(consultationId);
  const hasDuplicates = dbRows.some(r => Number(r.dup_count) > 1);

  console.log(`\nDB: ${dbRows.length} facture(s) pour la consultation`);
  if (dbRows.length > 0) {
    dbRows.forEach(r => console.log(`  numero=${r.numero}  dup_count=${r.dup_count}`));
  }

  await cleanup();

  console.log('\n=== Verdict ===');
  const pass =
    created.length   === 1    &&
    conflicts.length === N - 1 &&
    errors.length    === 0    &&
    dbRows.length    === 1    &&
    !hasDuplicates;

  if (pass) {
    console.log('✅ PASS — 1 seule facture créée, 19 conflits, 0 doublon en DB');
  } else {
    console.log('❌ FAIL');
    if (created.length !== 1)          console.log(`  • ${created.length} facture(s) créée(s), attendu 1`);
    if (conflicts.length !== N - 1)    console.log(`  • ${conflicts.length} conflits, attendu ${N-1}`);
    if (errors.length > 0)             console.log(`  • ${errors.length} erreur(s) serveur`);
    if (dbRows.length > 1)             console.log(`  • ${dbRows.length} lignes en DB, attendu 1`);
    if (hasDuplicates)                 console.log(`  • DOUBLONS détectés en DB !`);
    process.exit(1);
  }
})();
