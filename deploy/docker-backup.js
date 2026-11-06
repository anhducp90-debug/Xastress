// Sao lưu CSDL an toàn khi quán đang chạy (dùng trong container):
//   docker exec xastress node deploy/docker-backup.js
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const src = process.env.DB_PATH || '/app/data/xastress.db';
const dir = path.join(path.dirname(src), 'backups');
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, `xastress-${new Date().toISOString().slice(0, 10)}.db`);
new Database(src, { readonly: true }).backup(out)
  .then(() => {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort();
    for (const f of files.slice(0, -14)) fs.unlinkSync(path.join(dir, f)); // giữ 14 bản gần nhất
    console.log('Đã sao lưu:', out);
  })
  .catch((e) => { console.error('Sao lưu lỗi:', e.message); process.exit(1); });
