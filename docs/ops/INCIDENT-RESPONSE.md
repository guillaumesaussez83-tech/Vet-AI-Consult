# Runbook Incidents — Vet-AI-Consult

**Audience** : Guillaume + futurs co-mainteneurs
**Doctrine** : réagir vite, préserver les données, communiquer tôt.

---

## Principes généraux

1. **Stabiliser avant de comprendre** — rollback d'abord, investigation ensuite.
2. **Préserver les preuves** — snapshot DB, exports logs Railway, captures Sentry **avant** toute action corrective destructive.
3. **Communiquer tôt** — mieux vaut un "on regarde, plus d'info dans 15 min" qu'un silence d'1h.
4. **Une seule personne pilote** — incident commander = celui qui a lancé la réponse. Les autres exécutent ou observent.

---

## Inventaire des scénarios couverts

1. Base de données Postgres (Railway) en panne
2. Railway 503 / déploiement cassé
3. Clerk Auth down (domaine custom ou service global)
4. Fuite de données suspectée
5. Rupture réseau côté Anthropic (IA inaccessible)
6. DNS OVH injoignable / erreur de config

---

## Scénario 1 — Postgres down

### Détection
- Issue GitHub `uptime-alert` avec `/api/healthz` 503
- Flood d'erreurs Sentry `PGError: connection terminated`
- Users remontent "page qui tourne"

### Contenance immédiate (0–5 min)
- Confirmer via Railway dashboard → service Postgres → onglet Metrics
- Vérifier status Railway global : https://status.railway.com
- Si DB présumé UP mais timeout : vérifier le nombre de connexions — si saturé, augmenter le pool côté `DATABASE_URL` ou scaler le plan Postgres

### Mitigation
- **Cas A — service Postgres stoppé** : redémarrer depuis Railway UI
- **Cas B — saturation connexions** : bouncer les requêtes en ajoutant temporairement un 503 sur les endpoints d'écriture (feature flag à prévoir)
- **Cas C — panne Railway globale** : attendre — rien à faire, communiquer aux users un bandeau d'indisponibilité (via page statique fallback à prévoir)

### Post-mortem
- Dump des logs Railway de la fenêtre
- Check dernière migration appliquée (peut-être un lock resté actif)
- Si `pg_stat_activity` révèle des requêtes bloquées > 5 min : investigation N+1 ou query runaway

### Communication
- Bandeau user "Un incident technique est en cours, reprise imminente" dès 5 min de panne
- Email propriétaires portail si > 30 min
- Post-mortem public (blog / changelog) si > 2h

---

## Scénario 2 — Railway 503 sur app.vetoai.fr

### Détection
- `/api/healthz` ne répond plus du tout (timeout ou 503 au lieu de 200)
- Tous les users affectés simultanément

### Causes probables (par fréquence)
1. Dernier déploiement en build fail ou crash au démarrage → Railway rollback automatique souvent insuffisant
2. Variable d'environnement manquante (SENTRY_DSN, CLERK_SECRET_KEY, ANTHROPIC_API_KEY)
3. Quota Railway dépassé (plan hobby)

### Contenance
- Railway UI → onglet **Deployments** → identifier la ligne rouge
- Cliquer le deployment précédent → **Redeploy** (rollback)
- Ouvrir les logs du build failed pour diagnostic

### Mitigation
- Si rollback OK → corriger le bug sur une branche, PR, redeploy
- Si rollback échoue aussi (ex : bug corruptif dans DB schema) → `git revert` du commit coupable sur `main`, push, nouveau build

### Prévention
- CI `.github/workflows/ci.yml` qui fait `pnpm typecheck && pnpm build` sur chaque PR
- Branch protection main : require CI green + 1 approval (même si seul, pour forcer la discipline)
- Preview deployments Railway activés

---

## Scénario 3 — Clerk Auth down

### Détection
- Users ne peuvent plus se connecter
- Console browser : `clerk.vetoai.fr/...` 503 ou timeout
- Sentry backend : `Clerk: Unable to verify session`

### Sous-scénarios

#### 3.1 Domaine custom Clerk en 0/5 Verified (situation actuelle avril 2026)
- DNS propagé correctement côté OVH (vérifier `dig clerk.vetoai.fr CNAME`)
- Dashboard Clerk → Domains → cliquer "Verify configuration"
- Si bloqué : ticket Clerk support via https://clerk.com/contact/support
- **Fallback user** : l'app continue de servir mais Clerk ne charge pas → les users voient la landing sans pouvoir login. Pas de fix rapide, c'est côté Clerk.

