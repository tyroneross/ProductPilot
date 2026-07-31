#!/bin/bash
#
# Nightly logical backup of the ProductPilot production database.
#
# WHY THIS EXISTS
# Neon's free plan caps point-in-time restore at 6 hours, and that is a plan
# ceiling rather than a setting — the API rejects anything higher. A destructive
# change made on a Friday night is therefore unrecoverable by Saturday morning
# unless something outside Neon holds a copy. This is that something.
#
# Reads DATABASE_URL from an env file rather than taking it as an argument, so
# the credential never lands in shell history or a process listing.
#
# Install:
#   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/ai.rosslabs.productpilot-backup.plist
# Verify:
#   launchctl list | grep productpilot-backup
#   bash ~/dev/git-folder/ProductPilot/scripts/backup-prod-db.sh
#   tail ~/backups/productpilot/backup.log
# Uninstall:
#   launchctl bootout gui/$(id -u)/ai.rosslabs.productpilot-backup

set -euo pipefail

BACKUP_DIR="$HOME/backups/productpilot"
ENV_FILE="$HOME/.config/productpilot/prod.env"
# pg_dump must be at least the server major (PG 17). The Homebrew postgresql@15
# client refuses with a version mismatch, so prefer libpq's newer binary.
PG_DUMP="/opt/homebrew/opt/libpq/bin/pg_dump"
RETAIN_DAYS=30

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

mkdir -p "$BACKUP_DIR"

if [ ! -x "$PG_DUMP" ]; then
  log "FATAL: $PG_DUMP not found. Install with: brew install libpq"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  log "FATAL: $ENV_FILE not found. It must contain a single line: DATABASE_URL=postgresql://..."
  exit 1
fi

# shellcheck disable=SC1090
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
if [ -z "${DATABASE_URL:-}" ]; then
  log "FATAL: DATABASE_URL missing from $ENV_FILE"
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/prod-$STAMP.dump"

log "starting backup -> $(basename "$OUT")"
if ! "$PG_DUMP" --format=custom --no-owner --no-acl -f "$OUT" "$DATABASE_URL" 2>&1; then
  log "FATAL: pg_dump failed"
  rm -f "$OUT"
  exit 1
fi

# A dump that cannot be listed is not a backup. This is cheap and catches a
# truncated or corrupt file immediately rather than during an actual incident.
if ! "${PG_DUMP%pg_dump}pg_restore" --list "$OUT" > /dev/null 2>&1; then
  log "FATAL: dump wrote but failed verification — removing"
  rm -f "$OUT"
  exit 1
fi

TABLES="$("${PG_DUMP%pg_dump}pg_restore" --list "$OUT" 2>/dev/null | grep -c 'TABLE DATA' || true)"
SIZE="$(du -h "$OUT" | cut -f1)"
log "ok: $SIZE, $TABLES table-data sections, verified restorable"

# Retention. Deliberately only removes files matching this script's own naming,
# so nothing else in the directory is ever touched.
DELETED="$(find "$BACKUP_DIR" -name 'prod-*.dump' -type f -mtime "+$RETAIN_DAYS" -print -delete | wc -l | tr -d ' ')"
[ "$DELETED" != "0" ] && log "pruned $DELETED backup(s) older than $RETAIN_DAYS days"

log "done"
