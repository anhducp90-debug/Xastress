'use strict';
// Mã xác thực 2 bước (TOTP – RFC 6238) dùng được với Google Authenticator, Microsoft Authenticator, Authy…
const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function unbase32(s) {
  let bits = 0, val = 0;
  const out = [];
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(c);
    if (i < 0) continue;
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
const newSecret = () => base32(crypto.randomBytes(20));

function codeAt(secret, step) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}

// Chống dùng lại cùng một mã: nhớ bước thời gian đã dùng gần nhất của mỗi người
const lastStep = new Map();
function verify(secret, code, key, now = Date.now()) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c) || !secret) return false;
  const step = Math.floor(now / 30000);
  for (const d of [0, -1, 1]) {
    const s = step + d;
    if (crypto.timingSafeEqual(Buffer.from(codeAt(secret, s)), Buffer.from(c))) {
      if (key !== undefined && lastStep.get(key) >= s) return false;
      if (key !== undefined) lastStep.set(key, s);
      return true;
    }
  }
  return false;
}
const otpauth = (secret, label, issuer = 'Tra Da Xa Stress') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

module.exports = { newSecret, verify, codeAt, otpauth, base32, unbase32 };
