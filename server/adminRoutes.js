'use strict';
// API trang quản trị (/admin.html) – chỉ quản trị viên (ADMIN_USERNAMES).
const express = require('express');
const db = require('./db');
const config = require('./config');
const settings = require('./settings');
const providers = require('./aiProviders');
const economy = require('./economy');
const realtime = require('./realtime');
const host = require('./host');
const { requireAdmin } = require('./auth');
const { DRINK_INFO } = require('./constants');
const { clean } = require('./moderation');

const router = express.Router();
router.use('/admin', requireAdmin);

const COTU_KEYS = ['enabled', 'quietMinutes', 'gapMinutes', 'tableQuietMinutes', 'pollMinutes', 'postCommentDelaySec', 'nudgeSeconds'];

// Nạp cài đặt đã lưu vào cấu hình đang chạy (gọi lúc khởi động và sau mỗi lần lưu)
function applyStored() {
  const pw = settings.get('paywall');
  if (pw) Object.assign(config.paywall, pw);
  const prices = settings.get('prices', {});
  for (const [k, v] of Object.entries(prices)) if (DRINK_INFO[k]) DRINK_INFO[k].price = v;
  const ct = settings.get('cotu');
  if (ct) Object.assign(config.cotu, ct);
  economy.resetCache();
}

const startOfDay = () => { const d = new Date(Date.now() + 7 * 3600e3); d.setUTCHours(0, 0, 0, 0); return d.getTime() - 7 * 3600e3; }; // 0h giờ VN
const n = (sql, ...a) => db.prepare(sql).get(...a).n;

router.get('/admin/overview', (_req, res) => {
  const t0 = startOfDay();
  const ai = providers.current();
  res.json({
    online: realtime.stats().online,
    users: n('SELECT COUNT(*) n FROM users WHERE is_bot = 0'),
    newUsersToday: n('SELECT COUNT(*) n FROM users WHERE is_bot = 0 AND created_at >= ?', t0),
    banned: n('SELECT COUNT(*) n FROM users WHERE banned = 1'),
    economy: economy.status(),
    postsToday: n('SELECT COUNT(*) n FROM posts WHERE created_at >= ?', t0),
    postsTotal: n('SELECT COUNT(*) n FROM posts'),
    commentsToday: n('SELECT COUNT(*) n FROM comments WHERE created_at >= ?', t0),
    ordersToday: n('SELECT COUNT(*) n FROM orders WHERE created_at >= ?', t0),
    cupsGiftedToday: n('SELECT COALESCE(SUM(qty),0) n FROM treats WHERE created_at >= ?', t0) + n('SELECT COALESCE(SUM(qty),0) n FROM direct_gifts WHERE created_at >= ?', t0),
    dmsToday: n('SELECT COUNT(*) n FROM dms WHERE created_at >= ?', t0),
    openReports: n('SELECT COUNT(DISTINCT target_type || target_id) n FROM reports'),
    payments: db.prepare('SELECT COUNT(*) count, COALESCE(SUM(stars),0) stars, COALESCE(SUM(xu),0) xu FROM payments').get(),
    ai: { provider: ai.provider, chosen: ai.chosen, model: ai.chatModel, fastModel: ai.fastModel, usage: providers.usage, dailyCap: providers.dailyCap(), usedToday: providers.usedToday(), overCap: providers.overCap() },
    cotu: { enabled: config.cotu.enabled },
  });
});

