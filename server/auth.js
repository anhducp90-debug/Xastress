'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');
const { AVATAR, ECONOMY } = require('./constants');
const { clean, maskBadWords } = require('./moderation');
const settings = require('./settings');
const totp = require('./totp');

// Phiên bản Điều khoản & Chính sách hiện hành. Đổi ngày này khi sửa nội dung pháp lý -> khách được hỏi đồng ý lại.
const TERMS_VERSION = '2026-11-07';

const COOKIE = 'xs_sid';
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

const q = {
  userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (username, pass_hash, nickname, avatar, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
  session: db.prepare('SELECT u.*, s.mfa AS _mfa FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?'),
  setMfa: db.prepare('UPDATE sessions SET mfa = 1 WHERE token_hash = ?'),
  setConsent: db.prepare('UPDATE users SET consent_version = ?, consent_at = ? WHERE id = ?'),
  setRecovery: db.prepare('UPDATE users SET recovery_hash = ? WHERE id = ?'),
  setTotp: db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?'),
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
    adminMfa: !!u.mfa_pending, // quản trị viên chưa nhập mã xác thực 2 bước trong phiên này
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
  if (!u || u.banned) return null;
  // Quản trị viên đã bật xác thực 2 bước: phiên chưa nhập mã thì chỉ có quyền khách thường
  if (u.is_admin && u.totp_secret && !u._mfa) return { ...u, is_admin: 0, mfa_pending: 1 };
  return u;
}

// Middleware: gắn req.user nếu có phiên hợp lệ
function attachUser(req, _res, next) {
  const t = req.cookies && req.cookies[COOKIE];
  req.user = userFromToken(t);
  req.sessionHash = t ? sha(t) : null;
  next();
}
function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Bạn cần ghé quán (đăng nhập) trước đã.' });
  next();
}
function requireAdmin(req, res, next) {
  if (req.user && req.user.mfa_pending) return res.status(401).json({ error: 'Nhập mã xác thực 2 bước để vào trang quản trị.', mfa: true });
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

async function register(req, res) {
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
  const c = (req.body || {}).consent || {};
  if (c.terms !== true || c.privacy !== true || c.age !== true) {
    return res.status(400).json({ error: 'Bạn cần đồng ý Điều khoản, Chính sách quyền riêng tư và xác nhận đủ 16 tuổi để vào quán.' });
  }
  const isAdmin = config.adminUsernames.includes(username.toLowerCase()) ? 1 : 0;
  const hash = await bcrypt.hash(password, 11); // bất đồng bộ: không chặn chat của cả quán khi có người đăng ký
  let info;
  try { info = q.insertUser.run(username, hash, nick, JSON.stringify(sanitizeAvatar(avatar)), isAdmin, Date.now()); }
  catch (err) { if (/UNIQUE/.test(err.message)) return res.status(409).json({ error: 'Tên đăng nhập đã có người dùng.' }); throw err; }
  // Khách mới: ví 0 xu + 1 phiếu gọi ly miễn phí (dùng khi quán đã thu phí; gọi ly luôn kèm 1 ly để tặng)
  db.prepare('UPDATE users SET xu = 0, voucher_self = ?, voucher_gift = 0 WHERE id = ?').run(ECONOMY.welcomeSelf, info.lastInsertRowid);
  require('./economy').resetCache();
  q.setConsent.run(TERMS_VERSION, Date.now(), info.lastInsertRowid);
  const recoveryCode = await newRecovery(info.lastInsertRowid);
  createSession(res, info.lastInsertRowid);
  res.json({ user: publicUser(q.userById.get(info.lastInsertRowid)), recoveryCode });
}

// Hash giả để chống dò tên đăng nhập qua thời gian phản hồi
const DUMMY_HASH = bcrypt.hashSync('khong-phai-mat-khau', 11);

async function login(req, res) {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Thiếu thông tin.' });
  }
  const u = q.userByName.get(username);
  const ok = await bcrypt.compare(password, u ? u.pass_hash : DUMMY_HASH);
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
  if (!req.user) return res.json({ user: null });
  res.json({
    user: publicUser(req.user),
    needsConsent: req.user.consent_version !== TERMS_VERSION, termsVersion: TERMS_VERSION,
    hasRecovery: !!req.user.recovery_hash,
  });
}

// ---------- Đồng ý Điều khoản (khách cũ khi điều khoản thay đổi) ----------
function consent(req, res) {
  const c = (req.body || {}).consent || {};
  if (c.terms !== true || c.privacy !== true || c.age !== true) return res.status(400).json({ error: 'Cần đồng ý cả ba mục.' });
  q.setConsent.run(TERMS_VERSION, Date.now(), req.user.id);
  res.json({ ok: true });
}

