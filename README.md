# ☕ Trà Đá Xả Stress — xastress.info.vn

Quán trà đá vỉa hè online theo phong cách game 2D pixel (kiểu nông trại vui vẻ).
Mọi người vào quán với **một danh tính riêng, ẩn danh**, ngồi vào các bàn theo chủ đề để
kể chuyện ức chế về công việc, gia đình, tình cảm, học hành, tiền bạc, cuộc sống…
và nhận về sự **đồng cảm, chia sẻ, cổ vũ** từ những người khác.

## Tính năng

**Không gian quán (2D, realtime)**
- Phố nhà ống Hà Nội/Sài Gòn, vỉa hè lát gạch, cây bàng lá đỏ rơi, dây bóng đèn, ghế nhựa xanh đỏ, xe máy chạy ngoài đường, mèo vàng đi lang thang.
- **Cô Tư chủ quán** (đội nón lá) đứng ở quầy với ấm trà, phích đỏ, lọ kẹo lạc. Có thể trò chuyện, nghe lời an ủi, tập **thở cùng cô** (hít 4 – giữ 4 – thở 6).
- **Ngày / đêm theo giờ Việt Nam**: tối đến đèn đường, đèn dây, cửa sổ các nhà sáng lên.
- Thấy những người khác đi lại, ngồi ghế; chat bong bóng và biểu cảm (👋 🤗 ❤️ 💪 🍵).
- Điều khiển: WASD / phím mũi tên, hoặc nhấp/chạm để đi (tự tìm đường). Lại gần bàn bấm **E** để ngồi.

**6 bàn = 6 chủ đề:** 💼 Công Việc · 🏠 Gia Đình · 💔 Tình Cảm · 📚 Học Hành · 💸 Cơm Áo Gạo Tiền · 🌧️ Chuyện Đời.
Mỗi tâm sự mới là một ly trà đá đặt lên bàn.

**Tâm sự & cổ vũ**
- Kể chuyện kèm tâm trạng (mệt mỏi, buồn, bực tức, lo âu, chán nản, áp lực), mặc định **ẩn danh hoàn toàn**.
- Người khác bày tỏ 🫂 Đồng cảm · 💪 Cố lên · ❤️ Thương và gửi lời động viên (có gợi ý câu sẵn).
- Thông báo realtime khi có người động viên mình.
- Khi đã ổn hơn, đánh dấu **✨ Đã vượt qua** để truyền cảm hứng.

**Danh tính riêng & bảo mật**
- Không cần email/số điện thoại. Chỉ cần tên đăng nhập (bí mật, không bao giờ hiển thị) + mật khẩu + biệt danh công khai + nhân vật tự thiết kế (màu da, tóc, áo, quần, nón lá/mũ).
- Bài ẩn danh: API không bao giờ trả về id/biệt danh tác giả; chủ bài trả lời bình luận cũng hiện là “Người kể chuyện”.
- Mật khẩu băm bcrypt; phiên đăng nhập là token ngẫu nhiên lưu dạng SHA‑256, cookie `HttpOnly` + `SameSite` + `Secure`.
- Chống CSRF (kiểm tra Origin + yêu cầu JSON/header riêng), CSP chặt, giới hạn tần suất đăng nhập/đăng bài/bình luận/chat.
- Nginx tắt access log → không lưu IP người dùng.
- Người dùng có thể **xoá tài khoản cùng toàn bộ dữ liệu** bất cứ lúc nào.

**An toàn cộng đồng**
- Lọc từ ngữ thô tục (che bằng `*`), nội quy quán, nút 🚩 báo cáo; nội dung bị 3 người báo cáo tự động ẩn.
- Phát hiện từ khoá khủng hoảng (tự tử, muốn chết…) → hiện ngay thông tin đường dây hỗ trợ (115, 113, Ngày Mai 096 306 1414, 111).
- Trang quản trị cho admin: xem báo cáo, ẩn/hiện nội dung, khoá tài khoản vi phạm.

## Công nghệ

- **Backend:** Node.js ≥ 20, Express 5, Socket.IO 4, SQLite (better-sqlite3, chế độ WAL).
- **Frontend:** HTML/CSS/JS thuần (ES modules), Canvas 2D. Toàn bộ pixel‑art được **vẽ bằng code** — không cần file ảnh, không phụ thuộc CDN.

```
server/
  index.js        Express, bảo mật, khởi động
  auth.js         Đăng ký, đăng nhập, phiên, hồ sơ, xoá tài khoản
  posts.js        Tâm sự, cảm xúc, bình luận, báo cáo, thông báo, quản trị
  realtime.js     Socket.IO: vị trí nhân vật, chat, biểu cảm
  moderation.js   Lọc từ ngữ, phát hiện khủng hoảng
  db.js           Lược đồ SQLite
public/
  index.html, css/style.css
  js/sprites.js   Pixel-art nhân vật & đồ vật
  js/world.js     Bản đồ quán, va chạm, tìm đường
  js/game.js      Vòng lặp game, camera, ngày/đêm
  js/main.js      Giao diện, API, realtime
deploy/           Nginx, systemd, script cài VPS, sao lưu
test/             Kiểm thử API (node --test)
```

## Chạy thử trên máy

```bash
npm install
npm run dev          # http://127.0.0.1:3000
npm test
```

## Triển khai lên VPS (Ubuntu 22.04 / 24.04)

1. **Trỏ DNS**: tại nhà cung cấp tên miền `.info.vn`, tạo bản ghi
   `A  xastress.info.vn  → <IP VPS>` và `A  www.xastress.info.vn → <IP VPS>`.
2. **Đưa mã nguồn lên VPS** và chạy script:
   ```bash
   git clone <repo> xastress && cd xastress
   sudo bash deploy/setup-vps.sh email-cua-ban@example.com
   ```
   Script sẽ: cài Node 22, Nginx, Certbot; tạo user hệ thống `xastress`; cài vào `/opt/xastress`;
   chạy dịch vụ systemd `xastress`; cấu hình Nginx (WebSocket); bật tường lửa UFW;
   lấy chứng chỉ HTTPS Let's Encrypt; sao lưu CSDL mỗi ngày lúc 3h vào `/var/backups/xastress`.
3. **Chỉ định quản trị viên**: sửa `/opt/xastress/.env` → `ADMIN_USERNAMES=ten_dang_nhap_cua_ban`,
   rồi `sudo systemctl restart xastress` và đăng nhập lại.

> Ở chế độ `NODE_ENV=production`, cookie đăng nhập có cờ `Secure` nên **bắt buộc truy cập qua HTTPS**.

**Cập nhật phiên bản mới**
```bash
cd ~/xastress && git pull && sudo bash deploy/setup-vps.sh
```
(script giữ nguyên `.env` và dữ liệu trong `/opt/xastress/data`).

**Lệnh hữu ích**
```bash
sudo systemctl status xastress        # trạng thái
sudo journalctl -u xastress -f        # xem log
sudo /usr/local/bin/xastress-backup   # sao lưu ngay
```

VPS tối thiểu: 1 vCPU, 1 GB RAM là đủ cho vài trăm người cùng lúc.

## Lưu ý

Trà Đá Xả Stress là cộng đồng chia sẻ, **không thay thế bác sĩ hay chuyên gia tâm lý**.
Số đường dây nóng trong `public/js/main.js` nên được kiểm tra lại định kỳ.
