'use strict';
// Bot Telegram bán xu cho quán, thanh toán bằng Telegram Stars (XTR).
// Telegram quy định hàng hoá số (như xu trong game) bán trong bot phải dùng Stars.
//
// Luồng: web tạo mã liên kết -> người dùng mở t.me/<bot>?start=<mã> -> bot liên kết
// Telegram với tài khoản quán -> chọn gói -> hoá đơn Stars -> thanh toán xong cộng xu.
const crypto = require('crypto');
const db = require('./db');
const config = require('./config');
const economy = require('./economy');
const realtime = require('./realtime');

const tg = config.telegram;
const enabled = () => !!tg.token;
// Gói xu lấy từ nền tảng thanh toán (admin chỉnh được); chỉ gói có giá Stars mới bán qua bot
const payments = () => require('./payments');
const starPackages = () => payments().packages().filter((p) => p.stars > 0);
const pkgByIdNow = (id) => starPackages().find((p) => p.id === id);

const q = {
  insertCode: db.prepare('INSERT INTO tg_codes (code, user_id, expires_at) VALUES (?, ?, ?)'),
  code: db.prepare('SELECT * FROM tg_codes WHERE code = ? AND expires_at > ?'),
  delCode: db.prepare('DELETE FROM tg_codes WHERE code = ?'),
  linkByTg: db.prepare('SELECT l.*, u.nickname, u.xu FROM tg_links l JOIN users u ON u.id = l.user_id WHERE l.tg_user_id = ?'),
  linkByUser: db.prepare('SELECT * FROM tg_links WHERE user_id = ?'),
  unlinkTg: db.prepare('DELETE FROM tg_links WHERE tg_user_id = ? OR user_id = ?'),
  link: db.prepare('INSERT INTO tg_links (user_id, tg_user_id, tg_chat_id, linked_at) VALUES (?, ?, ?, ?)'),
  unlinkUser: db.prepare('DELETE FROM tg_links WHERE user_id = ?'),
  payment: db.prepare('INSERT OR IGNORE INTO payments (user_id, tg_user_id, package, xu, stars, charge_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
};

// ---- Gọi Bot API (có thể thay bằng hàm giả khi kiểm thử) ----
let caller = async (method, body) => {
  const res = await fetch(`${tg.apiBase}/bot${tg.token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
  return data.result;
};
const call = (m, b) => caller(m, b);
function setCaller(fn) { caller = fn; }

// ---- Phía web ----
function createLinkCode(userId) {
  const code = crypto.randomBytes(12).toString('base64url');
  q.insertCode.run(code, userId, Date.now() + 15 * 60e3);
  return { code, url: tg.username ? `https://t.me/${tg.username}?start=${code}` : null };
}
function linkInfo(userId) { return !!q.linkByUser.get(userId); }
function unlink(userId) { q.unlinkUser.run(userId); }

// ---- Phía bot ----
const PKG_KEYBOARD = () => ({
  inline_keyboard: starPackages().map((p) => [{ text: `🪙 ${p.label} – ${p.stars} ⭐`, callback_data: `buy:${p.id}` }]),
});
const reply = (chatId, text, extra = {}) => call('sendMessage', { chat_id: chatId, text, ...extra });

async function showPackages(chatId, link) {
  const st = economy.status();
  if (!st.paywall) {
    return reply(chatId, `🎉 Quán đang MIỄN PHÍ cho tất cả mọi người (${st.participants}/${st.threshold} khách). Bạn chưa cần mua xu đâu!\nKhi quán đủ ${st.threshold} khách, Cô Tư sẽ mở bán xu ở đây.`);
  }
  return reply(chatId, `👛 Ví của ${link.nickname}: ${link.xu} xu\nChọn gói xu (thanh toán bằng Telegram Stars ⭐):`, { reply_markup: PKG_KEYBOARD() });
}

async function handleMessage(m) {
  const chatId = m.chat.id;
  const from = m.from;
  if (m.successful_payment) return handlePaid(m);
  const text = (m.text || '').trim();
  const [cmd, arg] = text.split(/\s+/, 2);
  const link = q.linkByTg.get(from.id);

  if (cmd === '/start' && arg) {
    const c = q.code.get(arg, Date.now());
    if (!c) return reply(chatId, '⚠️ Mã liên kết đã hết hạn hoặc không đúng. Vào xastress.lopchungminh.net → 🪙 Nạp xu → ⭐ Stars để lấy mã mới nhé.');
    q.delCode.run(arg);
    db.transaction(() => { q.unlinkTg.run(from.id, c.user_id); q.link.run(c.user_id, from.id, chatId, Date.now()); })();
    const l = q.linkByTg.get(from.id);
    realtime.notifyUser(c.user_id, { kind: 'tg_linked' });
    await reply(chatId, `✅ Đã liên kết với tài khoản quán "${l.nickname}".\nQuán không hiển thị Telegram của bạn cho ai cả. Gõ /huy để bỏ liên kết bất cứ lúc nào.`);
    return showPackages(chatId, l);
  }
  if (cmd === '/start' || cmd === '/help') {
    return reply(chatId, '☕ Chào bạn! Đây là bot bán xu của quán Trà Đá Xả Stress.\n\nĐể mua xu: vào xastress.lopchungminh.net → 🪙 Nạp xu → chọn gói ⭐ Stars. Bot sẽ tự liên kết với tài khoản của bạn.\n\n/mua – mua xu\n/vi – xem ví\n/huy – bỏ liên kết\n/paysupport – hỗ trợ thanh toán');
  }
  if (cmd === '/paysupport') return reply(chatId, `🧾 Hỗ trợ thanh toán: ${tg.support}`);
  if (cmd === '/terms') return reply(chatId, 'Xu dùng để gọi nước trong quán xastress.lopchungminh.net: mỗi ly là một gói tâm sự Cô Tư AI và được tặng kèm 1 ly để mời người khác. Xu không quy đổi ra tiền. Lỗi giao dịch được hoàn Stars theo yêu cầu qua /paysupport.');
  if (!link) return reply(chatId, '🔗 Bạn chưa liên kết tài khoản quán. Vào xastress.lopchungminh.net → 🪙 Nạp xu → chọn gói ⭐ Stars nhé.');
  if (cmd === '/huy') { q.unlinkTg.run(from.id, link.user_id); return reply(chatId, '👋 Đã bỏ liên kết. Hẹn gặp lại ở quán!'); }
  if (cmd === '/vi') return reply(chatId, `👛 Ví của ${link.nickname}: ${link.xu} xu`);
  return showPackages(chatId, link); // /mua hoặc tin nhắn bất kỳ
}

async function handleCallback(cb) {
  await call('answerCallbackQuery', { callback_query_id: cb.id });
  const [kind, id] = (cb.data || '').split(':');
  const p = pkgByIdNow(id);
  const link = q.linkByTg.get(cb.from.id);
  if (kind !== 'buy' || !p || !link) return;
  if (!economy.isPaywall()) return showPackages(cb.message.chat.id, link);
  await call('sendInvoice', {
    chat_id: cb.message.chat.id,
    title: `${p.xu} xu – Trà Đá Xả Stress`,
    description: `Nạp ${p.xu} xu vào ví "${link.nickname}" để gọi nước và tặng nước trong quán.`,
    payload: `${link.user_id}:${p.id}:${crypto.randomBytes(4).toString('hex')}`,
    currency: 'XTR', // Telegram Stars – không cần provider_token
    prices: [{ label: p.label, amount: p.stars }],
  });
}

function parsePayload(payload) {
  const [uid, pid] = String(payload || '').split(':');
  return { userId: Number(uid), pkg: pkgByIdNow(pid) };
}

async function handlePreCheckout(pq) {
  const { userId, pkg } = parsePayload(pq.invoice_payload);
  const link = q.linkByTg.get(pq.from.id);
  let error = null;
  if (!pkg || pq.currency !== 'XTR' || pq.total_amount !== pkg.stars) error = 'Gói xu không hợp lệ, vui lòng chọn lại.';
  else if (!link || link.user_id !== userId) error = 'Tài khoản Telegram chưa liên kết với ví này.';
  await call('answerPreCheckoutQuery', error ? { pre_checkout_query_id: pq.id, ok: false, error_message: error } : { pre_checkout_query_id: pq.id, ok: true });
}

async function handlePaid(m) {
  const sp = m.successful_payment;
  const { userId, pkg } = parsePayload(sp.invoice_payload);
  if (!pkg || sp.currency !== 'XTR' || sp.total_amount !== pkg.stars) {
    console.error('Thanh toán Telegram không khớp gói', sp.telegram_payment_charge_id);
    return reply(m.chat.id, `⚠️ Có lỗi khi ghi nhận thanh toán. Gõ /paysupport, kèm mã: ${sp.telegram_payment_charge_id}`);
  }
  const credited = db.transaction(() => {
    const r = q.payment.run(userId, m.from.id, pkg.id, pkg.xu, pkg.stars, sp.telegram_payment_charge_id, Date.now());
    if (!r.changes) return false; // đã cộng rồi (Telegram gửi lại)
    payments().recordStars(userId, pkg, sp.telegram_payment_charge_id); // ghi đơn + cộng xu + sổ cái
    return true;
  })();
  if (!credited) return;
  const l = q.linkByTg.get(m.from.id);
  return reply(m.chat.id, `🎉 Đã cộng ${pkg.xu} xu! Ví hiện có ${l ? l.xu : '?'} xu. Quay lại quán gọi nước thôi ☕`);
}

async function handleUpdate(u) {
  try {
    if (u.pre_checkout_query) return await handlePreCheckout(u.pre_checkout_query);
    if (u.callback_query) return await handleCallback(u.callback_query);
    if (u.message) return await handleMessage(u.message);
  } catch (err) {
    console.error('Bot Telegram lỗi khi xử lý update:', err.message);
  }
}

// Long polling – không cần mở cổng webhook trên VPS
let running = false;
async function start() {
  if (!enabled() || running) return;
  running = true;
  try {
    const me = await call('getMe');
    if (!tg.username) tg.username = me.username;
    await call('setMyCommands', { commands: [
      { command: 'mua', description: 'Mua xu' }, { command: 'vi', description: 'Xem ví' },
      { command: 'huy', description: 'Bỏ liên kết tài khoản' }, { command: 'paysupport', description: 'Hỗ trợ thanh toán' },
    ] });
    console.log(`🤖 Bot Telegram @${tg.username} đang chạy`);
  } catch (err) { console.error('Không khởi động được bot Telegram:', err.message); running = false; return; }
  let offset = 0;
  while (running) {
    try {
      const updates = await call('getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'callback_query', 'pre_checkout_query'] });
      for (const u of updates) { offset = u.update_id + 1; await handleUpdate(u); }
    } catch (err) {
      console.error('Bot Telegram mất kết nối, thử lại sau 5 giây:', err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
function stop() { running = false; }

module.exports = { enabled, start, stop, createLinkCode, linkInfo, unlink, handleUpdate, setCaller, botUsername: () => tg.username };