// ---------- Mã khôi phục: quán ẩn danh nên không có email; mã này thay cho "quên mật khẩu" ----------
const RC_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
async function newRecovery(userId) {
  const raw = Array.from(crypto.randomBytes(16), (b) => RC_ALPHA[b % 32]).join('');
  const code = raw.match(/.{4}/g).join('-');
  q.setRecovery.run(await bcrypt.hash(raw, 10), userId);
  return code;
}
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
async function recover(req, res) {
  const { username, code, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ error: 'Mật khẩu mới cần từ 8 ký tự trở lên.' });
  }
  const u = typeof username === 'string' ? q.userByName.get(username.trim()) : null;
  const ok = await bcrypt.compare(normCode(code), u && u.recovery_hash ? u.recovery_hash : DUMMY_HASH);
  if (!u || !u.recovery_hash || !ok) return res.status(401).json({ error: 'Tên đăng nhập hoặc mã khôi phục không đúng.' });
  if (u.banned) return res.status(403).json({ error: 'Tài khoản đã bị tạm khoá do vi phạm nội quy quán.' });
  q.updatePass.run(await bcrypt.hash(newPassword, 11), u.id);
  q.delUserSessions.run(u.id);
  const recoveryCode = await newRecovery(u.id); // mã cũ hết hiệu lực sau khi dùng
  createSession(res, u.id);
  res.json({ user: publicUser(q.userById.get(u.id)), recoveryCode });
}
async function regenRecovery(req, res) {
  const { password } = req.body || {};
  if (typeof password !== 'string' || !await bcrypt.compare(password, req.user.pass_hash)) {
    return res.status(400).json({ error: 'Mật khẩu không đúng.' });
  }
  res.json({ recoveryCode: await newRecovery(req.user.id) });
}

// ---------- Xác thực 2 bước cho quản trị viên ----------
const pendingTotp = new Map(); // userId -> { secret, until }
async function mfaVerify(req, res) {
  if (!req.user || !req.user.mfa_pending) return res.status(400).json({ error: 'Phiên này không cần mã.' });
  if (!totp.verify(settings.decrypt(req.user.totp_secret), (req.body || {}).code, req.user.id)) {
    return res.status(401).json({ error: 'Mã không đúng hoặc đã hết hạn.' });
  }
  q.setMfa.run(req.sessionHash);
  res.json({ ok: true });
}
function mfaStatus(req, res) {
  res.json({ enabled: !!q.userById.get(req.user.id).totp_secret });
}
async function mfaSetup(req, res) {
  const secret = totp.newSecret();
  pendingTotp.set(req.user.id, { secret, until: Date.now() + 10 * 60e3 });
  const url = totp.otpauth(secret, req.user.nickname);
  res.json({ secret, url, qr: await require('qrcode').toDataURL(url, { margin: 1, width: 220 }) });
}
function mfaEnable(req, res) {
  const p = pendingTotp.get(req.user.id);
  if (!p || p.until < Date.now()) return res.status(400).json({ error: 'Hết thời gian, bấm bật lại để lấy mã QR mới.' });
  if (!totp.verify(p.secret, (req.body || {}).code, req.user.id)) return res.status(400).json({ error: 'Mã không đúng. Kiểm tra giờ trên điện thoại rồi thử lại.' });
  pendingTotp.delete(req.user.id);
  q.setTotp.run(settings.encrypt(p.secret), req.user.id);
  q.setMfa.run(req.sessionHash);
  res.json({ ok: true });
}
function mfaDisable(req, res) {
  const u = q.userById.get(req.user.id);
  if (!u.totp_secret) return res.json({ ok: true });
  if (!totp.verify(settings.decrypt(u.totp_secret), (req.body || {}).code, u.id)) return res.status(400).json({ error: 'Mã không đúng.' });
  q.setTotp.run('', u.id);
  res.json({ ok: true });
}

function updateProfile(req, res) {
  const { nickname, avatar } = req.body || {};
  const nick = nickname === undefined ? req.user.nickname : validNick(nickname);
  if (!nick) return res.status(400).json({ error: 'Biệt danh 2–32 ký tự, lịch sự một chút nhé.' });
  const av = avatar === undefined ? JSON.parse(req.user.avatar) : sanitizeAvatar(avatar);
  q.updateProfile.run(nick, JSON.stringify(av), req.user.id);
  res.json({ user: publicUser(q.userById.get(req.user.id)) });
}

async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body || {};
  if (typeof oldPassword !== 'string' || !await bcrypt.compare(oldPassword, req.user.pass_hash)) {
    return res.status(400).json({ error: 'Mật khẩu cũ không đúng.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ error: 'Mật khẩu mới cần từ 8 ký tự trở lên.' });
  }
  q.updatePass.run(await bcrypt.hash(newPassword, 11), req.user.id);
  q.delUserSessions.run(req.user.id);
  createSession(res, req.user.id);
  res.json({ ok: true });
}

// Quyền được lãng quên: xoá tài khoản cùng toàn bộ dữ liệu
async function deleteAccount(req, res) {
  const { password } = req.body || {};
  if (typeof password !== 'string' || !await bcrypt.compare(password, req.user.pass_hash)) {
    return res.status(400).json({ error: 'Mật khẩu không đúng.' });
  }
  q.deleteUser.run(req.user.id);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
}

module.exports = {
  COOKIE, attachUser, requireUser, requireAdmin, userFromToken, publicUser,
  register, login, logout, me, updateProfile, changePassword, deleteAccount,
  consent, recover, regenRecovery, mfaVerify, mfaStatus, mfaSetup, mfaEnable, mfaDisable, TERMS_VERSION,
};
