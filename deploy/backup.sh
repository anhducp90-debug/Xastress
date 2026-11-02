#!/usr/bin/env bash
# Sao lưu SQLite an toàn khi đang chạy (dùng .backup), giữ 14 bản gần nhất.
set -euo pipefail
APP_DIR=/opt/xastress
DEST=/var/backups/xastress
mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M)
sqlite3 "$APP_DIR/data/xastress.db" ".backup '$DEST/xastress-$STAMP.db'"
gzip -f "$DEST/xastress-$STAMP.db"
ls -1t "$DEST"/xastress-*.db.gz | tail -n +15 | xargs -r rm --
