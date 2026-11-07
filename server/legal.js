'use strict';
// Thông tin đơn vị vận hành hiển thị trên các trang Điều khoản / Chính sách (quản trị viên điền trong trang quản trị)
const express = require('express');
const settings = require('./settings');
const config = require('./config');
const { requireAdmin, TERMS_VERSION } = require('./auth');
const { clean } = require('./moderation');
const backup = require('./backup');

const FIELDS = {
  operator: 80,      // tên cá nhân / hộ kinh doanh / công ty vận hành
  businessId: 40,    // mã số thuế / số đăng ký kinh doanh (nếu có)
  address: 160,
  email: 80,
  phone: 30,
  telegram: 40,
  dpo: 80,           // người phụ trách bảo vệ dữ liệu cá nhân
};
function info() {
  const s = settings.get('legal', {});
  const out = {};
  for (const k of Object.keys(FIELDS)) out[k] = s[k] || '';
  return {
    ...out,
    domain: (config.publicOrigin || 'https://xastress.lopchungminh.net').replace(/^https?:\/\//, ''),
    termsVersion: TERMS_VERSION,
    minAge: 16,
    aiDailyPerUser: parseInt(process.env.AI_USER_DAILY || '60', 10),
    paywallUsers: config.paywall.users,
    paywallMode: config.paywall.mode,
    paywallOn: require('./economy').isPaywall(),
    packages: require('./payments').packages().map((p) => ({ label: p.label, xu: p.xu, vnd: p.vnd, stars: p.stars })),
    orderExpiryMinutes: require('./payments').config().expiryMinutes,
  };
}

const router = express.Router();
router.get('/site-info', (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.json(info()); });
router.get('/admin/legal', requireAdmin, (_req, res) => res.json(info()));
router.post('/admin/legal', requireAdmin, (req, res) => {
  const b = req.body || {};
  const next = {};
  for (const [k, max] of Object.entries(FIELDS)) next[k] = clean(String(b[k] || ''), max);
  if (next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) return res.status(400).json({ error: 'Email liên hệ không hợp lệ.' });
  settings.set('legal', next);
  res.json({ ok: true, info: info() });
});
router.get('/admin/backup', requireAdmin, (_req, res) => res.json(backup.status()));
router.post('/admin/backup', requireAdmin, async (_req, res) => {
  try { res.json({ ok: true, last: await backup.backupNow() }); } catch (err) { res.status(500).json({ error: err.message }); }
});
module.exports = router;
