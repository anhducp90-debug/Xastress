'use strict';
// Nền tảng thanh toán: đơn nạp xu, chuyển khoản VietQR (tự xác nhận qua SePay hoặc admin xác nhận tay),
// Telegram Stars, sổ cái xu, hoàn tiền, đối soát.
const crypto = require('crypto');
const db = require('./db');
const settings = require('./settings');
const economy = require('./economy');
const vietqr = require('./vietqr');
const { XU_PACKAGES } = require('./constants');

const DEFAULT_VND = { nho: 20000, vua: 50000, to: 100000 };
const q = {
  insert: db.prepare(`INSERT INTO payment_orders (code, user_id, package, xu, method, amount, currency, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`),
  byId: db.prepare('SELECT * FROM payment_orders WHERE id = ?'),
  byCode: db.prepare('SELECT * FROM payment_orders WHERE code = ?'),
  pendingOf: db.prepare("SELECT * FROM payment_orders WHERE user_id = ? AND status = 'pending' AND method = 'bank' ORDER BY id DESC"),
  mine: db.prepare('SELECT * FROM payment_orders WHERE user_id = ? ORDER BY id DESC LIMIT 30'),
  expire: db.prepare("UPDATE payment_orders SET status = 'expired' WHERE status = 'pending' AND expires_at < ?"),
  setPaid: db.prepare(`UPDATE payment_orders SET status = 'paid', paid_at = ?, provider_ref = ?, paid_amount = ?, confirmed_by = ?
    WHERE id = ? AND status IN ('pending', 'expired')`),
  setStatus: db.prepare('UPDATE payment_orders SET status = ? WHERE id = ? AND status = ?'),
  addTx: db.prepare('INSERT OR IGNORE INTO bank_tx (provider, provider_ref, amount, content, order_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  txById: db.prepare('SELECT * FROM bank_tx WHERE id = ?'),
  txLink: db.prepare('UPDATE bank_tx SET order_id = ?, note = ? WHERE id = ?'),
};

// ---------- Cấu hình ----------
function packages() {
  const custom = settings.get('packages');
  const list = custom && custom.length ? custom : XU_PACKAGES.map((p) => ({ ...p, vnd: DEFAULT_VND[p.id] || p.xu * 1000 }));
  return list.map((p) => ({ id: p.id, label: p.label || `${p.xu} xu`, xu: p.xu, vnd: p.vnd, stars: p.stars }));
}
const pkgById = (id) => packages().find((p) => p.id === id);
function config() {
  const c = settings.get('pay', {});
  return {
    bank: { bin: '', account: '', name: '', ...(c.bank || {}) },
    expiryMinutes: c.expiryMinutes || 30,
    allowBeforePaywall: !!c.allowBeforePaywall,
  };
}
const bankReady = () => { const b = config().bank; return /^\d{6}$/.test(b.bin) && !!b.account; };
const canBuy = () => economy.isPaywall() || config().allowBeforePaywall;
const bankName = (bin) => (vietqr.BANKS.find((b) => b.bin === bin) || {}).name || `Ngân hàng ${bin}`;

// Mã đơn = nội dung chuyển khoản: "XS" + 8 ký tự dễ đọc (không có 0/O/1/I)
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  for (;;) {
    const b = crypto.randomBytes(8);
    const code = `XS${[...b].map((x) => ALPHA[x % ALPHA.length]).join('')}`;
    if (!q.byCode.get(code)) return code;
  }
}

function expireOld() { q.expire.run(Date.now()); }

function shape(o, withQr) {
  const out = {
    id: o.id, code: o.code, package: o.package, xu: o.xu, method: o.method, amount: o.amount, currency: o.currency,
    status: o.status, createdAt: o.created_at, expiresAt: o.expires_at, paidAt: o.paid_at,
  };
  if (withQr && o.method === 'bank') {
    const b = config().bank;
    out.bank = { bin: b.bin, name: bankName(b.bin), account: b.account, holder: b.name };
  }
  return out;
}

// ---------- Tạo đơn chuyển khoản ----------
class PayError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

