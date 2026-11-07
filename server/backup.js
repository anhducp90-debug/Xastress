'use strict';
// Tự sao lưu CSDL mỗi ngày (mặc định 3h sáng giờ Việt Nam) vào data/backups, giữ 14 bản gần nhất.
// Sao lưu "nóng" bằng API backup của SQLite – quán vẫn chạy bình thường trong lúc sao lưu.
const fs = require('fs');
const path = require('path');
const db = require('./db');
const config = require('./config');

const DIR = path.resolve(process.env.BACKUP_DIR || path.join(path.dirname(config.dbPath), 'backups'));
const KEEP = Math.max(1, parseInt(process.env.BACKUP_KEEP || '14', 10));
const HOUR = parseInt(process.env.BACKUP_HOUR || '3', 10);
const state = { last: null, lastError: null, running: false };

const vnNow = () => new Date(Date.now() + 7 * 3600e3);
function list() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => /^xastress-.*\.db$/.test(f)).sort();
}
async function backupNow() {
  if (state.running) throw new Error('Đang sao lưu, chờ chút nhé.');
  state.running = true;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const stamp = vnNow().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const file = path.join(DIR, `xastress-${stamp}.db`);
    await db.backup(file);
    for (const f of list().slice(0, -KEEP)) fs.unlinkSync(path.join(DIR, f));
    state.last = { file: path.basename(file), at: Date.now(), size: fs.statSync(file).size };
    state.lastError = null;
    return state.last;
  } catch (err) {
    state.lastError = { message: err.message, at: Date.now() };
    console.error('Sao lưu CSDL lỗi:', err.message);
    throw err;
  } finally { state.running = false; }
}
function start() {
  if (process.env.BACKUP === '0') return;
  // khôi phục thông tin bản gần nhất sau khi khởi động lại
  const f = list().pop();
  if (f) { const st = fs.statSync(path.join(DIR, f)); state.last = { file: f, at: st.mtimeMs, size: st.size }; }
  setInterval(() => {
    const n = vnNow();
    const today = n.toISOString().slice(0, 10);
    const lastDay = state.last ? new Date(state.last.at + 7 * 3600e3).toISOString().slice(0, 10) : '';
    if (n.getUTCHours() >= HOUR && lastDay !== today) backupNow().catch(() => {});
  }, 10 * 60e3).unref();
}
const status = () => ({ ...state, dir: DIR, keep: KEEP, hour: HOUR, files: list().length });
module.exports = { start, backupNow, status };
