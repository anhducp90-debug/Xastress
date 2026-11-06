# 🐳 Triển khai bằng Docker (VPS đã có sẵn container khác)

Hướng dẫn này dành cho VPS **đang chạy sẵn các container cho tên miền khác**. Quán chạy trong **1 container riêng tên `xastress`**, không đụng tới các container cũ:

- Container quán **không chiếm cổng 80/443**. Nó chỉ mở cổng `127.0.0.1:3100` cho chính VPS.
- **Reverse proxy đang phục vụ 2 tên miền cũ** sẽ được thêm tên miền `xastress.lopchungminh.net` và chuyển tiếp vào container quán.
- Dữ liệu (CSDL SQLite và khoá mã hoá) nằm ở thư mục `/opt/xastress/data` trên VPS, nên build lại hay xoá container cũng không mất dữ liệu.

```
Internet ──► :80/:443  Reverse proxy có sẵn (Nginx / Nginx Proxy Manager / Traefik / Caddy…)
                ├── domain-cu-1.com  ──► container 1
                ├── domain-cu-2.com  ──► container 2
                └── xastress.lopchungminh.net ──► container xastress (:3000)
```

---

## Bước 0 – Xem VPS đang dùng reverse proxy gì

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
sudo ss -tlnp | grep -E ':(80|443)\s'
```

| Bạn thấy gì | Đang dùng | Làm theo |
|---|---|---|
| `ss` báo cổng 80/443 thuộc tiến trình `nginx` (không phải `docker-proxy`) | Nginx cài thẳng trên VPS | **Cách A** |
| Có container image `jc21/nginx-proxy-manager` | Nginx Proxy Manager (giao diện web, cổng 81) | **Cách B** |
| Có container `nginxproxy/nginx-proxy` hoặc `jwilder/nginx-proxy`, thường kèm `acme-companion` | nginx-proxy tự động | **Cách C** |
| Có container `traefik` | Traefik | **Cách D** |
| Có container `caddy` | Caddy | **Cách E** |
| Một container web cũ tự giữ luôn `0.0.0.0:80->80` và `443` | Không có proxy chung | **Cách F** |

---

## Bước 1 – Trỏ DNS

Tại nơi quản lý DNS của `lopchungminh.net`, thêm bản ghi:

```
A    xastress    <IP của VPS>
```

Nếu dùng Cloudflare, để chế độ **DNS only** (đám mây xám) lúc xin chứng chỉ HTTPS lần đầu. Kiểm tra bằng `ping xastress.lopchungminh.net` (phải ra IP của VPS).

## Bước 2 – Lấy mã nguồn và cấu hình

```bash
sudo git clone <địa chỉ repo> /opt/xastress
cd /opt/xastress
sudo git checkout ccr-b4bef78c-vaazic      # hoặc nhánh main sau khi gộp
sudo cp .env.example .env
sudo nano .env
```

Trong `.env`, tối thiểu cần sửa:

```ini
PUBLIC_ORIGIN=https://xastress.lopchungminh.net
ADMIN_USERNAMES=ten_dang_nhap_cua_ban
APP_SECRET=<chuỗi ngẫu nhiên, tạo bằng: openssl rand -hex 32>
# tuỳ chọn: ANTHROPIC_API_KEY=..., TELEGRAM_BOT_TOKEN=..., TELEGRAM_BOT_USERNAME=...
```

Các dòng `HOST`, `PORT`, `DB_PATH`, `TRUST_PROXY` không cần sửa, vì `docker-compose.yml` đã đặt sẵn giá trị đúng cho container.

Container chạy bằng user `node` (uid 1000), nên thư mục dữ liệu phải thuộc uid này:

```bash
sudo mkdir -p data && sudo chown -R 1000:1000 data
sudo chmod 600 .env
```

Nếu cổng 3100 đã có dịch vụ khác dùng, thêm dòng `XASTRESS_PORT=3200` (hoặc cổng trống khác) vào `.env`.

## Bước 3 – Build và chạy container

```bash
cd /opt/xastress
sudo docker compose up -d --build
sudo docker compose ps                 # STATUS phải là "Up … (healthy)" sau khoảng 30 giây
curl http://127.0.0.1:3100/api/health  # {"ok":true}
```

Lần build đầu mất vài phút, vì phải biên dịch `better-sqlite3`.

---

## Bước 4 – Nối tên miền vào reverse proxy có sẵn

### Cách A – Nginx cài trên VPS

```bash
sudo nano /etc/nginx/sites-available/xastress
```

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    listen 80;
    listen [::]:80;
    server_name xastress.lopchungminh.net;
    access_log off;                     # không ghi IP người dùng
    client_max_body_size 64k;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;            # WebSocket cho chat/nhân vật
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_buffering off;                               # để Cô Tư AI trả lời từng chữ
    }
}
```

> Nếu `sudo nginx -t` báo `duplicate "map"` (một site khác đã khai báo `$connection_upgrade`), xoá dòng `map …` ở file này.

```bash
sudo ln -s /etc/nginx/sites-available/xastress /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d xastress.lopchungminh.net --redirect     # xin HTTPS
```

### Cách B – Nginx Proxy Manager

1. Cho container quán vào cùng mạng Docker với NPM. Xem tên mạng bằng `docker inspect <tên container NPM> --format '{{json .NetworkSettings.Networks}}'`, rồi tạo file `/opt/xastress/docker-compose.override.yml` (thay `npm_default` bằng tên mạng thật):
   ```yaml
   services:
     xastress:
       networks: [default, proxy]
   networks:
     proxy:
       external: true
       name: npm_default
   ```
   Sau đó chạy `sudo docker compose up -d`.
