#!/usr/bin/env bash
# ============================================================================
#  backup-db.sh — Backup offsite chiffré de la DB prod vers GCS.
#
#  Usage (local ou CI) :
#    DATABASE_URL="postgres://..." \
#    BACKUP_BUCKET="gs://vetoai-backups" \
#    BACKUP_GPG_PASSPHRASE="..." \
#    ./scripts/backup-db.sh
#
#  Requis :
#    - pg_dump ≥ 15
#    - gpg
#    - gsutil authentifié (via gcloud auth ou service account dans
#      GOOGLE_APPLICATION_CREDENTIALS)
# ============================================================================
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL doit être défini}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET doit être défini (ex: gs://vetoai-backups)}"
: "${BACKUP_GPG_PASSPHRASE:?BACKUP_GPG_PASSPHRASE doit être défini}"

# Retention : nombre de jours de backups conservés.
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

timestamp=$(date -u +"%Y%m%d-%H%M%S")
dump_file="vetoai-${timestamp}.dump"
encrypted_file="${dump_file}.gpg"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

echo "[1/4] pg_dump vers ${tmp_dir}/${dump_file} …"
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --file="${tmp_dir}/${dump_file}" \
  --no-owner \
  --no-acl

dump_size=$(stat -c%s "${tmp_dir}/${dump_file}" 2>/dev/null || stat -f%z "${tmp_dir}/${dump_file}")
echo "    → dump pris (${dump_size} octets)"

echo "[2/4] chiffrement GPG symétrique (AES256) …"
echo "$BACKUP_GPG_PASSPHRASE" | gpg \
  --batch --yes \
  --passphrase-fd 0 \
  --symmetric \
  --cipher-algo AES256 \
  --output "${tmp_dir}/${encrypted_file}" \
  "${tmp_dir}/${dump_file}"

# On ne garde plus le dump non chiffré
rm -f "${tmp_dir}/${dump_file}"

enc_size=$(stat -c%s "${tmp_dir}/${encrypted_file}" 2>/dev/null || stat -f%z "${tmp_dir}/${encrypted_file}")
echo "    → chiffré (${enc_size} octets)"

echo "[3/4] upload vers ${BACKUP_BUCKET}/daily/${encrypted_file} …"
gsutil cp "${tmp_dir}/${encrypted_file}" "${BACKUP_BUCKET}/daily/${encrypted_file}"

echo "[4/4] purge des backups plus vieux que ${RETENTION_DAYS} jours …"
# Note : on ne supprime PAS via "gsutil rm" en boucle, on utilise un lifecycle
# policy sur le bucket (plus sûr). Si pas de lifecycle configuré, loop suivant :
cutoff_ts=$(date -u -d "${RETENTION_DAYS} days ago" +%s 2>/dev/null || \
            date -u -v-"${RETENTION_DAYS}"d +%s)
gsutil ls -l "${BACKUP_BUCKET}/daily/" | awk 'NR>1 && /vetoai-/ {print $2" "$3}' | while read -r created uri; do
  # created au format 2026-04-23T03:00:00Z
  created_ts=$(date -u -d "$created" +%s 2>/dev/null || date -u -jf "%Y-%m-%dT%H:%M:%SZ" "$created" +%s)
  if [[ -n "$created_ts" ]] && [[ "$created_ts" -lt "$cutoff_ts" ]]; then
    echo "    → suppression $uri (créé $created)"
    gsutil rm "$uri"
  fi
done

echo "OK — backup ${encrypted_file} poussé."
echo
echo "Pour restaurer :"
echo "  gsutil cp ${BACKUP_BUCKET}/daily/${encrypted_file} ."
echo "  echo \$BACKUP_GPG_PASSPHRASE | gpg --batch --passphrase-fd 0 --decrypt ${encrypted_file} > restore.dump"
echo "  createdb vetoai_restore"
echo "  pg_restore --dbname=vetoai_restore --no-owner --no-acl restore.dump"
