'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');
const { AVATAR, ECONOMY } = require('./constants');
const { clean, maskBadWords } = require('./moderation');

const COOKIE = 'xs_sid';
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

const q = {
  userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (username, pass_hash, nickname, avatar, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
  session: db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?'),
  delSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  delUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  updateProfile: db.prepare('UPDATE users SET nickname = ?, avatar = ? WHERE id = ?'),
  updatePass: db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?'),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
};

function sanitizeAvatar(a) {
  const out = {};
  for (const [k, n] of Object.entries(AVATAR)) {
    const v = parseInt(a && a[k], 10);
    out[k] = Number.isInteger(v) && v >= 0 && v < n ? v : Math.floor(Math.random() * n);
  }
  return out;
}

const NICK_A = ['Trà', 'Hạt', 'Mây', 'Gió', 'Lá', 'Nắng', 'Mưa', 'Cỏ', 'Sương', 'Khói'];
const NICK_B = ['Chanh', 'Hướng Dương', 'Bàng', 'Đá', 'Lạc', 'Thuốc Lào', 'Phố', 'Chiều', 'Muộn', 'Xanh'];
function randomNick() {
  const a = NICK_A[Math.floor(Math.random() * NICK_A.length)];
  const b = NICK_B[Math.floor(Math.random() * NICK_B.length)];
  return `${a} ${b} #${Math.floor(1000 + Math.random() * 9000)}`;
}

function publicUser(u) {
  return {
    id: u.id,
    nickname: u.nickname,
    avatar: JSON.parse(u.avatar || '{}'),
    isAdmin: !!u.is_admin,
  };
}

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = Date.now() + config.sessionDays * 86400e3;
  q.insertSession.run(sha(token), userId, expires);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.sessionDays * 86400e3,
    path: '/',
  });
}

function userFromToken(token) {
  if (!token || typeof token !== 'string') return null;
  const u = q.session.get(sha(token), Date.now());
  return u && !u.banned ? u : null;
}

// Middleware: gắn req.user nếu có phiên hợp lệ
function attachUser(req, _res, next) {
  req.user = userFromToken(req.cookies && req.cookies[COOKIE]);
  next();
}
function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Bạn cần ghé quán (đăng nhập) trước đã.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'Không có quyền.' });
  next();
}

const USERNAME_RE = /^[a-z0-9_.]{3,24}$/i;

function validNick(n) {
  const nick = clean(n, 32).replace(/\s+/g, ' ');
  if ([...nick].length < 2) return null;
  if (maskBadWords(nick) !== nick) return null;
  return nick;
}

function register(req, res) {
  const { username, password, nickname, avatar } = req.body || {};
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Tên đăng nhập 3–24 ký tự: chữ không dấu, số, dấu _ hoặc .' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Mật khẩu cần từ 8 ký tự trở lên.' });
  }
  if (q.userByName.get(username)) return res.status(409).json({ error: 'Tên đăng nhập đã có người dùng.' });
  const nick = nickname ? validNick(nickname) : randomNick();
  if (!nick) return res.status(400).json({ error: 'Biệt danh 2–32 ký tự, lịch sự một chút nhé.' });
  const isAdmin = config.adminUsernames.includes(username.toLowerCase()) ? 1 : 0;
  const hash = bcrypt.hashSync(password, 11);
  const info = q.insertUser.run(username, hash, nick, JSON.stringify(sanitizeAvatar(avatar)), isAdmin, Date.now());
  // Khách mới: ví 0 xu + 1 phiếu gọi ly miễn phí (dùng khi quán đã thu phí; gọi ly luôn kèm 1 ly để tặng)
  db.prepare('UPDATE users SET xu = 0, voucher_self = ?, voucher_gift = 0 WHERE id = ?').run(ECONOMY.welcomeSelf, info.lastInsertRowid);
  require('./economy').resetCache();
  createSession(res, info.lastInsertRowid);
  res.json({ user: publicUser(q.userById.get(info.lastInsertRowid)) });
}

// Hash giả để chống dò tên đăng nhập qua thời gian phản hồi
const DUMMY_HASH = bcrypt.hashSync('khong-phai-mat-khau', 11);

function login(req, res) {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Thiếu thông tin.' });
  }
  const u = q.userByName.get(username);
  const ok = bcrypt.compareSync(password, u ? u.pass_hash : DUMMY_HASH);
  if (!u || !ok) return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu.' });
  if (u.banned) return res.status(403).json({ error: 'Tài khoản đã bị tạm khoá do vi phạm nội quy quán.' });
  // Đồng bộ quyền admin theo cấu hình
  const shouldAdmin = config.adminUsernames.includes(u.username.toLowerCase()) ? 1 : 0;
  if (shouldAdmin !== u.is_admin) db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(shouldAdmin, u.id);
  createSession(res, u.id);
  res.json({ user: publicUser(q.userById.get(u.id)) });
}

function logout(req, res) {
  const t = req.cookies && req.cookies[COOKIE];
  if (t) q.delSession.run(sha(t));
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
}

function me(req, res) {
  res.json({ user: req.user ? publicUser(req.user) : null });
}

function updateProfile(req, res) {
  const { nickname, avatar } = req.body || {};
  const nick = nickname === undefined ? req.user.nickname : validNick(nickname);
  if (!nick) return res.status(400).json({ error: 'Biệt danh 2–32 ký tự, lịch sự một chút nhé.' });
  const av = avatar === undefined ? JSON.parse(req.user.avatar) : sanitizeAvatar(avatar);
  q.updateProfile.run(nick, JSON.stringify(av), req.user.id);
  res.json({ user: publicUser(q.userById.get(req.user.id)) });
}

function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body || {};
  if (typeof oldPassword !== 'string' || !bcrypt.compareSync(oldPassword, req.user.pass_hash)) {
    return res.status(400).json({ error: 'Mật khẩu cũ không đúng.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ error: 'Mật khẩu mới cần từ 8 ký tự trở lên.' });
  }
  q.updatePass.run(bcrypt.hashSync(newPassword, 11), req.user.id);
  q.delUserSessions.run(req.user.id);
  createSession(res, req.user.id);
  res.json({ ok: true });
}

// Quyền được lãng quên: xoá tài khoản cùng toàn bộ dữ liệu
function deleteAccount(req, res) {
  const { password } = req.body || {};
  if (typeof password !== 'string' || !bcrypt.compareSync(password, req.user.pass_hash)) {
    return res.status(400).json({ error: 'Mật khẩu không đúng.' });
  }
  q.deleteUser.run(req.user.id);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
}

module.exports = {
  COOKIE, attachUser, requireUser, requireAdmin, userFromToken, publicUser,
  register, login, logout, me, updateProfile, changePassword, deleteAccount,
};
