# ☕ Trà Đá Xả Stress — xastress.lopchungminh.net

Quán trà đá vỉa hè online trong một **góc phố Việt Nam 3D** (WebGL), phong cách hoạt hình low‑poly ấm áp.
Mọi người vào quán với **một danh tính riêng, ẩn danh**, ngồi vào các bàn theo chủ đề để
kể chuyện ức chế về công việc, gia đình, tình cảm, học hành, tiền bạc, cuộc sống…
và nhận về sự **đồng cảm, chia sẻ, cổ vũ** từ những người khác.

## Tính năng

**Không gian quán (3D, realtime)**
- Dãy nhà ống cửa chớp xanh, ban công hoa giấy, cờ đỏ sao vàng bay, bồn nước inox; biển hiệu tạp hoá, sửa xe – vá xe, cắt tóc, phở bò, cơm bình dân.
- Vỉa hè gạch đỏ, gốc cây quét vôi, cây bàng và phượng vĩ rụng lá/hoa, cột điện dây chằng chịt, đèn cao áp, dây bóng đèn tròn, ghế nhựa xanh đỏ.
- Cô gánh hàng rong rao hàng, bác xe ôm đội mũ cối, xe máy chở người/hàng/hoa, xe đạp chở hoa, nồi phở bốc khói, mèo vàng.
- Nhân vật 3D chibi tự thiết kế (da, tóc, áo, quần, nón lá/mũ), có dáng đi, ngồi ghế nhựa; camera bám theo, lăn chuột hoặc chụm 2 ngón để phóng to/thu nhỏ.
- Máy không hỗ trợ WebGL tự chuyển sang bản 2D pixel nhẹ; có thể ép dùng 2D bằng cách mở `https://xastress.lopchungminh.net/?2d`.
- **Cô Tư chủ quán** (đội nón lá) đứng ở quầy với ấm trà, phích đỏ, lọ kẹo lạc. Có thể trò chuyện, nghe lời an ủi, tập **thở cùng cô** (hít 4 – giữ 4 – thở 6).
- **Ngày / đêm theo giờ Việt Nam**: tối đến đèn đường, đèn dây, cửa sổ các nhà sáng lên.
- Thấy những người khác đi lại, ngồi ghế; chat bong bóng và biểu cảm (👋 🤗 ❤️ 💪 🍵).
- Điều khiển: WASD / phím mũi tên, hoặc nhấp/chạm để đi (tự tìm đường). Lại gần bàn bấm **E** để ngồi.

**6 bàn = 6 chủ đề:** 💼 Công Việc · 🏠 Gia Đình · 💔 Tình Cảm · 📚 Học Hành · 💸 Cơm Áo Gạo Tiền · 🌧️ Chuyện Đời.
Mỗi tâm sự mới là một ly trà đá đặt lên bàn.

**🧋 Menu nước quán Cô Tư – mỗi món một cách giải toả stress**
| Món | Dành cho lúc | Hoạt động |
|---|---|---|
| 🧊 Trà đá vỉa hè | Bực mình | Viết hết ra rồi *đổ đi* (không lưu gì) hoặc đặt lên bàn chia sẻ |
| 🫚 Trà gừng ấm | Lo âu, hồi hộp | 1 phút thở theo vòng tròn: hít 4 – giữ 4 – thở 6 |
| 🍈 Nước sấu đá | Rối trí | Kéo mình về hiện tại bằng 5 giác quan (5-4-3-2-1) |
| ☕ Cà phê đen đá | Ngập việc | Ghi mối lo, chia thành 3 việc nhỏ làm được hôm nay |
| 🥛 Sữa đậu nành nóng | Buồn, tự trách | Lời dịu dàng của Cô Tư + "lọ điều tốt" ghi việc mình đã làm được |
| 🥥 Nước dừa tươi | Mệt rã rời | 2 phút nghỉ, thả lỏng cơ thể từng bước |
| 🍋 Trà chanh chém gió | Chán chường | Chuyện phiếm vỉa hè cho vui |
| 🎋 Nước mía mời bạn | Muốn giúp người khác | Mời một ly nước cho người đang buồn – họ nhận thông báo |

Chọn tâm trạng để Cô Tư gợi ý món. Gọi xong, Cô Tư đáp lời và nhân vật cầm ly nước trên tay cho cả quán thấy.
Kế hoạch và "lọ điều tốt" chỉ lưu trong trình duyệt của người dùng, không gửi lên máy chủ.

