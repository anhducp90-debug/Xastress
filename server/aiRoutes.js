'use strict';
// Ví xu + gói "Cô Tư AI" mua theo món nước + trò chuyện stream (SSE).
const express = require('express');
const db = require('./db');
const ai = require('./ai');
const { DRINK_INFO, ECONOMY } = require('./constants');
const economy = require('./economy');
const { requireUser } = require('./auth');
const { clean, hasCrisisSignal } = require('./moderation');
const { hit } = require('./ratelimit');

const router = express.Router();
const q = {
  activePacks: db.prepare('SELECT * FROM ai_packs WHERE user_id = ? AND expires_at > ? AND turns_left > 0 ORDER BY id DESC'),
  activeDrink: db.prepare('SELECT * FROM ai_packs WHERE user_id = ? AND drink = ? AND expires_at > ? AND turns_left > 0 ORDER BY id DESC LIMIT 1'),
  pack: db.prepare('SELECT * FROM ai_packs WHERE id = ? AND user_id = ?'),
  insertPack: db.prepare('INSERT INTO ai_packs (user_id, drink, turns_left, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'),
  useTurn: db.prepare('UPDATE ai_packs SET turns_left = turns_left - 1 WHERE id = ? AND turns_left > 0'),
  refundTurn: db.prepare('UPDATE ai_packs SET turns_left = turns_left + 1 WHERE id = ?'),
  delPack: db.prepare('DELETE FROM ai_packs WHERE id = ? AND user_id = ?'),
  history: db.prepare('SELECT role, content FROM ai_messages WHERE pack_id = ? ORDER BY id DESC LIMIT 24'),
  allMsgs: db.prepare('SELECT role, content, created_at FROM ai_messages WHERE pack_id = ? ORDER BY id'),
  addMsg: db.prepare('INSERT INTO ai_messages (pack_id, role, content, created_at) VALUES (?, ?, ?, ?)'),
  delMsg: db.prepare('DELETE FROM ai_messages WHERE id = ?'),
};

const int = (v) => { const n = parseInt(v, 10); return Number.isSafeInteger(n) && n > 0 ? n : null; };
const shapePack = (p) => ({ id: p.id, drink: p.drink, turnsLeft: p.turns_left, expiresAt: p.expires_at });

router.get('/ai/status', (_req, res) => res.json({ enabled: ai.isEnabled(), turns: ECONOMY.packTurns, hours: ECONOMY.packHours, ...economy.status() }));

router.get('/ai/packs', requireUser, (req, res) => {
  res.json({ packs: q.activePacks.all(req.user.id, Date.now()).map(shapePack) });
});

// Gọi món = mở gói Cô Tư AI. Trả bằng: ly trong khay -> miễn phí (chưa thu phí) -> phiếu -> xu.
// Đang có gói cùng món còn hạn thì dùng tiếp, không tính thêm.
router.post('/ai/packs', requireUser, (req, res) => {
  const { drink } = req.body || {};
  if (!DRINK_INFO[drink]) return res.status(400).json({ error: 'Quán không có món này.' });
  if (!ai.isEnabled()) return res.status(503).json({ error: 'Cô Tư AI đang nghỉ, bạn dùng các bài tập nhanh trong menu nhé.', aiDisabled: true });
  const now = Date.now();
  const existing = q.activeDrink.get(req.user.id, drink, now);
  if (existing) return res.json({ pack: shapePack(existing), paid: null, wallet: economy.wallet(req.user.id) });
  try {
    const { id, plan } = db.transaction(() => {
      const pl = economy.pay(req.user.id, drink, 1, 'self');
      const pid = q.insertPack.run(req.user.id, drink, ECONOMY.packTurns, now + ECONOMY.packHours * 3600e3, now).lastInsertRowid;
      return { id: pid, plan: pl };
    })();
    res.json({ pack: shapePack(q.pack.get(id, req.user.id)), paid: economy.describe(plan), wallet: economy.wallet(req.user.id) });
  } catch (err) {
    if (err instanceof economy.NeedXu) return res.status(402).json({ error: `Ly này giá ${err.cost} xu, ví đang có ${err.have} xu.`, needXu: err.cost, xu: err.have });
    throw err;
  }
});

router.get('/ai/packs/:id', requireUser, (req, res) => {
  const p = q.pack.get(int(req.params.id), req.user.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy gói này.' });
  res.json({ pack: shapePack(p), messages: q.allMsgs.all(p.id).map((m) => ({ role: m.role, content: m.content, createdAt: m.created_at })) });
});

// Quyền riêng tư: xoá cuộc trò chuyện bất cứ lúc nào
router.delete('/ai/packs/:id', requireUser, (req, res) => {
  q.delPack.run(int(req.params.id), req.user.id);
  res.json({ ok: true });
});

router.post('/ai/packs/:id/chat', requireUser, async (req, res) => {
  const p = q.pack.get(int(req.params.id), req.user.id);
  const message = clean(req.body && req.body.message, 1000);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy gói này.' });
  if (!ai.isEnabled()) return res.status(503).json({ error: 'Cô Tư AI đang nghỉ.' });
  if (p.expires_at < Date.now() || p.turns_left <= 0) return res.status(402).json({ error: 'Ly này uống hết rồi, gọi ly mới để tâm sự tiếp nha.', expired: true });
  if ([...message].length < 1) return res.status(400).json({ error: 'Con muốn kể gì với cô?' });
  if (!hit(`ai:${req.user.id}`, 20, 10 * 60e3)) return res.status(429).json({ error: 'Từ từ thôi con, cô nghe không kịp. Nghỉ vài phút rồi kể tiếp nha.' });

  q.useTurn.run(p.id);
  const userMsgId = q.addMsg.run(p.id, 'user', message, Date.now()).lastInsertRowid;
  const history = q.history.all(p.id).reverse().map((m) => ({ role: m.role, content: m.content }));
  while (history.length && history[0].role !== 'user') history.shift();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no', // Nginx không gom bộ đệm, chữ hiện ra ngay
    Connection: 'keep-alive',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const abort = new AbortController();
  res.on('close', () => abort.abort());
  if (hasCrisisSignal(message)) send('crisis', true);

  try {
    const reply = await ai.streamReply(p.drink, history, (t) => send('delta', t), abort.signal);
    if (reply) q.addMsg.run(p.id, 'assistant', reply, Date.now());
    send('done', { turnsLeft: q.pack.get(p.id, req.user.id).turns_left });
  } catch (err) {
    // Lỗi thì hoàn lượt và bỏ tin nhắn chưa được trả lời
    q.refundTurn.run(p.id);
    q.delMsg.run(userMsgId);
    if (abort.signal.aborted) return res.end();
    let msg = 'Cô Tư đang bận chút, con thử lại sau nha.';
    if (err instanceof ai.Anthropic.RateLimitError) msg = 'Quán đang đông khách quá, con đợi một lát rồi kể tiếp nha.';
    else if (err instanceof ai.Anthropic.APIError) console.error('Lỗi Claude API', err.status, err.message);
    else console.error('Lỗi Cô Tư AI', err);
    send('error', msg);
  }
  res.end();
});

module.exports = router;
