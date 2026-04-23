# Patch ciblé `artifacts/api-server/src/routes/ai/index.ts`

## P0-8 (numérotation atomique) + P1-2 (stock transactionnel) + P2-3 (constants)

Le fichier `ai/index.ts` fait ~400 lignes et contient 10 routes IA distinctes.
Le seul endroit à patcher est `POST /confirmer-dictee-ordonnance` (lignes 290→396).
Le reste bouge juste pour utiliser les constants `AI_MODEL` / `AI_MAX_TOKENS`.

## 1. Ajouter les imports (tout en haut du fichier)

```ts
import { AI_MODEL, AI_MAX_TOKENS } from "../../lib/constants";
import { nextOrdonnanceNumber } from "../../lib/numbering";
import { fail } from "../../lib/response";
```

## 2. Remplacer les `"claude-sonnet-4-6"` et `max_tokens: 2048/8192` en dur

Chercher/remplacer dans tout le fichier :

- `"claude-sonnet-4-6"` → `AI_MODEL`
- `max_tokens: 2048` → `max_tokens: AI_MAX_TOKENS.short`
- `max_tokens: 8192` → `max_tokens: AI_MAX_TOKENS.long`

## 3. Remplacer INTÉGRALEMENT le handler `POST /confirmer-dictee-ordonnance` (lignes 290–396)

Remplace de la ligne `router.post("/confirmer-dictee-ordonnance", async (req, res) => {`
jusqu'au `});` correspondant par :

```ts
router.post("/confirmer-dictee-ordonnance", async (req, res) => {
  try {
    const { consultationId, patientId, veterinaire, prescriptions } = req.body;
    if (!consultationId || !prescriptions?.length) {
      return res
        .status(400)
        .json(fail("VALIDATION_ERROR", "consultationId et prescriptions requis"));
    }

    const consId = Number(consultationId);
    const [cons] = await db
      .select({ id: consultationsTable.id })
      .from(consultationsTable)
      .where(
        and(eq(consultationsTable.id, consId), eq(consultationsTable.clinicId, req.clinicId)),
      );
    if (!cons) return res.status(404).json(fail("NOT_FOUND", "Consultation introuvable"));

    const cleanField = (v: unknown): string => {
      if (v == null) return "";
      const s = String(v).trim();
      if (!s || s === "—" || s === "-" || s === "–" || /^null$/i.test(s) || /^undefined$/i.test(s)) {
        return "";
      }
      return s;
    };

    const contenu = prescriptions
      .map((p: any) => {
        const dose = cleanField(p.dose);
        const voie = cleanField(p.voie_administration);
        const freq = cleanField(p.frequence);
        const duree = cleanField(p.duree);
        const rawQte = cleanField(
          p.quantite_a_delivrer != null ? String(p.quantite_a_delivrer) : null,
        );
        const unite = cleanField(p.unite);
        const qte = rawQte ? `${rawQte}${unite ? " " + unite : ""}`.trim() : "";

        const parts = [
          p.nom_medicament,
          dose && `Dose : ${dose}`,
          voie && `Voie : ${voie}`,
          freq && `Fréquence : ${freq}`,
          duree && `Durée : ${duree}`,
          qte && `Qté : ${qte}`,
        ].filter(Boolean);
        return parts.join(" — ");
      })
      .join("\n");

    // P0-8 + P1-2 : tout dans UNE transaction (numérotation + insert ordonnance
    // + mouvements stock + décrément stock avec garde-fou anti-négatif).
    const result = await db.transaction(async (tx) => {
      const numeroOrdonnance = await nextOrdonnanceNumber(tx, req.clinicId);

      const [ordonnance] = await tx
        .insert(ordonnancesTable)
        .values({
          clinicId: req.clinicId,
          consultationId: consId,
          patientId: patientId ? Number(patientId) : null,
          veterinaire: veterinaire ?? null,
          contenu,
          numeroOrdonnance,
          genereIA: true,
        })
        .returning();

      const [existingFacture] = await tx
        .select({ id: facturesTable.id })
        .from(facturesTable)
        .where(
          and(eq(facturesTable.clinicId, req.clinicId), eq(facturesTable.consultationId, consId)),
        );

      const stockWarnings: Array<{ medicamentId: number; motif: string }> = [];

      for (const p of prescriptions) {
        if (!p.stockMatch?.id) continue;
        const quantite = Math.max(1, Math.round(p.quantite_a_delivrer ?? 1));

        // UPDATE conditionnel : échoue silencieusement si stock insuffisant.
        const [updated] = await tx
          .update(stockMedicamentsTable)
          .set({ quantiteStock: drizzleSql`quantite_stock - ${quantite}` })
          .where(
            and(
              eq(stockMedicamentsTable.clinicId, req.clinicId),
              eq(stockMedicamentsTable.id, p.stockMatch.id),
              drizzleSql`${stockMedicamentsTable.quantiteStock} >= ${quantite}`,
            ),
          )
          .returning({ id: stockMedicamentsTable.id });

        if (!updated) {
          stockWarnings.push({
            medicamentId: p.stockMatch.id,
            motif: `Stock insuffisant pour ${p.nom_medicament} (demandé ${quantite})`,
          });
          continue; // on ne crée PAS le mouvement si le stock n'a pas bougé.
        }

        await tx.insert(mouvementsStockTable).values({
          clinicId: req.clinicId,
          medicamentId: p.stockMatch.id,
          typeMouvement: "sortie_consultation",
          quantite: -quantite,
          consultationId: consId,
          factureId: existingFacture?.id ?? null,
          motif: `Ordonnance ${numeroOrdonnance} — ${p.nom_medicament}`,
          utilisateur: veterinaire ?? "Système",
        });
      }

      return { ordonnance, existingFacture, stockWarnings };
    });

    return res.status(201).json({
      ordonnance: {
        ...result.ordonnance,
        createdAt: result.ordonnance.createdAt.toISOString(),
        updatedAt: result.ordonnance.updatedAt.toISOString(),
      },
      factureId: result.existingFacture?.id ?? null,
      stockWarnings: result.stockWarnings, // le front peut afficher un toast en cas de rupture
    });
  } catch (err) {
    req.log.error({ err }, "POST /ai/confirmer-dictee-ordonnance failed");
    return res
      .status(500)
      .json(fail("INTERNAL", "Erreur lors de la confirmation de l'ordonnance"));
  }
});
```

## Justification

- **P0-8 (race condition)** : `nextOrdonnanceNumber(tx, clinicId)` prend un `pg_advisory_xact_lock` avant de lire le dernier numéro → deux requêtes parallèles sérialisent proprement au lieu de collisionner.
- **P1-2 (stock non atomique)** : le `UPDATE ... WHERE quantite_stock >= ${quantite}` garantit qu'on ne passe jamais en négatif. En cas de rupture stock, on ne crée PAS le mouvement fantôme (cohérence mouvements ↔ stock).
- **Transaction** : ordonnance + mouvements + décréments en tout-ou-rien. Si une étape échoue, la base reste propre.
- **`stockWarnings` retourné** : le front peut afficher un toast "3 médicaments en rupture, à recommander" sans bloquer l'impression de l'ordonnance.