**🍵 Cô Tư hoạt náo – người giữ lửa cho quán**
- **Chào khách** mới vào bằng tên trong chat cả quán và mời gọi ly; ai vào mà chưa gọi ly sau 1 phút thì cô **nhắc riêng**.
- **Rao** khi có người gọi ly, rủ người khác ngồi chung / tặng ly kèm.
- **Khơi chuyện khi quán im lặng** (`HOST_QUIET_MINUTES`, mặc định 4 phút): câu hỏi mở hoặc **bình chọn vui** (A/B/C, bấm chọn, kết quả cập nhật trực tiếp, hết giờ cô tổng kết). Các bàn chủ đề có từ 2 người trở lên cũng được thả câu hỏi đúng chủ đề.
- **Gọi "Cô Tư ơi" / "@Cô Tư"** trong chat là cô đáp (tối đa 4 lần/người/10 phút). Có dấu hiệu khủng hoảng thì cô thôi đùa và đưa đường dây nóng.
- **Tâm sự không bị bỏ trống**: sau ~2 phút (`HOST_POST_DELAY_SEC`) chưa ai bình luận thì Cô Tư vào động viên trước. Tin và bình luận của Cô Tư luôn gắn nhãn **AI**; tài khoản Cô Tư không tính vào số khách của quán.
- Có `ANTHROPIC_API_KEY` thì Cô Tư tự nghĩ câu hỏi, câu trả lời, lời tổng kết, bình luận (Claude, mức suy nghĩ thấp cho nhanh); không có thì dùng kho câu soạn sẵn trong `server/host.js`. `HOST_ENABLED=0` để tắt hẳn.

**🛡️ Trang quản trị `/admin.html`** (chỉ tài khoản trong `ADMIN_USERNAMES`; nút 🛡️ trong quán mở trang này)
- 📊 **Tổng quan**: người đang trong quán, khách, tâm sự / bình luận / ly gọi / ly tặng / tin riêng hôm nay, báo cáo chờ xử lý, doanh thu Stars, tiến độ tới mốc thu phí, tình trạng AI.
- 🤖 **AI cho Cô Tư**: chọn **Claude**, **ChatGPT (OpenAI API)**, **Gemini (Google API)** hoặc tắt; dán khoá API rồi **chọn model cho Cô Tư**: *model tâm sự* (trả lời khách gọi ly) và *model hoạt náo & kiểm duyệt* (chào khách, khơi chuyện, lọc lời nhắn – nên chọn loại nhanh, rẻ). Có sẵn danh sách gợi ý (Claude Opus 5.5 mặc định, Fable 5.1, Sonnet 5.5, Haiku 5.5…); nút **↻ Tải model mới nhất** hỏi thẳng nhà cung cấp danh sách model hiện có, hoặc tự gõ tên model. Bấm **Thử gọi AI** để kiểm tra. Khoá được mã hoá AES‑256‑GCM trong CSDL và chỉ hiện 4 ký tự cuối.
  > ⚠️ Gói **ChatGPT Plus** và **Gemini Advanced** là gói dùng trên app/web, **không có API** – không gắn vào website được. Cần khoá API: OpenAI tại platform.openai.com/api-keys, Gemini tại aistudio.google.com/apikey (có gói miễn phí nhưng Google có thể dùng dữ liệu ở gói này – nội dung tâm sự nhạy cảm nên dùng gói trả phí).
- 🎙️ **Điều khiển Cô Tư**: bật/tắt hoạt náo, chỉnh nhịp khơi chuyện; cho Cô Tư **nói ngay** ở cả quán hoặc bàn chủ đề, **khơi chuyện / mở bình chọn** tức thì hoặc tự soạn bình chọn; xem chat cả quán trực tiếp.
- 💰 **Kinh tế**: chế độ thu phí (auto/on/off), số khách bắt đầu thu phí, giá từng ly.
- 👥 **Người dùng** (chỉ hiện biệt danh, không hiện tên đăng nhập): tìm, cộng/trừ xu, khoá/mở khoá. 🚩 **Báo cáo**, 📝 **Tâm sự** (ẩn/hiện/xoá), 💳 **Thanh toán** (xem bên dưới).
- 💳 **Thanh toán**: doanh thu hôm nay / 7 ngày / tổng, biểu đồ 14 ngày; danh sách đơn nạp xu (lọc theo trạng thái, tìm mã đơn; **xác nhận đã nhận tiền**, **huỷ**, **hoàn** – hoàn sẽ trừ lại xu); giao dịch ngân hàng chưa khớp đơn (gán tay); giao dịch Telegram Stars; **cài đặt**: ngân hàng + số tài khoản + chủ tài khoản nhận tiền (có QR thử), khoá webhook SePay, thời hạn đơn, cho nạp trước khi thu phí, **sửa gói xu** (xu, giá VNĐ, giá Stars).

