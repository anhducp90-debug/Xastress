'use strict';
// Quyền của chủ thể dữ liệu: tải về toàn bộ dữ liệu của mình (Nghị định 13/2023, Luật Bảo vệ dữ liệu cá nhân)
const db = require('./db');

const Q = (sql) => db.prepare(sql);
const q = {
  user: Q('SELECT id, username, nickname, avatar, created_at, xu, consent_version, consent_at, (recovery_hash != \'\') AS has_recovery_code FROM users WHERE id = ?'),
  posts: Q('SELECT id, table_id, mood, content, anonymous, resolved, hidden, created_at FROM posts WHERE user_id = ? ORDER BY id'),
  comments: Q('SELECT id, post_id, content, created_at FROM comments WHERE user_id = ? ORDER BY id'),
  reactions: Q('SELECT post_id, kind FROM reactions WHERE user_id = ?'),
  dmsSent: Q('SELECT d.id, u.nickname AS to_nickname, d.text, d.created_at FROM dms d LEFT JOIN users u ON u.id = d.to_user WHERE d.from_user = ? ORDER BY d.id'),
  dmsRecv: Q('SELECT d.id, u.nickname AS from_nickname, d.text, d.created_at FROM dms d LEFT JOIN users u ON u.id = d.from_user WHERE d.to_user = ? ORDER BY d.id'),
  blocks: Q('SELECT u.nickname, b.created_at FROM blocks b LEFT JOIN users u ON u.id = b.blocked_id WHERE b.user_id = ?'),
  notifs: Q('SELECT kind, message, qty, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id'),
  orders: Q('SELECT * FROM orders WHERE user_id = ? ORDER BY id'),
  cups: Q('SELECT drink, qty, glass FROM cups WHERE user_id = ?'),
  ledger: Q('SELECT delta, balance, reason, ref, created_at FROM xu_ledger WHERE user_id = ? ORDER BY id'),
  pay: Q('SELECT code, package, xu, method, amount, currency, status, created_at, paid_at FROM payment_orders WHERE user_id = ? ORDER BY id'),
  packs: Q('SELECT id, drink, turns_left, expires_at, created_at FROM ai_packs WHERE user_id = ? ORDER BY id'),
  aiMsgs: Q('SELECT role, content, created_at FROM ai_messages WHERE pack_id = ? ORDER BY id'),
  tg: Q('SELECT linked_at FROM tg_links WHERE user_id = ?'),
};
// Bảng có thể chưa có cột như mong đợi ở CSDL cũ -> bỏ qua thay vì lỗi
const safe = (fn) => { try { return fn(); } catch (err) { return `(không đọc được: ${err.message})`; } };

function exportUser(id) {
  const u = q.user.get(id);
  return {
    exported_at: new Date().toISOString(),
    note: 'Dữ liệu của bạn tại quán Trà Đá Xả Stress. Thời gian là mili-giây kể từ 1/1/1970 (UTC).',
    account: { ...u, avatar: JSON.parse(u.avatar || '{}') },
    posts: safe(() => q.posts.all(id)),
    comments: safe(() => q.comments.all(id)),
    reactions: safe(() => q.reactions.all(id)),
    private_messages: { sent: safe(() => q.dmsSent.all(id)), received: safe(() => q.dmsRecv.all(id)) },
    blocked: safe(() => q.blocks.all(id)),
    notifications: safe(() => q.notifs.all(id)),
    drink_orders: safe(() => q.orders.all(id)),
    cups: safe(() => q.cups.all(id)),
    xu_ledger: safe(() => q.ledger.all(id)),
    payment_orders: safe(() => q.pay.all(id)),
    ai_conversations: safe(() => q.packs.all(id).map((p) => ({ ...p, messages: q.aiMsgs.all(p.id) }))),
    telegram_linked: safe(() => !!q.tg.get(id)),
  };
}
module.exports = { exportUser };
