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

// Xem trước: gọi 1 ly món này sẽ trả bằng gì, khay đang có bao nhiêu ly để tặng
router.get('/wallet/quote', requireUser, (req, res) => {
  const { drink } = req.query;
  if (!DRINKS.includes(drink)) return res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
  res.json(economy.quoteOrder(req.user.id, drink));
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