**☕ Vào quán phải gọi 1 ly**
- Mỗi lượt vào quán (online lại sau khi vắng hơn 30 phút – `VISIT_GAP_MINUTES`), khách được mời gọi 1 ly trước. Thực đơn tự mở ra, khung chat và các nút tương tác bị khoá cho tới khi gọi ly.
- Chưa gọi ly thì chỉ xem: server chặn chat, đăng tâm sự, bình luận, bày tỏ cảm xúc, tặng nước. Người đã gọi ly có biểu tượng ☕ trước tên.

**💬 Chat 3 kênh**
- 🌐 **Cả quán**: mọi người cùng thấy, hiện bong bóng trên đầu nhân vật.
- 🪑 **Theo bàn chủ đề**: chọn bàn Công Việc, Gia Đình, Tình Cảm… (ngồi vào bàn nào tự chuyển sang chat bàn đó); người mới vào kênh thấy 60 tin gần nhất.
- ✉️ **Tin riêng**: danh sách cuộc trò chuyện, số tin chưa đọc, lưu 30 ngày rồi tự xoá. Có **chặn** người làm phiền.
- Tất cả đều lọc từ thô tục, giới hạn tần suất, và hiện đường dây hỗ trợ khi có dấu hiệu khủng hoảng.

**🫶 Bấm vào người trong quán**
- Mở menu: ✉️ Nhắn riêng · 💪 Động viên · 🤗 An ủi · 🎁 Tặng nước · 👋 Vẫy chào · 🚫 Chặn.
- Động viên / an ủi: chọn câu có sẵn hoặc tự viết (lời tiêu cực bị chặn); cả quán thấy nhân vật làm động tác và dòng thông báo trong chat.
- Tặng nước trực tiếp: chọn món và số ly từ những ly mình đang có để tặng, kèm lời nhắn; người nhận được thông báo, lời đáp vui và ly vào khay của họ.

**🤖 Cô Tư AI – gói tâm sự theo món nước (Claude API)**
- Uống một ly = mở **gói tâm sự với Cô Tư AI**: 12 lượt, dùng trong 24 giờ. Mỗi món một "tính cách": trà đá để xả, trà gừng dịu lo âu, nước sấu gỡ rối, cà phê đen chia việc, sữa đậu nành thương mình, nước dừa nghỉ ngơi, trà chanh chém gió, nước mía tiếp năng lượng.
- Trả lời từng chữ (streaming), có quy tắc an toàn và thẻ đường dây nóng khi có dấu hiệu khủng hoảng. Hội thoại tự xoá 7 ngày sau khi hết hạn, xoá được ngay.
- Không có `ANTHROPIC_API_KEY` thì quán vẫn chạy, chỉ tắt phần AI (vẫn còn bài tập nhanh).

