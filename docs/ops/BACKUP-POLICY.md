# Politique de backup — Vet-AI-Consult

**Objectif** : pouvoir restaurer 100% des données clinique avec < 24h de perte acceptée (RPO 24h, RTO 4h).

---

## Périmètre

| Système | Backup | Rétention | Test restore |
|---|---|---|---|
| Postgres Railway (prod) | Oui (job CI `db-backup.yml`) | 30 jours rolling | **Trimestriel** |
| Uploads Google Cloud Storage | Versioning GCS + lifecycle | 90 jours versions | Manuel annuel |
| Code source | GitHub (public infra) | Illimité | N/A |
| DNS OVH zone | Snapshot mensuel via API OVH | 12 mois | Annuel |
| Secrets Railway | Coffre 1Password (manuel) | Illimité | Mise à jour post-rotation |

## 1. Backup DB Postgres

### Workflow existant
`.github/workflows/db-backup.yml` — lancé quotidiennement à 03:00 UTC, dump `pg_dump` vers S3 (ou équivalent).

**À vérifier** :
- Le secret `DATABASE_URL_BACKUP` est renseigné (user en lecture seule dédié)
- Le bucket de destination a la lifecycle rule de 30j
- Les dumps sont chiffrés at-rest

### Restore manuel
```bash
# 1. Télécharger le dump
aws s3 cp s3://veto-ai-backup/postgres/2026-04-23.sql.gz ./restore.sql.gz
gunzip restore.sql.gz

# 2. Créer une DB de restauration (JAMAIS écraser la prod)
createdb veto_restore

# 3. Restaurer
psql veto_restore < restore.sql

# 4. Valider les compteurs (nombre de consultations, de factures, etc.)
# avec un script de diff vs la DB actuelle
```

### Restore production (scénario catastrophe)
**NE JAMAIS** écraser directement la DB prod. Toujours :
1. Créer une nouvelle DB Railway vide
2. Restaurer dessus
3. Valider avec l'équipe
4. Basculer l'env `DATABASE_URL` prod sur la nouvelle
5. Garder l'ancienne en read-only 7 jours avant suppression

## 2. Uploads (Google Cloud Storage)

### Versioning
Le bucket `DEFAULT_OBJECT_STORAGE_BUCKET_ID` doit avoir :
- `Object versioning: enabled`
- `Lifecycle rule: noncurrent_version_age 90d → delete`

**À vérifier** dans GCS console.

### Restore fichier individuel
```bash
gsutil ls -a gs://<bucket>/<path>/    # liste versions
gsutil cp gs://<bucket>/<path>#<generation> ./restored.pdf
```

## 3. Zone DNS OVH

### Backup hebdomadaire (à scripter)
```bash
# Utilise l'API OVH same-origin depuis une session authentifiée,
# OU OVH API v1 avec clé application.
curl -H "Cookie: $OVH_SESSION" \
  https://manager.eu.ovhcloud.com/engine/apiv6/domain/zone/vetoai.fr/export \
  > "backups/dns-vetoai-$(date +%F).txt"
```

À automatiser via GitHub Actions cron hebdomadaire si possible (pas trivial à cause de l'auth OVH — cookie de session non-automatisable sans credentials plain text).

**Alternative** : dump manuel trimestriel, coller dans le repo sous `docs/dns-snapshots/`.

## 4. Tests de restore

**Trimestriel — calendrier** :
- T1 : avril
- T2 : juillet
- T3 : octobre
- T4 : janvier

### Procédure de test DB
1. Prendre le dump du jour précédent
2. Créer une DB Railway "staging-restore"
3. Restaurer dessus
4. Lancer un script de validation :
   - Nombre de rows par table vs snapshot de référence
   - `SELECT max(created_at) FROM consultations` → date proche de maintenant
   - `SELECT count(*) FROM portail_tokens WHERE revoked_at IS NULL`
5. Documenter le résultat dans `docs/restore-tests/YYYY-QN.md`

### Procédure de test uploads
1. Choisir 3 fichiers uploadés avec > 1 mois d'existence
2. Les supprimer (console GCS, simulation)
3. Les restaurer depuis la version précédente
4. Valider ouverture

## 5. Secrets Railway

**Rotation planifiée** :
- `CLERK_SECRET_KEY` — annuelle ou sur incident
- `ANTHROPIC_API_KEY` — semestrielle
- `RESEND_API_KEY` — annuelle
- `SESSION_SECRET` — change = invalide toutes les sessions, à faire en heures creuses

**Stockage** :
- 1Password coffre "Veto-AI" partagé si équipe > 1
- Jamais en clair dans un doc / messagerie / Notion

## 6. Disaster Recovery — checklist

Scénario : Railway disparaît, comptes GitHub compromis, équipe indisponible.

Préparation :
- [ ] Une copie des secrets hors Railway (1Password)
- [ ] Une copie du dernier dump DB sur un Drive personnel chiffré
- [ ] Les creds GCP en dehors de Railway (JSON key stocké en 1Password)
- [ ] Les docs `INCIDENT-RESPONSE.md` + ce fichier imprimés physiquement ou en PDF hors-ligne
- [ ] Un second DNS provider préconfiguré (ex : Cloudflare) avec les records prêts à activer

À revoir annuellement.
