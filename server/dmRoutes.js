'use strict';
// Tin nhắn riêng (đọc lịch sử) và danh sách chặn. Gửi tin nhắn đi qua socket ('dm').
const express = require('express');
const db = require('./db');
const { requireUser } = require('./auth');

const router = express.Router();
const q = {
  convos: db.prepare(`
    SELECT peer, MAX(id) last_id, SUM(CASE WHEN to_user = @me AND is_read = 0 THEN 1 ELSE 0 END) unread FROM (
      SELECT id, to_user, is_read, CASE WHEN from_user = @me THEN to_user ELSE from_user END peer FROM dms
      WHERE from_user = @me OR to_user = @me)
    GROUP BY peer ORDER BY last_id DESC LIMIT 50`),
  msg: db.prepare('SELECT * FROM dms WHERE id = ?'),
  nick: db.prepare('SELECT id, nickname FROM users WHERE id = ?'),
  thread: db.prepare(`SELECT id, from_user, to_user, text, created_at FROM dms
    WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?) ORDER BY id DESC LIMIT 100`),
  markRead: db.prepare('UPDATE dms SET is_read = 1 WHERE to_user = ? AND from_user = ? AND is_read = 0'),
  unread: db.prepare('SELECT COUNT(*) n FROM dms WHERE to_user = ? AND is_read = 0'),
  block: db.prepare('INSERT OR IGNORE INTO blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)'),
  unblock: db.prepare('DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?'),
  blocks: db.prepare('SELECT b.blocked_id uid, u.nickname FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.user_id = ?'),
};
const int = (v) => { const n = parseInt(v, 10); return Number.isSafeInteger(n) && n > 0 ? n : null; };

router.get('/dms', requireUser, (req, res) => {
  const me = req.user.id;
  const items = q.convos.all({ me }).map((c) => {
    const peer = q.nick.get(c.peer);
    const last = q.msg.get(c.last_id);
    return peer && { uid: peer.id, nickname: peer.nickname, unread: c.unread, last: { text: last.text.slice(0, 80), at: last.created_at, mine: last.from_user === me } };
  }).filter(Boolean);
  res.json({ items, unread: q.unread.get(me).n });
});

router.get('/dms/:uid', requireUser, (req, res) => {
  const me = req.user.id, peer = q.nick.get(int(req.params.uid));
  if (!peer) return res.status(404).json({ error: 'Không tìm thấy người này.' });
  q.markRead.run(me, peer.id);
  const items = q.thread.all(me, peer.id, peer.id, me).reverse()
    .map((m) => ({ id: m.id, mine: m.from_user === me, text: m.text, at: m.created_at }));
  res.json({ peer: { uid: peer.id, nickname: peer.nickname }, items, blocked: q.blocks.all(me).some((b) => b.uid === peer.id) });
});

router.get('/blocks', requireUser, (req, res) => res.json({ items: q.blocks.all(req.user.id) }));
router.post('/blocks', requireUser, (req, res) => {
  const uid = int(req.body && req.body.uid);
  if (!uid || uid === req.user.id || !q.nick.get(uid)) return res.status(400).json({ error: 'Không hợp lệ.' });
  q.block.run(req.user.id, uid, Date.now());
  res.json({ ok: true });
});
router.delete('/blocks/:uid', requireUser, (req, res) => { q.unblock.run(req.user.id, int(req.params.uid)); res.json({ ok: true }); });

module.exports = router;