**🧺 Luật ly nước, xu & thu phí**
- **Gọi 1 ly** = uống 1 ly (mở gói Cô Tư AI 12 lượt) **+ được tặng kèm 1 ly** cùng món để mời người khác. Đang uống dở mà gọi thêm thì cộng thêm 12 lượt và vẫn kèm 1 ly tặng.
- **Chỉ tặng được ly đang có để tặng.** Gọi 1 ly trà đá thì có đúng 1 ly trà đá để tặng.
- **Được tặng ly:** nếu chưa có "ly của mình" món đó thì 1 ly thành ly của mình (để uống), còn lại để tặng tiếp. Ví dụ được tặng **100 ly trà đá → 1 ly của mình + 99 ly để tặng**; tặng đi 10 ly → **còn 89**.
- **Hiện tại hoàn toàn miễn phí** (tối đa 10 lần gọi ly miễn phí/người/ngày để tránh gom ly). Khi quán đủ **200 khách** (`PAYWALL_USERS`) thì bắt đầu tính phí: gọi ly sẽ dùng *ly của mình* nếu có (không kèm ly tặng) → phiếu chào mừng (khách mới có 1 phiếu) → trả xu; mỗi ly trả bằng phiếu/xu vẫn kèm 1 ly để tặng. `PAYWALL_MODE=on|off` để bật/tắt thủ công.
- **Nạp xu bằng chuyển khoản ngân hàng (VietQR)**: khách bấm **🪙 Nạp xu** (trong thực đơn khi thiếu xu, hoặc 👤 → Ví xu) → chọn gói → hiện **mã VietQR** đã điền sẵn số tiền và nội dung `XS…` → quét bằng app ngân hàng bất kỳ. Khi tiền về, **SePay** gọi webhook → xu tự vào ví, màn hình báo ngay. Chuyển thiếu tiền / sai nội dung thì giao dịch nằm ở mục “Giao dịch ngân hàng” để quản trị gán tay. Chưa cài SePay vẫn bán được: quản trị xem sao kê rồi bấm “Đã nhận tiền”. Mỗi đơn chỉ cộng xu một lần; mọi lần cộng/trừ xu ghi vào **sổ xu** (khách xem được lịch sử).
- **Mua xu qua bot Telegram**, thanh toán bằng **Telegram Stars ⭐** (Telegram bắt buộc dùng Stars cho hàng hoá số trong bot). Web tạo mã liên kết dùng một lần → mở bot → chọn gói → thanh toán → xu tự vào ví và web báo ngay. Mỗi giao dịch chỉ cộng xu một lần. Bot chỉ bán khi đã bắt đầu thu phí. Lệnh: `/mua`, `/vi`, `/huy`, `/paysupport`, `/terms`.
- Giá món (xu) chỉnh ở trang quản trị → Kinh tế; gói xu (xu, giá VNĐ, giá ⭐) chỉnh ở trang quản trị → Thanh toán → Cài đặt.

**🎁 Mời nước kèm lời nhắn – có lời đáp hài hước**
- Ở mỗi tâm sự, mọi người tặng số ly mình đang có để tặng (1, 3, 10 hoặc tất cả) kèm lời nhắn.
- **Bộ đếm theo từng món** (🧊 101 · 🫚 3 …) trên thẻ tâm sự, trong trang tâm sự và ở "Quầy quà" của người nhận.
- **Lời đáp vui** theo số ly đã nhận, ví dụ: *"101 ly trà đá?! Làm sao con uống hết được trời ơi 😅😅😅"*.
- Người nhận được thông báo ngay (kèm lời nhắn, số ly, lời đáp vui, bao nhiêu ly để tặng tiếp).
- **Chặn lời nhắn tiêu cực** 2 lớp: bộ lọc từ khoá tiếng Việt (biết phân biệt "bạn *không* vô dụng đâu") + Claude phân loại tử tế/tiêu cực khi có khoá API. Lời nhắn bị chặn không được gửi, kèm lý do và câu gợi ý.

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
- **Frontend:** HTML/CSS/JS thuần (ES modules) + **Three.js** (phục vụ từ `node_modules`, không phụ thuộc CDN). Toàn bộ mô hình 3D và bản 2D dự phòng được **dựng bằng code** — không cần file ảnh/mô hình ngoài.