#### 3.2 Clerk panne globale
- Vérifier https://status.clerk.com
- Communication publique obligatoire (les users ne peuvent rien faire)
- **Patience** — Clerk a un SLA enterprise, panne < 1h généralement

#### 3.3 Clé secrète révoquée
- `CLERK_SECRET_KEY` régénérée par erreur dans le dashboard ?
- Récupérer la clé active, la re-pousser en Railway env, redéployer

### Communication
- Page `/status` côté app qui interroge `/api/healthz` et affiche "Auth indisponible" si Clerk UP mais session fail
- Twitter / message propriétaires si > 30 min

---

## Scénario 4 — Fuite de données suspectée

### Déclencheurs
- Alerte sécurité (ex : gitleaks scheduled run trouve un secret committé)
- User rapporte avoir vu les données d'un autre user (cross-tenant leak)
- Tentatives brute force visibles dans les logs

### Actions immédiates (ordre strict)
1. **Isoler** — désactiver la route/feature suspecte par feature flag ou `res.status(503)` forcé
2. **Préserver** — snapshot Postgres + export logs Railway + export Sentry events
3. **Mesurer l'ampleur** — requêtes SQL pour dénombrer les accès suspects (`SELECT * FROM portail_tokens WHERE last_accessed > X`)
4. **Roter** — **toutes** les clés exposées :
   - `CLERK_SECRET_KEY` (nouveau dans dashboard Clerk, update Railway env)
   - `ANTHROPIC_API_KEY`
   - `RESEND_API_KEY`
   - tokens portail potentiellement leakés (invalider en masse via `UPDATE portail_tokens SET revoked_at = NOW()`)
5. **Notifier** — obligation RGPD : CNIL dans les 72h si données personnelles affectées (voir RGPD-CHECKLIST.md)

### Ne pas faire
- Ne pas supprimer les logs même si "ça fait peur" → obligation de conservation pour l'enquête
- Ne pas tweeter avant d'avoir une vraie estimation de l'ampleur

### Responsabilités légales
- Guillaume = DPO de fait (petite structure). Déclaration CNIL obligatoire si données personnelles.
- Garder trace écrite datée de chaque action (timeline de l'incident)

---

## Scénario 5 — Anthropic IA indisponible

### Détection
- Sentry : pics d'erreurs sur `/api/ai/*`
- 429, 500, 502 ou timeouts depuis `api.anthropic.com`

### Mitigation côté app
- Les fonctions IA doivent déjà retourner un message d'erreur utilisateur clair, pas planter l'UI
- **À implémenter** si ce n'est pas fait : circuit breaker (5 échecs consécutifs → désactiver les boutons IA pour 5 min)
- **À implémenter** : fallback template pour les ordonnances les plus communes (pas de dépendance IA totale)

### Status Anthropic
- https://status.anthropic.com
- Les pannes partielles sont fréquentes (50% des erreurs sur 5 min est normal)

---

## Scénario 6 — DNS OVH

### Détection
- `dig app.vetoai.fr` ne résout plus
- Users rapportent "Site inaccessible"

### Actions
1. OVH manager : https://manager.eu.ovhcloud.com/#/web/domain/vetoai.fr/dns
2. Vérifier les records A/AAAA de `app` (doit pointer sur Railway edge)
3. Vérifier les 5 CNAMEs Clerk (clerk, accounts, clkmail, clk._domainkey, clk2._domainkey)
4. Si zone corrompue : restauration via OVH API avec snapshot récent

### Prévention
- Backup hebdomadaire de la zone DNS (export JSON via OVH API) — à scripter
- Documenter les records attendus dans `docs/DNS.md`

---

## Checklist incident commander

Pour chaque incident, tenir un log timestampé :

```
[HH:MM] Détection — source, symptôme exact
[HH:MM] Confirmation — tests reproductibles
[HH:MM] Contenance — ce qui a été fait
[HH:MM] Mitigation — état après action
[HH:MM] Résolution — comment on sait que c'est fini
[HH:MM] Communication — ce qui a été dit aux users
```

Template rapide dans Notes de l'iPhone ou un fichier texte local. Ne pas reporter l'écriture.

---

## Post-mortem (pour tout incident > 30 min ou data leak suspecté)

Structure attendue (Google Doc partagé ou fichier repo) :
1. **Résumé** : 2 phrases max
2. **Timeline** : copie du log ci-dessus
3. **Impact** : users affectés, durée, données exposées
4. **Root cause** : pas "qui a fait ça" mais "quel maillon a manqué"
5. **Action items** : 3 à 5 max, avec owner + deadline
6. **Bien fait / à améliorer** : 1 à 3 items chaque

Partager à l'équipe dans les 5 jours ouvrés.