2. Mở giao diện NPM (`http://<IP VPS>:81`) → **Hosts → Proxy Hosts → Add Proxy Host** và điền:
   - Domain Names: `xastress.lopchungminh.net`
   - Scheme `http`, Forward Hostname **`xastress`**, Forward Port **`3000`**
   - ✅ **Websockets Support**, ✅ Block Common Exploits
   - Tab **SSL**: Request a new SSL Certificate, ✅ Force SSL, ✅ HTTP/2
3. Tab **Advanced** (để AI trả lời từng chữ): `proxy_buffering off;`

### Cách C – nginx-proxy + acme-companion

Tạo `/opt/xastress/docker-compose.override.yml` (thay `nginx-proxy` bằng tên mạng mà container proxy đang dùng):

```yaml
services:
  xastress:
    environment:
      VIRTUAL_HOST: xastress.lopchungminh.net
      VIRTUAL_PORT: 3000
      LETSENCRYPT_HOST: xastress.lopchungminh.net
    networks: [default, proxy]
networks:
  proxy:
    external: true
    name: nginx-proxy
```

Rồi chạy `sudo docker compose up -d`. Chứng chỉ HTTPS sẽ được cấp tự động sau khoảng 1 phút.

### Cách D – Traefik

Tạo `/opt/xastress/docker-compose.override.yml`. Thay `traefik` bằng tên mạng của Traefik; thay `websecure` và `letsencrypt` bằng tên entrypoint và certresolver trong cấu hình Traefik của bạn:

```yaml
services:
  xastress:
    labels:
      - traefik.enable=true
      - traefik.docker.network=traefik
      - traefik.http.routers.xastress.rule=Host(`xastress.lopchungminh.net`)
      - traefik.http.routers.xastress.entrypoints=websecure
      - traefik.http.routers.xastress.tls.certresolver=letsencrypt
      - traefik.http.services.xastress.loadbalancer.server.port=3000
    networks: [default, traefik]
networks:
  traefik:
    external: true
```

### Cách E – Caddy

Cho container quán vào mạng của Caddy (giống bước 1 của Cách B), rồi thêm vào `Caddyfile`:

```
xastress.lopchungminh.net {
    reverse_proxy xastress:3000 {
        flush_interval -1
    }
}
```

Sau đó chạy `docker exec <tên container caddy> caddy reload --config /etc/caddy/Caddyfile`. Caddy tự xin HTTPS.

### Cách F – Không có proxy chung (một container cũ tự giữ cổng 80/443)

Hai thứ không thể cùng nghe cổng 80/443. Có 2 lựa chọn:

1. **Nhanh:** thêm khối `server { … }` như **Cách A** vào cấu hình Nginx bên trong container đang giữ cổng 80/443. Trong đó, `proxy_pass` trỏ tới `http://172.17.0.1:3100` (IP của VPS nhìn từ trong container); khi đó cần sửa `ports` trong `docker-compose.yml` thành `"172.17.0.1:3100:3000"`. Cách khác là nối hai container chung mạng rồi dùng `http://xastress:3000`.
2. **Gọn về lâu dài:** dựng Nginx Proxy Manager làm proxy chung cho cả 3 tên miền, rồi đổi 2 container cũ sang chỉ mở cổng nội bộ. Việc này cần dừng site cũ vài phút, nên làm vào giờ vắng.

---

## Bước 5 – Kiểm tra và cài đặt trong quán

1. Mở `https://xastress.lopchungminh.net` → đăng ký tài khoản có tên trùng `ADMIN_USERNAMES` → nút 🛡️ mở trang quản trị.
2. **🤖 AI cho Cô Tư**: dán khoá API, chọn model, bấm *Thử gọi AI*.
3. **💳 Thanh toán → Cài đặt**: nhập ngân hàng và số tài khoản. Webhook SePay: `https://xastress.lopchungminh.net/api/pay/webhook/sepay`.
4. Nếu chat hoặc nhân vật không cập nhật, tức là proxy chưa bật WebSocket (xem lại cấu hình ở Bước 4).

## Vận hành hằng ngày

```bash
cd /opt/xastress
sudo docker compose logs -f --tail=100        # xem log
sudo docker compose restart                   # khởi động lại (sau khi sửa .env)

# Cập nhật phiên bản mới
sudo git pull && sudo docker compose up -d --build && sudo docker image prune -f

# Sao lưu CSDL khi quán đang chạy → /opt/xastress/data/backups (giữ 14 bản)
sudo docker exec xastress node deploy/docker-backup.js
```

Để sao lưu tự động mỗi ngày lúc 3 giờ sáng, chạy `sudo crontab -e` và thêm dòng:

```
0 3 * * * docker exec xastress node deploy/docker-backup.js >> /var/log/xastress-backup.log 2>&1
```

> ⚠️ Nên chép thêm thư mục `/opt/xastress/data` (gồm cả file `.secret` nếu không đặt `APP_SECRET`) ra ngoài VPS. Mất khoá mã hoá thì các khoá API đã lưu trong trang quản trị không giải mã được, phải nhập lại.

**Gỡ bỏ:** `sudo docker compose down` (dữ liệu trong `data/` vẫn còn). Nếu đã làm Cách A, xoá thêm file trong `/etc/nginx/sites-enabled/`.