```
server/
  index.js        Express, bảo mật, khởi động
  auth.js         Đăng ký, đăng nhập, phiên, hồ sơ, xoá tài khoản
  posts.js        Tâm sự, cảm xúc, bình luận, báo cáo, thông báo, quản trị
  realtime.js     Socket.IO: vị trí nhân vật, chat, biểu cảm
  moderation.js   Lọc từ ngữ, phát hiện khủng hoảng, sàng lọc lời nhắn tiêu cực
  ai.js           Cô Tư AI (Claude API): nhân cách theo món, stream, phân loại lời nhắn
  aiRoutes.js     Ví xu, gói AI, chat SSE
  funny.js        Lời đáp hài hước theo số ly nhận được
  economy.js      Luật ly: gọi 1 tặng kèm 1, ly của mình, ly để tặng, phiếu, xu, ngưỡng 200 khách
  telegram.js     Bot Telegram bán xu bằng Telegram Stars
  walletRoutes.js API ví, báo giá, liên kết Telegram
  payments.js     Nền tảng thanh toán: gói xu, đơn nạp, khớp chuyển khoản, xác nhận/hoàn, sổ xu, thống kê
  payRoutes.js    API nạp xu, webhook SePay, quản trị thanh toán
  vietqr.js       Tạo mã VietQR (chuẩn EMVCo/NAPAS) cho chuyển khoản
  seat.js         Luật "gọi 1 ly mới vào quán" (lượt vào quán)
  dmRoutes.js     Tin riêng & danh sách chặn
  kindcheck.js    Kiểm tra lời nhắn tử tế (từ khoá + Claude)
  host.js         Cô Tư hoạt náo: chào khách, khơi chuyện, bình chọn, trả lời, bình luận tâm sự
  aiProviders.js  Claude / ChatGPT (OpenAI API) / Gemini – một giao diện chung
  settings.js     Cài đặt quản trị lưu trong CSDL, mã hoá khoá API
  adminRoutes.js  API trang quản trị
  db.js           Lược đồ SQLite
public/
  index.html, css/style.css
  js/char3d.js    Nhân vật 3D chibi, vật liệu dùng chung
  js/scene3d.js   Dựng góc phố 3D: nhà ống, quán trà, cây, cột điện, xe cộ
  js/game3d.js    Engine 3D: camera, ánh sáng ngày/đêm, NPC, nhãn chữ
  js/avatar3d.js  Xem trước nhân vật 3D
  js/menu.js      Menu nước, ví xu, chat Cô Tư AI, mời nước kèm lời nhắn
  admin.html, js/admin.js, css/admin.css   Trang quản trị
  js/social.js    Chat 3 kênh, menu tương tác khi bấm vào người khác, khoá khi chưa gọi ly
  js/world.js     Bản đồ logic: bàn, va chạm, tìm đường (dùng chung 2D/3D)
  js/game.js, js/sprites.js, js/vnart.js   Bản 2D pixel dự phòng
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

1. **Trỏ DNS**: tại nơi quản lý DNS của `lopchungminh.net`, tạo bản ghi
   `A  xastress  → <IP VPS>` (tức `xastress.lopchungminh.net`). Nếu dùng Cloudflare, để chế độ "DNS only" (đám mây xám) khi lấy chứng chỉ lần đầu.
2. **Đưa mã nguồn lên VPS** và chạy script:
   ```bash
   git clone <repo> xastress && cd xastress
   sudo bash deploy/setup-vps.sh email-cua-ban@example.com
   ```
   Script sẽ: cài Node 22, Nginx, Certbot; tạo user hệ thống `xastress`; cài vào `/opt/xastress`;
   chạy dịch vụ systemd `xastress`; cấu hình Nginx (WebSocket); bật tường lửa UFW;
   lấy chứng chỉ HTTPS Let's Encrypt; sao lưu CSDL mỗi ngày lúc 3h vào `/var/backups/xastress`.
3. **Bật Cô Tư AI** (tuỳ chọn): điền `ANTHROPIC_API_KEY` trong `/opt/xastress/.env` (lấy khoá ở platform.claude.com). Mặc định dùng `claude-opus-5-5`; đổi model (kể cả model mới nhất) ngay trong trang quản trị → AI cho Cô Tư, không cần sửa `.env`. Rồi `sudo systemctl restart xastress`.
4. **Nhận chuyển khoản (VietQR + SePay)**: vào trang quản trị → 💳 Thanh toán → Cài đặt: chọn ngân hàng, nhập số tài khoản, tên chủ tài khoản → Lưu (quét QR thử để kiểm tra đúng tên). Để xu tự vào ví: đăng ký my.sepay.vn, liên kết tài khoản ngân hàng đó, tạo webhook sự kiện “Có tiền vào” tới `https://xastress.lopchungminh.net/api/pay/webhook/sepay`, kiểu chứng thực **API Key**, rồi dán API Key vào ô “API Key SePay”. Nginx hiện tại đã chuyển mọi đường dẫn `/api/` về ứng dụng nên không cần sửa thêm.
5. **Bot Telegram bán xu** (cần trước khi đủ 200 khách): nhắn @BotFather → `/newbot` → lấy token → điền `TELEGRAM_BOT_TOKEN` và `TELEGRAM_BOT_USERNAME` trong `.env`, sửa `TELEGRAM_SUPPORT`, rồi khởi động lại. Bot chạy kiểu long polling nên không cần mở thêm cổng. Telegram Stars không cần đăng ký cổng thanh toán; Stars thu được rút qua Fragment theo quy định của Telegram.
6. **Chỉ định quản trị viên**: sửa `/opt/xastress/.env` → `ADMIN_USERNAMES=ten_dang_nhap_cua_ban`,
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
