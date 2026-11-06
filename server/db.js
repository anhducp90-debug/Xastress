'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT NOT NULL UNIQUE COLLATE NOCASE,   -- tên đăng nhập, KHÔNG bao giờ hiển thị công khai
  pass_hash   TEXT NOT NULL,
  nickname    TEXT NOT NULL,                         -- biệt danh công khai
  avatar      TEXT NOT NULL DEFAULT '{}',
  is_admin    INTEGER NOT NULL DEFAULT 0,
  banned      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  table_id    TEXT NOT NULL,
  mood        TEXT NOT NULL DEFAULT 'met',
  content     TEXT NOT NULL,
  anonymous   INTEGER NOT NULL DEFAULT 0,
  resolved    INTEGER NOT NULL DEFAULT 0,
  hidden      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_table ON posts(table_id, created_at DESC);
CREATE TABLE IF NOT EXISTS reactions (
  post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id, kind)
);
CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  hidden      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,               -- 'post' | 'comment'
  target_id   INTEGER NOT NULL,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  UNIQUE (target_type, target_id, user_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,               -- 'reaction' | 'comment'
  post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  actor       TEXT NOT NULL,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read, created_at DESC);
-- Mời nước: ai mời ai, món gì, bao nhiêu ly, lời nhắn (đã kiểm duyệt)
CREATE TABLE IF NOT EXISTS treats (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  from_user   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drink       TEXT NOT NULL,
  qty         INTEGER NOT NULL DEFAULT 1,
  message     TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_treats_post ON treats(post_id);
CREATE INDEX IF NOT EXISTS idx_treats_to ON treats(to_user, created_at DESC);
-- Khay nước: qty = số ly để TẶNG; glass = có "ly của mình" để uống
CREATE TABLE IF NOT EXISTS cups (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drink       TEXT NOT NULL,
  qty         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, drink)
);
-- Lịch sử gọi ly (để giới hạn số ly miễn phí mỗi ngày)
CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drink       TEXT NOT NULL,
  method      TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at);
-- Liên kết tài khoản quán với Telegram (để mua xu qua bot)
CREATE TABLE IF NOT EXISTS tg_links (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tg_user_id  INTEGER NOT NULL UNIQUE,
  tg_chat_id  INTEGER NOT NULL,
  linked_at   INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tg_codes (
  code        TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);
-- Lịch sử thanh toán Telegram Stars (charge_id duy nhất -> không cộng xu hai lần)
CREATE TABLE IF NOT EXISTS payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tg_user_id  INTEGER NOT NULL,
  package     TEXT NOT NULL,
  xu          INTEGER NOT NULL,
  stars       INTEGER NOT NULL,
  charge_id   TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);
-- Gói AI tâm sự mua bằng xu theo món nước
CREATE TABLE IF NOT EXISTS ai_packs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drink       TEXT NOT NULL,
  turns_left  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_packs_user ON ai_packs(user_id, expires_at DESC);
CREATE TABLE IF NOT EXISTS ai_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pack_id     INTEGER NOT NULL REFERENCES ai_packs(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aimsg_pack ON ai_messages(pack_id, id);
`);

// Nâng cấp CSDL cũ: thêm cột nếu chưa có
function addColumn(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
addColumn('users', 'xu', 'INTEGER NOT NULL DEFAULT 0');          // ví xu (mua qua bot Telegram)
addColumn('users', 'last_daily', "TEXT NOT NULL DEFAULT ''");    // (cũ, không dùng nữa)
addColumn('users', 'voucher_self', 'INTEGER NOT NULL DEFAULT 1'); // phiếu: 1 ly miễn phí cho mình
addColumn('users', 'voucher_gift', 'INTEGER NOT NULL DEFAULT 1'); // (cũ, không dùng nữa: ly tặng kèm khi gọi thay thế)
addColumn('cups', 'glass', 'INTEGER NOT NULL DEFAULT 0');         // 1 = đang có "ly của mình" món này để uống
addColumn('notifications', 'message', "TEXT NOT NULL DEFAULT ''");
addColumn('notifications', 'qty', 'INTEGER NOT NULL DEFAULT 1');

// Quyền riêng tư: xoá hội thoại AI của gói đã hết hạn quá 7 ngày
const purgeAi = db.prepare('DELETE FROM ai_packs WHERE expires_at < ?');

// Dọn phiên hết hạn định kỳ
const purge = db.prepare('DELETE FROM sessions WHERE expires_at < ?');
const purgeCodes = db.prepare('DELETE FROM tg_codes WHERE expires_at < ?');
setInterval(() => { purge.run(Date.now()); purgeAi.run(Date.now() - 7 * 86400e3); purgeCodes.run(Date.now()); }, 60 * 60 * 1000).unref();

module.exports = db;