async function createBankOrder(userId, pkgId) {
  if (!canBuy()) throw new PayError('Quán đang miễn phí, bạn chưa cần nạp xu đâu 🎉');
  if (!bankReady()) throw new PayError('Quán chưa mở nhận chuyển khoản.', 503);
  const pkg = pkgById(pkgId);
  if (!pkg || !pkg.vnd) throw new PayError('Gói xu không hợp lệ.');
  expireOld();
  const pending = q.pendingOf.all(userId);
  const same = pending.find((o) => o.package === pkg.id);
  let order = same;
  if (!order) {
    if (pending.length >= 3) throw new PayError('Bạn đang có 3 đơn chờ thanh toán. Thanh toán hoặc huỷ bớt nhé.', 429);
    const now = Date.now();
    const id = q.insert.run(newCode(), userId, pkg.id, pkg.xu, 'bank', pkg.vnd, 'VND', now, now + config().expiryMinutes * 60e3).lastInsertRowid;
    order = q.byId.get(id);
  }
  const b = config().bank;
  const out = shape(order, true);
  out.qr = await vietqr.dataUrl({ bin: b.bin, account: b.account, amount: order.amount, memo: order.code });
  return out;
}

// ---------- Ghi nhận đã trả tiền: cộng xu đúng 1 lần ----------
let onPaid = () => {};
function setOnPaid(fn) { onPaid = fn; }

function markPaid(orderId, { ref, amount, by }) {
  const done = db.transaction(() => {
    const o = q.byId.get(orderId);
    if (!o || !['pending', 'expired'].includes(o.status)) return null;
    if (!q.setPaid.run(Date.now(), ref, amount ?? o.amount, by, o.id).changes) return null;
    if (o.user_id) economy.addXu(o.user_id, o.xu, o.method === 'stars' ? `Nạp xu qua Telegram Stars (${o.package})` : `Nạp xu chuyển khoản (${o.package})`, o.code);
    return q.byId.get(o.id);
  })();
  if (done) onPaid(done);
  return done;
}

// Telegram Stars: tạo đơn đã trả ngay khi Telegram báo thanh toán thành công
function recordStars(userId, pkg, chargeId) {
  const now = Date.now();
  try {
    const id = q.insert.run(newCode(), userId, pkg.id, pkg.xu, 'stars', pkg.stars, 'XTR', now, now).lastInsertRowid;
    return markPaid(id, { ref: `tg:${chargeId}`, amount: pkg.stars, by: 'telegram' });
  } catch (err) {
    if (/UNIQUE/.test(err.message)) return null; // đã ghi nhận rồi
    throw err;
  }
}

