'use strict';
const express = require('express');
const db = require('./db');
const { TABLES, MOODS, REACTIONS, DRINKS, ECONOMY } = require('./constants');
const { screenKindMessage } = require('./moderation');
const ai = require('./ai');
const { funnyReply, comboReply } = require('./funny');
const { clean, maskBadWords, hasCrisisSignal } = require('./moderation');
const { requireUser, requireAdmin } = require('./auth');
const { hit } = require('./ratelimit');
const realtime = require('./realtime');

const router = express.Router();
const AUTO_HIDE_REPORTS = 3;

const q = {
  post: db.prepare(`SELECT p.*, u.nickname, u.avatar FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`),
  list: db.prepare(`SELECT p.*, u.nickname, u.avatar FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.table_id = ? AND p.hidden = 0 AND p.id < ? ORDER BY p.id DESC LIMIT ?`),
  listAll: db.prepare(`SELECT p.*, u.nickname, u.avatar FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.hidden = 0 AND p.id < ? ORDER BY p.id DESC LIMIT ?`),
  mine: db.prepare(`SELECT p.*, u.nickname, u.avatar FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ? ORDER BY p.id DESC LIMIT 50`),
  reactCounts: db.prepare('SELECT kind, COUNT(*) n FROM reactions WHERE post_id = ? GROUP BY kind'),
  myReacts: db.prepare('SELECT kind FROM reactions WHERE post_id = ? AND user_id = ?'),
  commentCount: db.prepare('SELECT COUNT(*) n FROM comments WHERE post_id = ? AND hidden = 0'),
  comments: db.prepare(`SELECT c.*, u.nickname, u.avatar FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ? AND c.hidden = 0 ORDER BY c.id ASC LIMIT 300`),
  comment: db.prepare('SELECT * FROM comments WHERE id = ?'),
  insertPost: db.prepare('INSERT INTO posts (user_id, table_id, mood, content, anonymous, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  insertComment: db.prepare('INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)'),
  hasReact: db.prepare('SELECT 1 FROM reactions WHERE post_id = ? AND user_id = ? AND kind = ?'),
  addReact: db.prepare('INSERT INTO reactions (post_id, user_id, kind) VALUES (?, ?, ?)'),
  delReact: db.prepare('DELETE FROM reactions WHERE post_id = ? AND user_id = ? AND kind = ?'),
  resolve: db.prepare('UPDATE posts SET resolved = ? WHERE id = ?'),
  delPost: db.prepare('DELETE FROM posts WHERE id = ?'),
  delComment: db.prepare('DELETE FROM comments WHERE id = ?'),
  tableStats: db.prepare(`SELECT table_id, COUNT(*) n, MAX(created_at) last FROM posts
    WHERE hidden = 0 AND created_at > ? GROUP BY table_id`),
  addReport: db.prepare('INSERT OR IGNORE INTO reports (target_type, target_id, user_id, reason, created_at) VALUES (?, ?, ?, ?, ?)'),
  reportCount: db.prepare('SELECT COUNT(*) n FROM reports WHERE target_type = ? AND target_id = ?'),
  hidePost: db.prepare('UPDATE posts SET hidden = ? WHERE id = ?'),
  hideComment: db.prepare('UPDATE comments SET hidden = ? WHERE id = ?'),
  notify: db.prepare('INSERT INTO notifications (user_id, kind, post_id, actor, created_at) VALUES (?, ?, ?, ?, ?)'),
  notifs: db.prepare(`SELECT n.*, p.content FROM notifications n JOIN posts p ON p.id = n.post_id
    WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 30`),
  unread: db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND is_read = 0'),
  readAll: db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?'),
  reports: db.prepare(`SELECT target_type, target_id, COUNT(*) n, GROUP_CONCAT(reason, ' | ') reasons, MAX(created_at) last
    FROM reports GROUP BY target_type, target_id ORDER BY last DESC LIMIT 100`),
  ban: db.prepare('UPDATE users SET banned = 1 WHERE id = ?'),
  treatCounts: db.prepare('SELECT drink, SUM(qty) n FROM treats WHERE post_id = ? GROUP BY drink'),
  treatNotes: db.prepare(`SELECT t.drink, t.qty, t.message, t.created_at, u.nickname FROM treats t JOIN users u ON u.id = t.from_user
    WHERE t.post_id = ? AND t.message != '' ORDER BY t.id DESC LIMIT 40`),
  treatGivenToday: db.prepare('SELECT COALESCE(SUM(qty), 0) n FROM treats WHERE from_user = ? AND post_id = ? AND created_at > ?'),
  treatRecvToday: db.prepare('SELECT COALESCE(SUM(qty), 0) n FROM treats WHERE to_user = ? AND created_at > ?'),
  insertTreat: db.prepare('INSERT INTO treats (post_id, from_user, to_user, drink, qty, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  notifyTreat: db.prepare('INSERT INTO notifications (user_id, kind, post_id, actor, message, qty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  addXu: db.prepare('UPDATE users SET xu = xu + ? WHERE id = ?'),
  myTreatCounts: db.prepare('SELECT drink, SUM(qty) n FROM treats WHERE to_user = ? GROUP BY drink'),
  myTreatNotes: db.prepare(`SELECT t.drink, t.qty, t.message, t.created_at, t.post_id, u.nickname, substr(p.content, 1, 60) preview
    FROM treats t JOIN users u ON u.id = t.from_user JOIN posts p ON p.id = t.post_id
    WHERE t.to_user = ? ORDER BY t.id DESC LIMIT 40`),
  killSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
};

// Ẩn danh thật sự: không bao giờ trả user_id ra ngoài
function shapePost(p, viewer, { full = false } = {}) {
  const reactions = Object.fromEntries(REACTIONS.map((k) => [k, 0]));
  for (const r of q.reactCounts.all(p.id)) reactions[r.kind] = r.n;
  const out = {
    id: p.id,
    tableId: p.table_id,
    mood: p.mood,
    content: p.content,
    anonymous: !!p.anonymous,
    author: p.anonymous ? null : { nickname: p.nickname, avatar: JSON.parse(p.avatar) },
    isMine: !!viewer && viewer.id === p.user_id,
    resolved: !!p.resolved,
    hidden: !!p.hidden,
    createdAt: p.created_at,
    reactions,
    myReactions: viewer ? q.myReacts.all(p.id, viewer.id).map((r) => r.kind) : [],
    commentCount: q.commentCount.get(p.id).n,
    crisis: hasCrisisSignal(p.content),
    treats: treatSummary(q.treatCounts.all(p.id)),
  };
  if (full) {
    out.treatNotes = q.treatNotes.all(p.id).map((t) => ({ drink: t.drink, qty: t.qty, message: t.message, from: t.nickname, createdAt: t.created_at }));
    out.comments = q.comments.all(p.id).map((c) => {
      const byAuthor = c.user_id === p.user_id;
      return {
        id: c.id,
        content: c.content,
        byAuthor,
        // Nếu chủ tâm sự ẩn danh, bình luận của họ cũng ẩn danh
        author: byAuthor && p.anonymous ? null : { nickname: c.nickname, avatar: JSON.parse(c.avatar) },
        isMine: !!viewer && viewer.id === c.user_id,
        createdAt: c.created_at,
      };
    });
  }
  return out;
}

// Bộ đếm ly nước theo từng món + lời đáp hài hước theo số lượng
function treatSummary(rows) {
  const counts = {};
  let total = 0, top = null;
  for (const r of rows) { counts[r.drink] = r.n; total += r.n; if (!top || r.n > counts[top]) top = r.drink; }
  const kinds = Object.keys(counts).length;
  return {
    counts, total,
    funny: top ? (comboReply(total, kinds) || funnyReply(top, counts[top])) : '',
  };
}

const int = (v) => {
  const n = parseInt(v, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

router.get('/tables', (_req, res) => {
  const since = Date.now() - 7 * 86400e3;
  const stats = Object.fromEntries(q.tableStats.all(since).map((r) => [r.table_id, r]));
  res.json({
    tables: Object.entries(TABLES).map(([id, name]) => ({
      id, name, recent: stats[id] ? stats[id].n : 0, last: stats[id] ? stats[id].last : null,
    })),
  });
});

router.get('/posts', (req, res) => {
  const before = int(req.query.before) || Number.MAX_SAFE_INTEGER;
  const limit = Math.min(int(req.query.limit) || 20, 50);
  const table = req.query.table;
  if (table && !TABLES[table]) return res.status(400).json({ error: 'Bàn không tồn tại.' });
  const rows = table ? q.list.all(table, before, limit) : q.listAll.all(before, limit);
  res.json({ posts: rows.map((p) => shapePost(p, req.user)) });
});

router.get('/posts/mine', requireUser, (req, res) => {
  res.json({ posts: q.mine.all(req.user.id).map((p) => shapePost(p, req.user)) });
});

router.get('/posts/:id', (req, res) => {
  const p = q.post.get(int(req.params.id));
  const canSee = p && (!p.hidden || (req.user && (req.user.id === p.user_id || req.user.is_admin)));
  if (!canSee) return res.status(404).json({ error: 'Không tìm thấy tâm sự này.' });
  res.json({ post: shapePost(p, req.user, { full: true }) });
});

router.post('/posts', requireUser, (req, res) => {
  const { tableId, mood, anonymous } = req.body || {};
  if (!TABLES[tableId]) return res.status(400).json({ error: 'Chọn bàn để ngồi đã nhé.' });
  const content = clean(req.body && req.body.content, 3000);
  if ([...content].length < 10) return res.status(400).json({ error: 'Kể thêm chút nữa đi, ít nhất 10 ký tự.' });
  if (!hit(`post:${req.user.id}`, 5, 30 * 60e3)) {
    return res.status(429).json({ error: 'Uống chậm thôi! Bạn đã gửi khá nhiều tâm sự, nghỉ một lát rồi kể tiếp nhé.' });
  }
  const m = MOODS.includes(mood) ? mood : 'met';
  const info = q.insertPost.run(req.user.id, tableId, m, maskBadWords(content), anonymous ? 1 : 0, Date.now());
  const post = shapePost(q.post.get(info.lastInsertRowid), req.user);
  realtime.broadcast('post:new', { id: post.id, tableId, mood: m });
  res.json({ post });
});

router.post('/posts/:id/react', requireUser, (req, res) => {
  const p = q.post.get(int(req.params.id));
  const { kind } = req.body || {};
  if (!p || p.hidden) return res.status(404).json({ error: 'Không tìm thấy tâm sự này.' });
  if (!REACTIONS.includes(kind)) return res.status(400).json({ error: 'Cảm xúc không hợp lệ.' });
  if (!hit(`react:${req.user.id}`, 60, 60e3)) return res.status(429).json({ error: 'Chậm lại chút nhé.' });
  let added = false;
  if (q.hasReact.get(p.id, req.user.id, kind)) {
    q.delReact.run(p.id, req.user.id, kind);
  } else {
    q.addReact.run(p.id, req.user.id, kind);
    added = true;
    if (p.user_id !== req.user.id) {
      q.notify.run(p.user_id, `react:${kind}`, p.id, req.user.nickname, Date.now());
      realtime.notifyUser(p.user_id, { kind: `react:${kind}`, postId: p.id, actor: req.user.nickname });
    }
  }
  const post = shapePost(p, req.user);
  realtime.broadcast('post:update', { id: p.id, tableId: p.table_id, reactions: post.reactions });
  res.json({ added, reactions: post.reactions, myReactions: post.myReactions });
});

router.post('/posts/:id/comments', requireUser, (req, res) => {
  const p = q.post.get(int(req.params.id));
  if (!p || p.hidden) return res.status(404).json({ error: 'Không tìm thấy tâm sự này.' });
  const content = clean(req.body && req.body.content, 1000);
  if ([...content].length < 2) return res.status(400).json({ error: 'Lời động viên trống rồi.' });
  if (!hit(`comment:${req.user.id}`, 20, 10 * 60e3)) {
    return res.status(429).json({ error: 'Bạn nhiệt tình quá! Nghỉ tay một chút rồi viết tiếp nhé.' });
  }
  q.insertComment.run(p.id, req.user.id, maskBadWords(content), Date.now());
  if (p.user_id !== req.user.id) {
    q.notify.run(p.user_id, 'comment', p.id, req.user.nickname, Date.now());
    realtime.notifyUser(p.user_id, { kind: 'comment', postId: p.id, actor: req.user.nickname });
  }
  res.json({ post: shapePost(q.post.get(p.id), req.user, { full: true }) });
});

// Mời người kể chuyện một hoặc nhiều ly nước, kèm lời nhắn (đã kiểm duyệt)
const KIND_SUGGEST = [
  'Mình hiểu cảm giác này, bạn không một mình đâu.', 'Bạn đã cố gắng nhiều lắm rồi.',
  'Nghỉ ngơi chút đi, mọi chuyện rồi sẽ ổn.', 'Uống ly nước cho mát, rồi mình tính tiếp nha.',
];
async function checkKind(message) {
  const local = screenKindMessage(message);
  if (local.hard) return { ok: false, reason: 'Lời nhắn có từ ngữ thô tục.' };
  if (ai.isEnabled()) {
    try {
      const r = await ai.classifyKindMessage(message);
      return { ok: r.verdict === 'ok', reason: r.reason };
    } catch (err) {
      console.warn('Phân loại lời nhắn bằng AI lỗi, dùng bộ lọc từ khoá:', err.status || err.name);
    }
  }
  return { ok: local.ok, reason: local.ok ? '' : `Có cụm từ dễ làm người nhận buồn lòng: "${local.hits.join('", "')}".` };
}

router.post('/posts/:id/treat', requireUser, async (req, res) => {
  const p = q.post.get(int(req.params.id));
  const { drink } = req.body || {};
  const qty = [1, 3, 10].includes(Number(req.body && req.body.qty)) ? Number(req.body.qty) : 1;
  const message = clean(req.body && req.body.message, 200).replace(/\s+/g, ' ');
  if (!p || p.hidden) return res.status(404).json({ error: 'Không tìm thấy tâm sự này.' });
  if (!DRINKS.includes(drink)) return res.status(400).json({ error: 'Quán không có món này.' });
  if (p.user_id === req.user.id) return res.status(400).json({ error: 'Tự mời mình thì gọi thẳng ở quầy nhé 😄' });
  const dayAgo = Date.now() - 86400e3;
  if (q.treatGivenToday.get(req.user.id, p.id, dayAgo).n + qty > 20) {
    return res.status(429).json({ error: 'Hôm nay bạn đã mời người này nhiều lắm rồi, để họ uống từ từ đã 😅' });
  }
  if (!hit(`treat:${req.user.id}`, 40, 86400e3)) return res.status(429).json({ error: 'Bạn hào phóng quá! Mai mời tiếp nhé.' });
  if (message) {
    const verdict = await checkKind(message);
    if (!verdict.ok) {
      return res.status(422).json({
        error: 'Lời nhắn này có thể làm người nhận buồn lòng thêm, quán chưa gửi được.',
        blocked: true, reason: verdict.reason, suggestions: KIND_SUGGEST,
      });
    }
  }
  const now = Date.now();
  q.insertTreat.run(p.id, req.user.id, p.user_id, drink, qty, message, now);
  q.notifyTreat.run(p.user_id, `treat:${drink}`, p.id, req.user.nickname, message, qty, now);
  // Người được mời nhận thêm xu để gọi gói Cô Tư AI (có trần mỗi ngày)
  const recvToday = q.treatRecvToday.get(p.user_id, dayAgo).n - qty;
  const bonus = Math.max(0, Math.min(qty * ECONOMY.xuPerTreatReceived, ECONOMY.xuFromTreatsPerDay - recvToday));
  if (bonus) q.addXu.run(bonus, p.user_id);
  const summary = treatSummary(q.treatCounts.all(p.id));
  const reply = funnyReply(drink, summary.counts[drink]);
  realtime.notifyUser(p.user_id, {
    kind: `treat:${drink}`, postId: p.id, actor: req.user.nickname, qty, message, total: summary.counts[drink], funny: reply, bonus,
  });
  realtime.broadcast('treat', { postId: p.id, tableId: p.table_id, drink, qty });
  res.json({ ok: true, treats: summary, reply, count: summary.counts[drink] });
});

// Quầy quà của tôi: tổng số ly nhận được theo món + lời nhắn
router.get('/me/treats', requireUser, (req, res) => {
  res.json({
    treats: treatSummary(q.myTreatCounts.all(req.user.id)),
    notes: q.myTreatNotes.all(req.user.id).map((t) => ({
      drink: t.drink, qty: t.qty, message: t.message, from: t.nickname, createdAt: t.created_at, postId: t.post_id, preview: t.preview,
    })),
  });
});

router.post('/posts/:id/resolve', requireUser, (req, res) => {
  const p = q.post.get(int(req.params.id));
  if (!p || p.user_id !== req.user.id) return res.status(404).json({ error: 'Không tìm thấy tâm sự này.' });
  q.resolve.run(p.resolved ? 0 : 1, p.id);
  res.json({ post: shapePost(q.post.get(p.id), req.user, { full: true }) });
});

router.delete('/posts/:id', requireUser, (req, res) => {
  const p = q.post.get(int(req.params.id));
  if (!p || (p.user_id !== req.user.id && !req.user.is_admin)) return res.status(404).json({ error: 'Không tìm thấy.' });
  q.delPost.run(p.id);
  realtime.broadcast('post:remove', { id: p.id, tableId: p.table_id });
  res.json({ ok: true });
});

router.delete('/comments/:id', requireUser, (req, res) => {
  const c = q.comment.get(int(req.params.id));
  if (!c || (c.user_id !== req.user.id && !req.user.is_admin)) return res.status(404).json({ error: 'Không tìm thấy.' });
  q.delComment.run(c.id);
  res.json({ ok: true });
});

router.post('/report', requireUser, (req, res) => {
  const { type, id } = req.body || {};
  const tid = int(id);
  const reason = clean(req.body && req.body.reason, 200);
  if (!['post', 'comment'].includes(type) || !tid) return res.status(400).json({ error: 'Báo cáo không hợp lệ.' });
  const target = type === 'post' ? q.post.get(tid) : q.comment.get(tid);
  if (!target) return res.status(404).json({ error: 'Không tìm thấy.' });
  q.addReport.run(type, tid, req.user.id, reason, Date.now());
  if (q.reportCount.get(type, tid).n >= AUTO_HIDE_REPORTS) {
    (type === 'post' ? q.hidePost : q.hideComment).run(1, tid);
  }
  res.json({ ok: true });
});

router.get('/notifications', requireUser, (req, res) => {
  res.json({
    unread: q.unread.get(req.user.id).n,
    items: q.notifs.all(req.user.id).map((n) => ({
      id: n.id, kind: n.kind, postId: n.post_id, actor: n.actor, read: !!n.is_read, message: n.message, qty: n.qty,
      createdAt: n.created_at, preview: n.content.slice(0, 60),
    })),
  });
});
router.post('/notifications/read', requireUser, (req, res) => {
  q.readAll.run(req.user.id);
  res.json({ ok: true });
});

// ---- Quản trị ----
router.get('/admin/reports', requireAdmin, (_req, res) => {
  res.json({
    reports: q.reports.all().map((r) => {
      const t = r.target_type === 'post' ? q.post.get(r.target_id) : q.comment.get(r.target_id);
      return {
        type: r.target_type, id: r.target_id, count: r.n, reasons: r.reasons, last: r.last,
        exists: !!t, hidden: t ? !!t.hidden : null, content: t ? t.content.slice(0, 300) : null,
        postId: t ? (r.target_type === 'post' ? t.id : t.post_id) : null,
      };
    }),
  });
});
router.post('/admin/hide', requireAdmin, (req, res) => {
  const { type, id, hidden } = req.body || {};
  const tid = int(id);
  if (!['post', 'comment'].includes(type) || !tid) return res.status(400).json({ error: 'Không hợp lệ.' });
  (type === 'post' ? q.hidePost : q.hideComment).run(hidden ? 1 : 0, tid);
  res.json({ ok: true });
});
router.post('/admin/ban', requireAdmin, (req, res) => {
  const { type, id } = req.body || {};
  const tid = int(id);
  const t = type === 'post' ? q.post.get(tid) : type === 'comment' ? q.comment.get(tid) : null;
  if (!t) return res.status(404).json({ error: 'Không tìm thấy.' });
  if (t.user_id === req.user.id) return res.status(400).json({ error: 'Không thể tự khoá mình.' });
  q.ban.run(t.user_id);
  q.killSessions.run(t.user_id);
  realtime.kickUser(t.user_id);
  res.json({ ok: true });
});

module.exports = router;
