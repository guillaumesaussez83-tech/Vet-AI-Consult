// ============================================================
// VETOAI — SEED PART 5 : SCRIPT D'INSERTION PRINCIPAL (v3)
// ============================================================
// Compatible avec le vrai schéma Drizzle VetoAI :
//   - IDs serial (integer auto-increment), pas text
//   - Colonnes françaises (nom, prenom, espece, etc.)
//   - Pas de hospitalisations / chirurgies / facture_lignes (inexistants)
//   - Ordonnance embedée dans consultations.ordonnance
//
// Usage:
//   SEED_CLINIC_ID=clinic_seed_demo DATABASE_URL=postgres://... npx ts-node seed_part5.ts
//
// Nettoyer avant de relancer :
//   DELETE FROM weight_history WHERE clinic_id='clinic_seed_demo';
//   DELETE FROM vaccinations    WHERE clinic_id='clinic_seed_demo';
//   DELETE FROM factures        WHERE clinic_id='clinic_seed_demo';
//   DELETE FROM consultations   WHERE clinic_id='clinic_seed_demo';
//   DELETE FROM rendez_vous     WHERE clinic_id='clinic_seed_demo';
//   DELETE FROM patients        WHERE clinic_id='clinic_seed_demo';
//   DELETE FROM owners          WHERE clinic_id='clinic_seed_demo';
//   DELETE FROM assistants      WHERE clinic_id='clinic_seed_demo';

import { Pool } from 'pg';
import { OWNERS, VETS, ASSISTANTS } from './seed_part1';
import { PATIENTS } from './seed_part2';
import { CONSULTATIONS } from './seed_part3';
import { RENDEZ_VOUS, WEIGHT_HISTORY } from './seed_part4';

