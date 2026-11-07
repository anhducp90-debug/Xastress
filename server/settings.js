'use strict';
// Cài đặt quán do quản trị viên chỉnh trên trang admin (lưu trong SQLite).
// Bí mật (khoá API) được mã hoá AES-256-GCM bằng APP_SECRET hoặc khoá tự sinh trong data/.secret.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const config = require('./config');

db.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)');
const q = {
  get: db.prepare('SELECT value FROM settings WHERE key = ?'),
  set: db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'),
};
const cache = new Map();

function get(key, def = null) {
  if (cache.has(key)) return cache.get(key);
  const row = q.get.get(key);
  const v = row ? JSON.parse(row.value) : def;
  cache.set(key, v);
  return v;
}
function set(key, value) {
  q.set.run(key, JSON.stringify(value), Date.now());
  cache.set(key, value);
}

// ---- Mã hoá bí mật ----
let keyBuf = null;
function secretKey() {
  if (keyBuf) return keyBuf;
  let secret = process.env.APP_SECRET;
  if (!secret) {
    const file = path.join(path.dirname(config.dbPath), '.secret');
    if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
    secret = fs.readFileSync(file, 'utf8').trim();
  }
  keyBuf = crypto.createHash('sha256').update(secret).digest();
  return keyBuf;
}
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}
function decrypt(blob) {
  try {
    const [iv, tag, enc] = blob.split('.').map((s) => Buffer.from(s, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', secretKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch { return null; }
}
function getSecret(name) {
  const all = get('secrets', {});
  return all[name] ? decrypt(all[name]) : null;
}
function setSecret(name, value) {
  const all = { ...get('secrets', {}) };
  if (value) all[name] = encrypt(value); else delete all[name];
  set('secrets', all);
}
// Chỉ cho biết có khoá hay không + 4 ký tự cuối, không bao giờ trả khoá ra ngoài
function secretHint(name) {
  const v = getSecret(name);
  return v ? `••••${v.slice(-4)}` : null;
}

module.exports = { get, set, getSecret, setSecret, secretHint, encrypt, decrypt };
