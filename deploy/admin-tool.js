// Công cụ quản trị chạy trên máy chủ (khi không vào được trang quản trị)
//   docker exec xastress node deploy/admin-tool.js reset-2fa <tên_đăng_nhập>   – tắt xác thực 2 bước (mất điện thoại)
//   docker exec xastress node deploy/admin-tool.js unban <tên_đăng_nhập>       – mở khoá tài khoản
//   (chạy thẳng trên VPS không dùng Docker: cd /opt/xastress && node deploy/admin-tool.js …)
const path = require('path');
const fs = require('fs');
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) for (const l of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const Database = require('better-sqlite3');
const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './data/xastress.db');
const [cmd, username] = process.argv.slice(2);
const db = new Database(dbPath);
const u = username && db.prepare('SELECT id, username FROM users WHERE username = ? COLLATE NOCASE').get(username);
if (!['reset-2fa', 'unban'].includes(cmd) || !username) {
  console.log('Cách dùng: node deploy/admin-tool.js reset-2fa|unban <tên_đăng_nhập>'); process.exit(1);
}
if (!u) { console.error(`Không có tài khoản "${username}" trong ${dbPath}`); process.exit(1); }
if (cmd === 'reset-2fa') {
  db.prepare("UPDATE users SET totp_secret = '' WHERE id = ?").run(u.id);
  console.log(`Đã tắt xác thực 2 bước cho ${u.username}. Đăng nhập lại rồi bật lại trong trang quản trị → 🔐 Bảo mật.`);
} else {
  db.prepare('UPDATE users SET banned = 0 WHERE id = ?').run(u.id);
  console.log(`Đã mở khoá ${u.username}.`);
}
