'use strict';
// Ví: khay nước, phiếu chào mừng, xu, trạng thái thu phí, mua xu qua bot Telegram.
const express = require('express');
const economy = require('./economy');
const telegram = require('./telegram');
const { requireUser } = require('./auth');
const { DRINKS, XU_PACKAGES } = require('./constants');
const { hit } = require('./ratelimit');

const router = express.Router();

router.get('/economy', (_req, res) => res.json(economy.status()));

router.get('/wallet', requireUser, (req, res) => {
  res.json({
    ...economy.wallet(req.user.id),
    economy: economy.status(),
    telegram: { enabled: telegram.enabled(), linked: telegram.linkInfo(req.user.id), bot: telegram.botUsername(), packages: XU_PACKAGES },
  });
});

// Xem trước sẽ trả bằng gì trước khi uống/tặng
router.get('/wallet/quote', requireUser, (req, res) => {
  const { drink, purpose } = req.query;
  const qty = [1, 3, 10].includes(Number(req.query.qty)) ? Number(req.query.qty) : 1;
  if (!DRINKS.includes(drink) || !['self', 'gift'].includes(purpose)) return res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
  const plan = economy.quote(req.user.id, drink, qty, purpose);
  res.json({ ...plan, text: economy.describe(plan) });
});

// Tạo đường dẫn mở bot Telegram (mã dùng một lần, hết hạn sau 15 phút)
router.post('/telegram/link', requireUser, (req, res) => {
  if (!telegram.enabled()) return res.status(503).json({ error: 'Quán chưa mở bán xu qua Telegram.' });
  if (!hit(`tglink:${req.user.id}`, 10, 3600e3)) return res.status(429).json({ error: 'Thử lại sau ít phút nhé.' });
  const r = telegram.createLinkCode(req.user.id);
  if (!r.url) return res.status(503).json({ error: 'Bot Telegram đang khởi động, thử lại sau ít phút.' });
  res.json(r);
});
router.post('/telegram/unlink', requireUser, (req, res) => { telegram.unlink(req.user.id); res.json({ ok: true }); });

module.exports = router;