// ---------- Đối soát chuyển khoản (webhook ngân hàng) ----------
// content: nội dung chuyển khoản; tìm mã XS........ (ngân hàng có thể chèn dấu cách / gạch / viết thường)
function findCode(content) {
  const norm = String(content || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = norm.match(/XS[A-HJ-NP-Z2-9]{8}/);
  return m ? m[0] : null;
}
function handleTransfer({ provider, ref, amount, content }) {
  expireOld();
  const code = findCode(content);
  const order = code ? q.byCode.get(code) : null;
  let note = '';
  if (!order) note = 'Không tìm thấy mã đơn trong nội dung';
  else if (order.method !== 'bank') note = 'Mã không phải đơn chuyển khoản';
  else if (order.status === 'paid' || order.status === 'refunded') note = 'Đơn đã được ghi nhận trước đó';
  else if (amount < order.amount) note = `Chuyển thiếu: ${amount} < ${order.amount}`;
  const r = q.addTx.run(provider, `${provider}:${ref}`, amount, String(content || '').slice(0, 300), order ? order.id : null, note, Date.now());
  if (!r.changes) return { duplicate: true };
  if (note) return { matched: false, note, orderId: order && order.id };
  const paid = markPaid(order.id, { ref: `${provider}:${ref}`, amount, by: provider });
  return { matched: !!paid, orderId: order.id };
}

// Admin gán một giao dịch ngân hàng chưa khớp vào đơn (vd khách ghi sai nội dung)
function assignTx(txId, orderId, adminName) {
  const tx = q.txById.get(txId), o = q.byId.get(orderId);
  if (!tx || !o) throw new PayError('Không tìm thấy giao dịch hoặc đơn.', 404);
  if (o.method !== 'bank') throw new PayError('Chỉ gán được cho đơn chuyển khoản.');
  const paid = markPaid(o.id, { ref: `${tx.provider_ref}#gan`, amount: tx.amount, by: `admin:${adminName}` });
  if (!paid) throw new PayError('Đơn này đã được thanh toán hoặc đã huỷ/hoàn.');
  q.txLink.run(o.id, `Gán tay bởi ${adminName}`, tx.id);
  return paid;
}

function confirmManual(orderId, adminName) {
  const paid = markPaid(orderId, { ref: `admin:${orderId}:${Date.now()}`, amount: null, by: `admin:${adminName}` });
  if (!paid) throw new PayError('Đơn không ở trạng thái chờ thanh toán.');
  return paid;
}

function cancel(orderId, userId) {
  const o = q.byId.get(orderId);
  if (!o || (userId && o.user_id !== userId)) throw new PayError('Không tìm thấy đơn.', 404);
  if (!q.setStatus.run('cancelled', o.id, 'pending').changes) throw new PayError('Chỉ huỷ được đơn đang chờ thanh toán.');
  return q.byId.get(o.id);
}

// Hoàn tiền: đánh dấu đơn đã hoàn và thu hồi số xu còn lại (tiền hoàn trả khách làm ngoài hệ thống / refundStarPayment)
function refund(orderId, adminName) {
  return db.transaction(() => {
    const o = q.byId.get(orderId);
    if (!o || o.status !== 'paid') throw new PayError('Chỉ hoàn được đơn đã thanh toán.');
    q.setStatus.run('refunded', o.id, 'paid');
    if (o.user_id) economy.addXu(o.user_id, -o.xu, `Hoàn tiền đơn ${o.code} (bởi ${adminName})`, o.code);
    return q.byId.get(o.id);
  })();
}

function myOrders(userId) { expireOld(); return q.mine.all(userId).map((o) => shape(o)); }
function getMine(userId, id) {
  expireOld();
  const o = q.byId.get(id);
  return o && o.user_id === userId ? shape(o, true) : null;
}

function summary() {
  expireOld();
  const day0 = (() => { const d = new Date(Date.now() + 7 * 3600e3); d.setUTCHours(0, 0, 0, 0); return d.getTime() - 7 * 3600e3; })();
  const sum = (sql, ...a) => db.prepare(sql).get(...a);
  return {
    vndToday: sum("SELECT COALESCE(SUM(amount),0) v FROM payment_orders WHERE status='paid' AND currency='VND' AND paid_at >= ?", day0).v,
    vnd7d: sum("SELECT COALESCE(SUM(amount),0) v FROM payment_orders WHERE status='paid' AND currency='VND' AND paid_at >= ?", day0 - 6 * 86400e3).v,
    vndTotal: sum("SELECT COALESCE(SUM(amount),0) v FROM payment_orders WHERE status='paid' AND currency='VND'").v,
    starsTotal: sum("SELECT COALESCE(SUM(amount),0) v FROM payment_orders WHERE status='paid' AND currency='XTR'").v,
    xuSold: sum("SELECT COALESCE(SUM(xu),0) v FROM payment_orders WHERE status='paid'").v,
    pending: sum("SELECT COUNT(*) v FROM payment_orders WHERE status='pending'").v,
    unmatched: sum("SELECT COUNT(*) v FROM bank_tx WHERE order_id IS NULL OR note != ''").v,
    refunded: sum("SELECT COUNT(*) v FROM payment_orders WHERE status='refunded'").v,
    daily: db.prepare(`SELECT strftime('%Y-%m-%d', paid_at / 1000 + 7 * 3600, 'unixepoch') d,
        SUM(CASE WHEN currency='VND' THEN amount ELSE 0 END) vnd, SUM(CASE WHEN currency='XTR' THEN amount ELSE 0 END) stars, COUNT(*) n
      FROM payment_orders WHERE status='paid' AND paid_at >= ? GROUP BY d ORDER BY d`).all(day0 - 13 * 86400e3),
  };
}

module.exports = {
  packages, pkgById, config, bankReady, canBuy, bankName, createBankOrder, markPaid, recordStars, handleTransfer, assignTx,
  confirmManual, cancel, refund, myOrders, getMine, summary, findCode, setOnPaid, shape, PayError, expireOld,
};