const CLINIC_ID = process.env.SEED_CLINIC_ID ?? 'clinic_seed_demo';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Helpers ──────────────────────────────────────────────────
function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function padNum(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

// ── MAIN ─────────────────────────────────────────────────────
async function runSeed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`\n🌱 VETOAI SEED v3 — clinic_id: ${CLINIC_ID}\n`);

    // ── 1. Assistants ─────────────────────────────────────────
    // seed_part1 ASSISTANTS: { nom, prenom, email, telephone, role, initiales }
    console.log('  → Inserting assistants...');
    for (const a of ASSISTANTS) {
      await client.query(`
        INSERT INTO assistants (clinic_id, prenom, nom, email, telephone, role, initiales, actif)
        VALUES ($1,$2,$3,$4,$5,$6,$7,true)
      `, [CLINIC_ID, a.prenom, a.nom, a.email ?? null, (a as any).telephone ?? null, a.role ?? 'assistante', (a as any).initiales ?? null]);
    }
    console.log(`     ✓ ${ASSISTANTS.length} assistants`);

    // ── 2. Propriétaires ──────────────────────────────────────
    // seed_part1 OWNERS: { nom, prenom, email, telephone, adresse }
    console.log('  → Inserting owners...');
    const ownerIds: number[] = [];
    for (const o of OWNERS) {
      const ow = o as any;
      const res = await client.query<{ id: number }>(`
        INSERT INTO owners (clinic_id, prenom, nom, email, telephone, adresse)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id
      `, [CLINIC_ID, ow.prenom, ow.nom, ow.email ?? null, ow.telephone, ow.adresse ?? null]);
      ownerIds.push(res.rows[0].id);
    }
    console.log(`     ✓ ${OWNERS.length} propriétaires — IDs ${ownerIds[0]}–${ownerIds[ownerIds.length - 1]}`);

    // ── 3. Patients ───────────────────────────────────────────
    // seed_part2 PATIENTS: { nom, espece, race, sexe, date_naissance, poids, sterilise, owner_idx, antecedents?, puce? }
    console.log('  → Inserting patients...');
    const patientIds: number[] = [];
    for (const p of PATIENTS) {
      const pt = p as any;
      const ownerId = ownerIds[pt.owner_idx];
      const res = await client.query<{ id: number }>(`
        INSERT INTO patients (
          clinic_id, owner_id, nom, espece, race, sexe,
          date_naissance, poids, couleur, puce, sterilise, antecedents, allergies
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING id
      `, [
        CLINIC_ID, ownerId,
        pt.nom, pt.espece, pt.race ?? null, pt.sexe,
        pt.date_naissance ?? null, pt.poids ?? null, pt.couleur ?? null,
        pt.puce ?? null, pt.sterilise ?? false,
        pt.antecedents ?? null, pt.allergies ?? null
      ]);
      patientIds.push(res.rows[0].id);
    }
    console.log(`     ✓ ${PATIENTS.length} patients — IDs ${patientIds[0]}–${patientIds[patientIds.length - 1]}`);

    // ── 4. Consultations + Factures + Vaccinations ────────────
    // seed_part3 CONSULTATIONS: { patient_idx, vet_idx, date, motif, anamnese, examen_clinique,
    //   notes, statut, domaine, complexite, ordonnance?, facture_lignes?, vaccination? }
    // VETS: { name: 'Dr. Marie Dubois', id: 'vet_clerk_001' }
    console.log('  → Inserting 200 consultations...');
    let consCount = 0, factCount = 0, vacCount = 0;
    let factureNum = 1;

    for (const c of CONSULTATIONS) {
      const patId   = patientIds[c.patient_idx];
      const vet     = VETS[c.vet_idx];
      const vetName = (vet as any).name;          // 'Dr. Marie Dubois'
      const vetId   = (vet as any).id;            // 'vet_clerk_001'

      // — Consultation principale (ordonnance embedée) —
      const consRes = await client.query<{ id: number }>(`
        INSERT INTO consultations (
          clinic_id, patient_id, veterinaire, veterinaire_id,
          date, motif, anamnese, examen_clinique, notes, statut, ordonnance
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id
      `, [
        CLINIC_ID, patId, vetName, vetId,
        c.date, c.motif, c.anamnese, c.examen_clinique, c.notes,
        'TERMINEE',
        (c as any).ordonnance ?? null
      ]);
      const consId = consRes.rows[0].id;
      consCount++;

      // — Facture simplifiée (pas de table facture_lignes) —
      const lignes = (c as any).facture_lignes as Array<{ quantite: number; prixUnitaire: number; tvaRate: number }> | undefined;
      if (lignes && lignes.length > 0) {
        const totalHT  = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
        const totalTTC = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire * (1 + l.tvaRate / 100), 0);

        const statutSrc = (c as any).facture_statut as string | undefined;
        const statutDb  =
          statutSrc === 'payee'     ? 'payée'      :
          statutSrc === 'brouillon' ? 'en_attente' : 'payée';

        const numero = `SEED-${padNum(factureNum++, 4)}`;

        await client.query(`
          INSERT INTO factures (
            clinic_id, consultation_id, numero,
            montant_ht, tva, montant_ttc,
            statut, date_emission, mode_paiement
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [
          CLINIC_ID, consId, numero,
          Math.round(totalHT  * 100) / 100,
          20,
          Math.round(totalTTC * 100) / 100,
          statutDb,
          c.date,
          (c as any).mode_paiement ?? 'CB'
        ]);
        factCount++;
      }

      // — Vaccination —
      const vac = (c as any).vaccination as { vaccine_type: string; vaccine_name: string; next_due_months: number } | undefined;
      if (vac) {
        const nextDue = addMonths(c.date, vac.next_due_months);
        const ownerId = ownerIds[(PATIENTS[c.patient_idx] as any).owner_idx];

        await client.query(`
          INSERT INTO vaccinations (
            clinic_id, patient_id, owner_id, consultation_id,
            vaccine_type, vaccine_name, vaccine_date, next_due_date
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [
          CLINIC_ID, patId, ownerId, consId,
          vac.vaccine_type, vac.vaccine_name,
          c.date, nextDue
        ]);
        vacCount++;
      }
    }

    console.log(`     ✓ ${consCount} consultations`);
    console.log(`     ✓ ${factCount} factures`);
    console.log(`     ✓ ${vacCount} vaccinations`);

    // ── 5. Rendez-vous ────────────────────────────────────────
    // seed_part4 RENDEZ_VOUS: { patient_idx, vet_idx, date, duree_minutes, motif, statut, notes? }
    console.log('  → Inserting rendez-vous...');
    for (const r of RENDEZ_VOUS) {
      const rv = r as any;
      const patId  = patientIds[rv.patient_idx];
      const ownId  = ownerIds[(PATIENTS[rv.patient_idx] as any).owner_idx];
      const vetId  = (VETS[rv.vet_idx] as any).id;

      await client.query(`
        INSERT INTO rendez_vous (
          clinic_id, patient_id, owner_id, veterinaire_id,
          date_heure, duree_minutes, motif, statut, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        CLINIC_ID, patId, ownId, vetId,
        rv.date, rv.duree_minutes, rv.motif, rv.statut, rv.notes ?? null
      ]);
    }
    console.log(`     ✓ ${RENDEZ_VOUS.length} rendez-vous`);

    // ── 6. Historique poids ───────────────────────────────────
    // seed_part4 WEIGHT_HISTORY: { patient_idx, date, poids_kg, notes? }
    console.log('  → Inserting weight history...');
    for (const w of WEIGHT_HISTORY) {
      const wh = w as any;
      const patId = patientIds[wh.patient_idx];

      await client.query(`
        INSERT INTO weight_history (clinic_id, patient_id, weight, measured_at, notes)
        VALUES ($1,$2,$3,$4,$5)
      `, [
        CLINIC_ID, patId,
        wh.poids_kg,
        wh.date,
        wh.notes ?? null
      ]);
    }
    console.log(`     ✓ ${WEIGHT_HISTORY.length} entrées weight history`);

    await client.query('COMMIT');
    console.log('\n✅ SEED TERMINÉ AVEC SUCCÈS\n');
    printStats();

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERREUR — rollback effectué:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// ── Rapport statistique ───────────────────────────────────────
function printStats() {
  const vetLoads = [0, 0, 0];
  let totalFacture = 0;
  let paysCount    = 0;
  let vacTotal     = 0;
  const complexites: number[] = [0, 0, 0, 0, 0];
  const domaineCounts: Record<string, number> = {};

  for (const c of CONSULTATIONS) {
    const cc = c as any;
    vetLoads[c.vet_idx]++;
    if (cc.complexite) complexites[cc.complexite - 1]++;
    if (cc.domaine)    domaineCounts[cc.domaine] = (domaineCounts[cc.domaine] ?? 0) + 1;

    if (cc.facture_lignes) {
      const ttc = cc.facture_lignes.reduce(
        (s: number, l: any) => s + l.quantite * l.prixUnitaire * (1 + l.tvaRate / 100), 0
      );
      totalFacture += ttc;
      if (cc.facture_statut === 'payee') paysCount++;
    }
    if (cc.vaccination) vacTotal++;
  }

  const rdvStatuts: Record<string, number> = {};
  for (const r of RENDEZ_VOUS) {
    const rv = r as any;
    rdvStatuts[rv.statut] = (rdvStatuts[rv.statut] ?? 0) + 1;
  }

  const consultavecFacture = CONSULTATIONS.filter((c: any) => c.facture_lignes?.length).length;

  console.log('══════════════════════════════════════════════════════════');
  console.log('  RAPPORT STATISTIQUE — BASE DE DONNÉES SEED VETOAI');
  console.log('══════════════════════════════════════════════════════════');

  console.log(`\n📋 ENTITÉS CRÉÉES`);
  console.log(`   Propriétaires  : ${OWNERS.length}`);
  console.log(`   Patients       : ${PATIENTS.length}  (${(PATIENTS as any[]).filter(p => p.espece?.toLowerCase().includes('chien')).length} chiens / ${(PATIENTS as any[]).filter(p => p.espece?.toLowerCase().includes('chat')).length} chats)`);
  console.log(`   Consultations  : ${CONSULTATIONS.length}`);
  console.log(`   Vaccinations   : ${vacTotal}`);
  console.log(`   Rendez-vous    : ${RENDEZ_VOUS.length}`);
  console.log(`   Poids (entrées): ${WEIGHT_HISTORY.length}`);

  console.log(`\n💶 FACTURATION`);
  console.log(`   CA total TTC   : ${totalFacture.toFixed(2)} €`);
  console.log(`   Factures payées: ${paysCount} / ${consultavecFacture}`);
  console.log(`   Panier moyen   : ${(totalFacture / CONSULTATIONS.length).toFixed(2)} €`);

  console.log(`\n👨‍⚕️ CHARGE PAR VÉTÉRINAIRE`);
  for (let i = 0; i < 3; i++) {
    const vetName = (VETS[i] as any).name;
    const pct = ((vetLoads[i] / CONSULTATIONS.length) * 100).toFixed(1);
    console.log(`   ${vetName.padEnd(22)}: ${String(vetLoads[i]).padStart(3)} cas (${pct}%)`);
  }

  console.log(`\n📊 COMPLEXITÉ`);
  const labels = ['Routine (1)', 'Courant (2)', 'Modéré (3)', 'Complexe (4)', 'Rare (5)'];
  for (let i = 0; i < 5; i++) {
    console.log(`   ${labels[i].padEnd(14)}: ${String(complexites[i]).padStart(3)} cas`);
  }

  console.log(`\n🏥 TOP 10 DOMAINES`);
  const sorted = Object.entries(domaineCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [d, n] of sorted) {
    console.log(`   ${d.padEnd(30)}: ${n}`);
  }

  console.log(`\n📅 RENDEZ-VOUS PAR STATUT`);
  for (const [s, n] of Object.entries(rdvStatuts)) {
    console.log(`   ${s.padEnd(12)}: ${n}`);
  }

  console.log('\n══════════════════════════════════════════════════════════\n');
}

runSeed().catch(console.error);
