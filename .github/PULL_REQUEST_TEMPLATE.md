<!--
Merci de ta PR. Pour accélérer la review, remplis les sections ci-dessous.
-->

## Summary

<!-- 1 à 3 puces sur le QUOI et le POURQUOI (pas le comment). -->
-
-

## Type

- [ ] feat — nouvelle fonctionnalité
- [ ] fix — correction de bug
- [ ] refactor — remaniement sans changement de comportement
- [ ] chore — tâche de maintenance (deps, config, etc.)
- [ ] docs — documentation seule
- [ ] test — ajout / modification de tests

## Context métier

<!-- Lien Slack / issue / ticket si applicable. Si c'est un fix, décrire
     le bug rencontré. Si c'est une feat, quel besoin utilisateur. -->

## Test plan

<!-- Liste des choses vérifiées en local ET en CI. Mets des checkboxes. -->
- [ ] `pnpm -w typecheck` passe
- [ ] `pnpm -w test` passe
- [ ] Tests ajoutés pour la nouvelle logique (si applicable)
- [ ] Testé manuellement en local (décrire le scénario)

## Migration DB (si applicable)

- [ ] Migration SQL ajoutée dans `db/migrations/`
- [ ] Fichier `.down.sql` correspondant créé
- [ ] Schéma Drizzle mis à jour (`lib/db/src/schema/...`)
- [ ] Migration appliquée sur staging d'abord
- [ ] Backup DB pris avant application en prod

## Sécurité / RGPD

- [ ] Pas de secret en dur (vérifier `git diff | grep -i 'secret\|key'`)
- [ ] Toutes les nouvelles requêtes DB filtrent par `clinic_id`
- [ ] Toute nouvelle route a le middleware `extractClinic` (ou whitelist
      explicite si publique)
- [ ] Input utilisateur validé via Zod

## Performance / Observabilité

- [ ] Pas d'appel IA ajouté sans rate limit
- [ ] Pas de requête N+1 introduite
- [ ] Logs utiles (pas de `console.log`, utiliser `logger`)

## Rollback

<!-- Si merge a un impact (migration, breaking change), comment rollback ? -->

## Screenshots (si UI)

<!-- Avant / après. -->

---
<details>
<summary>Checklist reviewer</summary>

- [ ] Lire chaque diff, pas juste le résumé
- [ ] Vérifier cohérence `clinic_id` partout
- [ ] Vérifier tests ajoutés pour les chemins critiques
- [ ] Vérifier pas de fetch brut côté front (`apiJson()` attendu)
</details>
