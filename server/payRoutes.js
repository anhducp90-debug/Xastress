'use strict';
// API thanh toán: khách nạp xu, webhook ngân hàng (SePay), và phần quản trị.
const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const settings = require('./settings');
const payments = require('./payments');
const economy = require('./economy');
const telegram = require('./telegram');
const realtime = require('./realtime');
const vietqr = require('./vietqr');
const { requireUser, requireAdmin } = require('./auth');
const { hit } = require('./ratelimit');
const { clean } = require('./moderation');

const router = express.Router();
const int = (v) => { const n = parseInt(v, 10); return Number.isSafeInteger(n) && n > 0 ? n : null; };
const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (err) {
    if (err instanceof payments.PayError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
};

// Báo cho khách khi đơn được thanh toán (xu đã vào ví)
payments.setOnPaid((o) => {
  if (!o.user_id) return;
  const bal = db.prepare('SELECT xu FROM users WHERE id = ?').get(o.user_id);
  realtime.notifyUser(o.user_id, { kind: 'xu', amount: o.xu, balance: bal && bal.xu, method: o.method, orderId: o.id });
});

// ---------- Phía khách ----------
router.get('/pay/info', requireUser, (req, res) => {
  payments.expireOld();
  res.json({
    canBuy: payments.canBuy(), paywall: economy.isPaywall(),
    packages: payments.packages(),
    methods: { bank: payments.bankReady(), stars: telegram.enabled() },
    xu: db.prepare('SELECT xu FROM users WHERE id = ?').get(req.user.id).xu,
    pending: payments.myOrders(req.user.id).filter((o) => o.status === 'pending'),
  });
});
router.post('/pay/orders', requireUser, wrap(async (req, res) => {
  if (!hit(`payorder:${req.user.id}`, 10, 3600e3)) return res.status(429).json({ error: 'Bạn tạo đơn nhiều quá, thử lại sau nhé.' });
  res.json({ order: await payments.createBankOrder(req.user.id, req.body && req.body.package) });
}));
router.get('/pay/orders', requireUser, (req, res) => res.json({ items: payments.myOrders(req.user.id) }));
router.get('/pay/orders/:id', requireUser, async (req, res) => {
  const o = payments.getMine(req.user.id, int(req.params.id));
  if (!o) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  if (req.query.qr && o.status === 'pending' && o.bank) o.qr = await vietqr.dataUrl({ bin: o.bank.bin, account: o.bank.account, amount: o.amount, memo: o.code });
  res.json({ order: o });
});
router.post('/pay/orders/:id/cancel', requireUser, wrap((req, res) => {
  res.json({ order: payments.shape(payments.cancel(int(req.params.id), req.user.id)) });
}));
router.get('/me/ledger', requireUser, (req, res) => {
  res.json({ items: db.prepare('SELECT delta, balance, reason, created_at FROM xu_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id) });
});

// ---------- Webhook SePay: báo tiền vào tài khoản ngân hàng ----------
// Cấu hình trên my.sepay.vn: URL https://<tên miền>/api/pay/webhook/sepay, kiểu xác thực "API Key".
router.post('/pay/webhook/sepay', (req, res) => {
  const key = settings.getSecret('sepay_key');
  const got = String(req.get('authorization') || '').replace(/^Apikey\s+/i, '');
  const ok = key && got.length === key.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(key));
  if (!ok) return res.status(401).json({ success: false });
  const b = req.body || {};
  if (b.transferType && b.transferType !== 'in') return res.json({ success: true, ignored: 'out' });
  const amount = parseInt(b.transferAmount, 10);
  if (!b.id || !Number.isFinite(amount)) return res.status(400).json({ success: false });
  const r = payments.handleTransfer({ provider: 'sepay', ref: String(b.id), amount, content: `${b.content || ''} ${b.code || ''} ${b.description || ''}` });
  res.json({ success: true, ...r });
});

// ---------- Quản trị ----------
router.use('/admin/pay', requireAdmin);
router.get('/admin/pay/summary', (_req, res) => res.json(payments.summary()));
router.get('/admin/pay/orders', (req, res) => {
  payments.expireOld();
  const st = ['pending', 'paid', 'expired', 'cancelled', 'refunded'].includes(req.query.status) ? req.query.status : null;
  const code = clean(req.query.q || '', 20).toUpperCase();
  const rows = db.prepare(`SELECT o.*, u.nickname FROM payment_orders o LEFT JOIN users u ON u.id = o.user_id
    WHERE (? IS NULL OR o.status = ?) AND (? = '' OR o.code LIKE ?) ORDER BY o.id DESC LIMIT 200`).all(st, st, code, `%${code}%`);
  res.json({ items: rows.map((o) => ({ ...payments.shape(o), nickname: o.nickname, confirmedBy: o.confirmed_by, paidAmount: o.paid_amount })) });
});
router.post('/admin/pay/orders/:id/confirm', wrap((req, res) => res.json({ order: payments.shape(payments.confirmManual(int(req.params.id), req.user.nickname)) })));
router.post('/admin/pay/orders/:id/refund', wrap((req, res) => res.json({ order: payments.shape(payments.refund(int(req.params.id), req.user.nickname)) })));
router.post('/admin/pay/orders/:id/cancel', wrap((req, res) => res.json({ order: payments.shape(payments.cancel(int(req.params.id))) })));
router.get('/admin/pay/bank-tx', (_req, res) => {
  res.json({ items: db.prepare('SELECT * FROM bank_tx ORDER BY id DESC LIMIT 100').all() });
});
router.post('/admin/pay/bank-tx/:id/assign', wrap((req, res) => {
  const o = payments.assignTx(int(req.params.id), int(req.body && req.body.orderId), req.user.nickname);
  res.json({ order: payments.shape(o) });
}));
router.get('/admin/pay/settings', (req, res) => {
  const c = payments.config();
  res.json({
    ...c, packages: payments.packages(), banks: vietqr.BANKS, sepayKey: settings.secretHint('sepay_key'),
    webhookUrl: `${req.protocol}://${req.get('host')}/api/pay/webhook/sepay`,
  });
});
router.post('/admin/pay/settings', wrap(async (req, res) => {
  const b = req.body || {};
  const cur = settings.get('pay', {});
  const next = { ...cur };
  if (b.bank) {
    const bin = String(b.bank.bin || '').trim(), account = String(b.bank.account || '').replace(/\s/g, ''), name = clean(b.bank.name || '', 60).toUpperCase();
    if (bin && !/^\d{6}$/.test(bin)) throw new payments.PayError('Mã BIN ngân hàng phải gồm 6 chữ số.');
    if (account && !/^[0-9A-Za-z]{4,19}$/.test(account)) throw new payments.PayError('Số tài khoản không hợp lệ.');
    next.bank = { bin, account, name };
  }
  if (b.expiryMinutes !== undefined) {
    const m = parseInt(b.expiryMinutes, 10);
    if (!(m >= 5 && m <= 1440)) throw new payments.PayError('Thời hạn đơn từ 5 đến 1440 phút.');
    next.expiryMinutes = m;
  }
  if (b.allowBeforePaywall !== undefined) next.allowBeforePaywall = !!b.allowBeforePaywall;
  settings.set('pay', next);
  if (typeof b.sepayKey === 'string') settings.setSecret('sepay_key', b.sepayKey.trim());
  if (Array.isArray(b.packages)) {
    const seen = new Set();
    const list = b.packages.map((p) => ({
      id: String(p.id || '').trim(), label: clean(p.label || '', 40), xu: parseInt(p.xu, 10), vnd: parseInt(p.vnd, 10), stars: parseInt(p.stars, 10) || 0,
    }));
    for (const p of list) {
      if (!/^[a-z0-9_]{1,20}$/.test(p.id) || seen.has(p.id)) throw new payments.PayError(`Mã gói không hợp lệ hoặc bị trùng: ${p.id}`);
      if (!(p.xu > 0 && p.xu <= 100000 && p.vnd >= 1000 && p.vnd <= 100000000)) throw new payments.PayError(`Gói ${p.id}: số xu hoặc giá không hợp lệ (giá tối thiểu 1.000đ).`);
      seen.add(p.id);
    }
    if (!list.length) throw new payments.PayError('Cần ít nhất 1 gói xu.');
    settings.set('packages', list);
  }
  // Thử tạo mã QR với cấu hình mới để báo lỗi sớm
  let preview = null;
  if (payments.bankReady()) { const bk = payments.config().bank; preview = await vietqr.dataUrl({ bin: bk.bin, account: bk.account, amount: 10000, memo: 'XSTHU' }); }
  res.json({ ok: true, preview });
}));

module.exports = router;
