'use strict';
// "Gọi 1 ly mới vào quán": chặn tương tác khi chưa gọi ly trong lượt vào quán này.
const db = require('./db');
const config = require('./config');
const economy = require('./economy');

const q = {
  get: db.prepare('SELECT visit_start, last_seen FROM users WHERE id = ?'),
  start: db.prepare('UPDATE users SET visit_start = ? WHERE id = ?'),
  seen: db.prepare('UPDATE users SET last_seen = ? WHERE id = ?'),
};

const NEED = { error: 'Mời bạn gọi một ly ở quầy Cô Tư trước đã nhé ☕ Gọi xong là chat, kể chuyện, tặng nước thoải mái.', needOrder: true };

function requireSeated(req, res, next) {
  if (!economy.isSeated(req.user.id)) return res.status(403).json(NEED);
  next();
}

// Người dùng vừa online (kết nối đầu tiên): vắng quá visitGapMinutes thì bắt đầu lượt vào quán mới
function online(userId) {
  const u = q.get.get(userId);
  if (!u) return;
  const now = Date.now();
  if (now - Math.max(u.last_seen, u.visit_start) > config.visitGapMinutes * 60e3) q.start.run(now, userId);
}
function offline(userId) { q.seen.run(Date.now(), userId); }

module.exports = { requireSeated, online, offline, NEED };
