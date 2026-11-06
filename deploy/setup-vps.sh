#!/usr/bin/env bash
# Cài đặt Trà Đá Xả Stress lên VPS Ubuntu 22.04/24.04 (chạy bằng root).
#   sudo bash deploy/setup-vps.sh  [email-nhan-thong-bao-ssl]
set -euo pipefail

DOMAIN=xastress.lopchungminh.net
APP_DIR=/opt/xastress
EMAIL=${1:-}
SRC_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "==> Cài gói hệ thống"
apt-get update
apt-get install -y curl ca-certificates gnupg build-essential python3 nginx sqlite3 ufw certbot python3-certbot-nginx rsync

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  echo "==> Cài Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> Tạo user hệ thống & chép mã nguồn"
id xastress >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin xastress
mkdir -p "$APP_DIR/data"
rsync -a --delete --exclude node_modules --exclude .git --exclude data --exclude .env "$SRC_DIR/" "$APP_DIR/"
cd "$APP_DIR"
npm ci --omit=dev

if [ ! -f "$APP_DIR/.env" ]; then
  cp .env.example .env
  sed -i "s|^PUBLIC_ORIGIN=.*|PUBLIC_ORIGIN=https://$DOMAIN|" .env
  echo "   -> Đã tạo $APP_DIR/.env (sửa ADMIN_USERNAMES để chỉ định quản trị viên)"
fi
chown -R xastress:xastress "$APP_DIR"
chmod 600 "$APP_DIR/.env"
chmod 700 "$APP_DIR/data"

echo "==> systemd"
cp deploy/xastress.service /etc/systemd/system/xastress.service
systemctl daemon-reload
systemctl enable --now xastress
systemctl restart xastress

echo "==> Nginx"
cp deploy/nginx-xastress.conf /etc/nginx/sites-available/xastress
ln -sf /etc/nginx/sites-available/xastress /etc/nginx/sites-enabled/xastress
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> Tường lửa"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> HTTPS (Let's Encrypt) – yêu cầu DNS A record của $DOMAIN đã trỏ về VPS"
if [ -n "$EMAIL" ]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || \
    echo "!! Chưa lấy được chứng chỉ. Kiểm tra DNS rồi chạy lại: certbot --nginx -d $DOMAIN"
else
  echo "   Bỏ qua (chưa truyền email). Chạy sau: certbot --nginx -d $DOMAIN --redirect"
fi

echo "==> Sao lưu hằng ngày lúc 3h sáng"
install -m 755 deploy/backup.sh /usr/local/bin/xastress-backup
echo "0 3 * * * root /usr/local/bin/xastress-backup" > /etc/cron.d/xastress-backup

echo "✅ Xong! Mở https://$DOMAIN"
systemctl --no-pager status xastress | head -5