// ---------- Cài đặt AI ----------
router.get('/admin/settings', (_req, res) => {
  const s = settings.get('ai', {});
  const c = providers.current();
  res.json({
    ai: {
      provider: c.chosen, active: c.provider, effort: c.effort, dailyCap: providers.dailyCap(), usedToday: providers.usedToday(),
      // models[p] = { chat: model tâm sự, fast: model hoạt náo & kiểm duyệt }
      models: Object.fromEntries(providers.PROVIDERS.map((p) => {
        const m = (s.models || {})[p];
        const chat = (typeof m === 'string' ? m : m && m.chat) || providers.DEFAULT_MODELS[p];
        return [p, { chat, fast: (typeof m === 'string' ? m : m && m.fast) || chat }];
      })),
      recommended: providers.RECOMMENDED,
      keys: Object.fromEntries(providers.PROVIDERS.map((p) => [p, settings.secretHint(`${p}_key`) || (process.env[{ anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY' }[p]] ? '(.env)' : null)])),
    },
    cotu: Object.fromEntries(COTU_KEYS.map((k) => [k, config.cotu[k]])),
    paywall: { mode: config.paywall.mode, users: config.paywall.users },
    prices: Object.fromEntries(Object.entries(DRINK_INFO).map(([k, v]) => [k, v.price])),
    drinks: Object.fromEntries(Object.entries(DRINK_INFO).map(([k, v]) => [k, v.name])),
    packages: require('./payments').packages(),
  });
});

router.post('/admin/settings/ai', (req, res) => {
  const b = req.body || {};
  const cur = settings.get('ai', {});
  const next = { ...cur };
  if (b.provider !== undefined) {
    if (![...providers.PROVIDERS, 'none'].includes(b.provider)) return res.status(400).json({ error: 'Nhà cung cấp không hợp lệ.' });
    next.provider = b.provider;
  }
  if (b.models) {
    next.models = { ...(cur.models || {}) };
    const okName = (v) => typeof v === 'string' && /^[\w.:\-/]{2,80}$/.test(v.trim());
    for (const p of providers.PROVIDERS) {
      const m = b.models[p];
      if (m === undefined) continue;
      const prev = typeof next.models[p] === 'object' ? next.models[p] : {};
      const val = typeof m === 'string' ? { chat: m, fast: m } : m;
      for (const k of ['chat', 'fast']) {
        if (val[k] === undefined || val[k] === '') continue;
        if (!okName(val[k])) return res.status(400).json({ error: `Tên model không hợp lệ: ${String(val[k]).slice(0, 40)}` });
        prev[k] = val[k].trim();
      }
      next.models[p] = prev;
    }
  }
  if (b.dailyCap !== undefined) {
    const n = parseInt(b.dailyCap, 10);
    if (!(n >= 0 && n <= 1000000)) return res.status(400).json({ error: 'Giới hạn lượt AI mỗi ngày không hợp lệ.' });
    next.dailyCap = n;
  }
  if (b.effort !== undefined) {
    if (!['low', 'medium', 'high'].includes(b.effort)) return res.status(400).json({ error: 'Mức suy nghĩ không hợp lệ.' });
    next.effort = b.effort;
  }
  settings.set('ai', next);
  // keys: { openai: 'sk-...' } để lưu, '' để xoá, bỏ trống để giữ nguyên
  if (b.keys) for (const p of providers.PROVIDERS) if (typeof b.keys[p] === 'string') settings.setSecret(`${p}_key`, b.keys[p].trim());
  res.json({ ok: true, active: providers.current().provider });
});

// Danh sách model lấy trực tiếp từ nhà cung cấp (cần khoá API của nhà cung cấp đó)
router.get('/admin/ai/models', async (req, res) => {
  const p = req.query.provider;
  if (!providers.PROVIDERS.includes(p)) return res.status(400).json({ error: 'Nhà cung cấp không hợp lệ.' });
  try { res.json({ recommended: providers.RECOMMENDED[p], live: await providers.listModels(p) }); }
  catch (err) { res.json({ recommended: providers.RECOMMENDED[p], live: [], error: `Không tải được danh sách: ${err.message.slice(0, 160)}` }); }
});

router.post('/admin/ai/test', async (_req, res) => {
  const c = providers.current();
  if (c.provider === 'none') return res.status(400).json({ error: 'Chưa có nhà cung cấp AI nào dùng được (kiểm tra khoá API).' });
  const t = Date.now();
  try {
    const text = await providers.complete({ system: 'Bạn là Cô Tư, bà chủ quán trà đá vỉa hè. Trả lời bằng tiếng Việt, một câu ngắn.', user: 'Chào cả quán một câu thật ngắn.' });
    res.json({ ok: true, provider: c.provider, model: c.fastModel, chatModel: c.chatModel, ms: Date.now() - t, text });
  } catch (err) {
    res.status(502).json({ error: `Gọi ${c.provider} thất bại: ${err.message.slice(0, 200)}` });
  }
});

// ---------- Cô Tư hoạt náo ----------
router.post('/admin/settings/cotu', (req, res) => {
  const b = req.body || {};
  const next = { ...settings.get('cotu', {}) };
  for (const k of COTU_KEYS) {
    if (b[k] === undefined) continue;
    if (k === 'enabled') next.enabled = !!b.enabled;
    else { const v = Number(b[k]); if (!Number.isFinite(v) || v <= 0 || v > 1440) return res.status(400).json({ error: `Giá trị ${k} không hợp lệ.` }); next[k] = v; }
  }
  settings.set('cotu', next);
  applyStored();
  res.json({ ok: true, cotu: next });
});
router.post('/admin/cotu/say', (req, res) => {
  const text = clean(req.body && req.body.text, 400);
  const channel = realtime.CHANNELS.includes(req.body && req.body.channel) ? req.body.channel : 'public';
  if (!text) return res.status(400).json({ error: 'Nhập nội dung Cô Tư nói.' });
  host.say(channel, text);
  res.json({ ok: true });
});
router.post('/admin/cotu/topic', async (req, res) => {
  const channel = realtime.CHANNELS.includes(req.body && req.body.channel) ? req.body.channel : 'public';
  await host.startTopic(channel, !!(req.body && req.body.poll));
  res.json({ ok: true });
});
router.post('/admin/cotu/poll', (req, res) => {
  const question = clean(req.body && req.body.question, 160);
  const options = (Array.isArray(req.body && req.body.options) ? req.body.options : []).map((o) => clean(o, 40)).filter(Boolean).slice(0, 4);
  if (!question || options.length < 2) return res.status(400).json({ error: 'Cần câu hỏi và ít nhất 2 lựa chọn.' });
  const p = host.startPoll('public', question, options);
  res.json({ ok: true, id: p.id });
});
router.get('/admin/chat', (req, res) => {
  const channel = realtime.CHANNELS.includes(req.query.channel) ? req.query.channel : 'public';
  res.json({ channel, items: realtime.getHistory(channel) });
});

// ---------- Kinh tế ----------
router.post('/admin/settings/economy', (req, res) => {
  const b = req.body || {};
  if (b.paywall) {
    const pw = { ...settings.get('paywall', {}) };
    if (b.paywall.mode !== undefined) { if (!['auto', 'on', 'off'].includes(b.paywall.mode)) return res.status(400).json({ error: 'Chế độ thu phí không hợp lệ.' }); pw.mode = b.paywall.mode; }
    if (b.paywall.users !== undefined) { const u = parseInt(b.paywall.users, 10); if (!(u > 0)) return res.status(400).json({ error: 'Số khách không hợp lệ.' }); pw.users = u; }
    settings.set('paywall', pw);
  }
  if (b.prices) {
    const pr = { ...settings.get('prices', {}) };
    for (const [k, v] of Object.entries(b.prices)) {
      const p = parseInt(v, 10);
      if (!DRINK_INFO[k] || !(p >= 0 && p <= 10000)) return res.status(400).json({ error: `Giá ${k} không hợp lệ.` });
      pr[k] = p;
    }
    settings.set('prices', pr);
  }
  applyStored();
  res.json({ ok: true, economy: economy.status() });
});

// ---------- Người dùng ----------
router.get('/admin/users', (req, res) => {
  const qtext = clean(req.query.q || '', 40);
  const rows = db.prepare(`SELECT u.id, u.nickname, u.created_at, u.banned, u.is_admin, u.xu, u.last_seen,
      (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) posts,
      (SELECT COUNT(*) FROM reports r JOIN posts p ON r.target_type = 'post' AND p.id = r.target_id WHERE p.user_id = u.id) reported
    FROM users u WHERE u.is_bot = 0 AND u.nickname LIKE ? ORDER BY u.id DESC LIMIT 100`).all(`%${qtext}%`);
  const online = new Set(realtime.stats().onlineIds);
  res.json({ items: rows.map((r) => ({ ...r, online: online.has(r.id) })) });
});
router.post('/admin/users/:id/ban', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) return res.status(400).json({ error: 'Không thể tự khoá mình.' });
  const banned = req.body && req.body.banned ? 1 : 0;
  db.prepare('UPDATE users SET banned = ? WHERE id = ? AND is_bot = 0').run(banned, id);
  if (banned) { db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id); realtime.kickUser(id); }
  economy.resetCache();
  res.json({ ok: true });
});
router.post('/admin/users/:id/xu', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const delta = parseInt(req.body && req.body.delta, 10);
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 100000) return res.status(400).json({ error: 'Số xu không hợp lệ.' });
  if (!db.prepare('SELECT 1 FROM users WHERE id = ? AND is_bot = 0').get(id)) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
  const xu = economy.addXu(id, delta, `Quản trị viên ${req.user.nickname} điều chỉnh`, `admin:${req.user.id}`);
  res.json({ ok: true, xu });
});

// ---------- Bài tâm sự & thanh toán ----------
router.get('/admin/posts', (_req, res) => {
  const rows = db.prepare(`SELECT p.id, p.table_id, p.mood, p.content, p.anonymous, p.hidden, p.resolved, p.created_at, u.nickname,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) comments,
      (SELECT COUNT(*) FROM reports r WHERE r.target_type = 'post' AND r.target_id = p.id) reports
    FROM posts p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 100`).all();
  res.json({ items: rows });
});
router.get('/admin/payments', (_req, res) => {
  res.json({ items: db.prepare(`SELECT pm.id, pm.package, pm.xu, pm.stars, pm.charge_id, pm.created_at, u.nickname FROM payments pm
    LEFT JOIN users u ON u.id = pm.user_id ORDER BY pm.id DESC LIMIT 200`).all() });
});

module.exports = router;
module.exports.applyStored = applyStored;
