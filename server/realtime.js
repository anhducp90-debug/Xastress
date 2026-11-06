'use strict';
// Không gian quán realtime: nhân vật, chat 3 kênh (cả quán / theo bàn / tin riêng),
// biểu cảm, và tương tác với người khác: động viên, an ủi, tặng nước.
// Muốn chat hay tương tác thì phải "ngồi vào quán" = gọi 1 ly trong lượt vào quán này.
const { maskBadWords, sanitize, clean, hasCrisisSignal, screenKindMessage } = require('./moderation');
const { hit } = require('./ratelimit');
const { DRINKS, TABLES } = require('./constants');

const WORLD = { w: 640, h: 448 };
const EMOTES = ['wave', 'heart', 'hug', 'cheer', 'tea', 'sad', 'laugh'];
const CHANNELS = ['public', ...Object.keys(TABLES).map((t) => `table:${t}`)];
const HISTORY = 60;
const CHEERS = {
  dongvien: { emote: 'cheer', lines: ['Cố lên bạn ơi, bạn làm được mà! 💪', 'Mình tin bạn sẽ vượt qua!', 'Từng bước nhỏ thôi, bạn đang làm tốt lắm!', 'Hôm nay vất vả rồi, bạn giỏi lắm!'] },
  anui: { emote: 'hug', lines: ['Ôm bạn một cái thật chặt 🤗', 'Có mình ở đây, bạn không một mình đâu.', 'Buồn thì cứ buồn, mình ngồi cạnh bạn nè.', 'Mọi chuyện rồi sẽ ổn thôi, thương bạn.'] },
};

let io = null;
const players = new Map(); // socket.id -> player
const history = new Map(CHANNELS.map((c) => [c, []])); // tin nhắn gần đây (chỉ trong bộ nhớ)

function init(server, { userFromToken, cookieName, publicUser }) {
  const { Server } = require('socket.io');
  const db = require('./db');
  const economy = require('./economy');
  const seat = require('./seat');
  const { checkKind } = require('./kindcheck');
  const { funnyReply } = require('./funny');
  io = new Server(server, { serveClient: true, cors: { origin: false } });
  const host = require('./host');
  const pushChat = (item) => {
    const h = history.get(item.channel); h.push(item); if (h.length > HISTORY) h.shift();
    io.to(`ch:${item.channel}`).emit('chat', item);
  };
  host.init({ io, players, push: pushChat, roomSize: (ch) => (io.sockets.adapter.rooms.get(`ch:${ch}`) || { size: 0 }).size });
  host.setHistory((ch) => history.get(ch) || []);

  const q = {
    blocked: db.prepare('SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)'),
    user: db.prepare('SELECT id, nickname FROM users WHERE id = ? AND banned = 0'),
    addDm: db.prepare('INSERT INTO dms (from_user, to_user, text, created_at) VALUES (?, ?, ?, ?)'),
    addGift: db.prepare('INSERT INTO direct_gifts (from_user, to_user, drink, qty, message, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    recvCount: db.prepare(`SELECT COALESCE(SUM(qty), 0) n FROM (SELECT qty FROM treats WHERE to_user = ? AND drink = ?
      UNION ALL SELECT qty FROM direct_gifts WHERE to_user = ? AND drink = ?)`),
  };
  const isBlocked = (a, b) => !!q.blocked.get(a, b, b, a);

  io.use((socket, next) => {
    const user = userFromToken(token(socket, cookieName));
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const u = publicUser(socket.data.user);
    const firstSocket = !players.size || ![...players.values()].some((x) => x.userId === u.id);
    if (firstSocket) seat.online(u.id);
    const p = {
      sid: socket.id, userId: u.id, nickname: u.nickname, avatar: u.avatar,
      x: 70 + Math.random() * 60, y: 326 + Math.random() * 14, dir: 'up', moving: false, sit: false,
      seated: economy.isSeated(u.id), channel: null,
    };
    players.set(socket.id, p);
    socket.join(`user:${u.id}`);
    socket.join('ch:public');
    socket.emit('world:init', { you: socket.id, players: [...players.values()].map(pub), seated: p.seated });
    socket.emit('chat:history', { channel: 'public', items: history.get('public') });
    socket.broadcast.emit('p:join', pub(p));
    io.emit('online', countUnique());
    host.onJoin(p, firstSocket);

    // Chưa gọi ly trong lượt vào quán này thì nhắc gọi ly
    const gate = (ack) => {
      if (economy.isSeated(p.userId)) { p.seated = true; return true; }
      p.seated = false;
      const msg = seat.NEED.error;
      if (typeof ack === 'function') ack({ ok: false, needOrder: true, error: msg });
      else socket.emit('need-order', msg);
      return false;
    };
    const findPlayer = (sid) => { const t = players.get(sid); return t && t.userId !== p.userId ? t : null; };

    socket.on('move', (m) => {
      if (!m || typeof m !== 'object') return;
      const x = Number(m.x), y = Number(m.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      p.x = Math.max(0, Math.min(WORLD.w, x));
      p.y = Math.max(0, Math.min(WORLD.h, y));
      p.dir = ['up', 'down', 'left', 'right'].includes(m.dir) ? m.dir : p.dir;
      p.moving = !!m.moving;
      p.sit = !!m.sit;
      socket.broadcast.volatile.emit('p:move', { sid: p.sid, x: p.x, y: p.y, dir: p.dir, moving: p.moving, sit: p.sit });
    });

    // ---- Chat cả quán & theo bàn chủ đề ----
    socket.on('chat:join', (channel) => {
      if (!CHANNELS.includes(channel) || channel === 'public') return;
      if (p.channel) socket.leave(`ch:${p.channel}`);
      p.channel = channel;
      socket.join(`ch:${channel}`);
      socket.emit('chat:history', { channel, items: history.get(channel) });
    });
    socket.on('chat', (msg, ack) => {
      const m = typeof msg === 'string' ? { channel: 'public', text: msg } : (msg || {});
      const channel = CHANNELS.includes(m.channel) ? m.channel : 'public';
      const t = clean(m.text, 300).replace(/\s+/g, ' ');
      if (!t || !gate(ack)) return;
      if (channel !== 'public' && p.channel !== channel) return;
      if (!hit(`chat:${p.userId}`, 8, 15e3)) return reply(ack, { ok: false, error: 'Nói chậm thôi, mọi người nghe không kịp đâu ☺' });
      const item = { channel, sid: p.sid, uid: p.userId, nickname: p.nickname, text: sanitize(t), at: Date.now() };
      pushChat(item);
      if (hasCrisisSignal(t)) socket.emit('support');
      reply(ack, { ok: true });
      host.onChat(p, item); // gọi "Cô Tư ơi" thì cô đáp

    });

    // ---- Bình chọn của Cô Tư ----
    socket.on('poll:vote', (m, ack) => {
      if (!gate(ack)) return;
      reply(ack, host.vote(p.userId, m && m.id, m && m.option));
    });

    // ---- Tin nhắn riêng ----
    socket.on('dm', (m, ack) => {
      if (!gate(ack)) return;
      const to = q.user.get(Number(m && m.to));
      const t = clean(m && m.text, 1000);
      if (!to || to.id === p.userId || !t) return reply(ack, { ok: false, error: 'Không gửi được tin nhắn.' });
      if (isBlocked(p.userId, to.id)) return reply(ack, { ok: false, error: 'Không thể nhắn cho người này.' });
      if (!hit(`dm:${p.userId}`, 20, 60e3)) return reply(ack, { ok: false, error: 'Nhắn chậm lại chút nhé.' });
      const at = Date.now();
      const text = sanitize(t);
      const id = q.addDm.run(p.userId, to.id, text, at).lastInsertRowid;
      const item = { id, from: { uid: p.userId, nickname: p.nickname }, to: { uid: to.id, nickname: to.nickname }, text, at };
      io.to(`user:${to.id}`).emit('dm', item);
      socket.to(`user:${p.userId}`).emit('dm', item); // các tab khác của chính mình
      if (hasCrisisSignal(t)) socket.emit('support');
      reply(ack, { ok: true, item });
    });

    // ---- Động viên / an ủi người khác (bấm vào nhân vật) ----
    socket.on('cheer', (m, ack) => {
      if (!gate(ack)) return;
      const target = findPlayer(m && m.sid);
      const kind = CHEERS[m && m.kind] ? m.kind : null;
      if (!target || !kind) return reply(ack, { ok: false, error: 'Người này vừa rời quán rồi.' });
      if (isBlocked(p.userId, target.userId)) return reply(ack, { ok: false, error: 'Không thể gửi cho người này.' });
      let text = clean(m.text, 140).replace(/\s+/g, ' ');
      if (!text) text = CHEERS[kind].lines[Math.floor(Math.random() * CHEERS[kind].lines.length)];
      const screened = screenKindMessage(text);
      if (!screened.ok) return reply(ack, { ok: false, blocked: true, error: 'Lời này có thể làm người nhận buồn lòng, bạn chọn câu khác nhé.' });
      if (!hit(`cheer:${p.userId}`, 10, 60e3)) return reply(ack, { ok: false, error: 'Bạn nhiệt tình quá, nghỉ tay chút nhé.' });
      const evt = { kind, from: { sid: p.sid, nickname: p.nickname }, to: { sid: target.sid, nickname: target.nickname }, text, emote: CHEERS[kind].emote };
      io.emit('cheer', evt);
      reply(ack, { ok: true });
    });

    // ---- Tặng nước trực tiếp cho người trong quán (chỉ từ ly đang có để tặng) ----
    socket.on('gift', async (m, ack) => {
      if (!gate(ack)) return;
      const target = findPlayer(m && m.sid);
      const drink = DRINKS.includes(m && m.drink) ? m.drink : null;
      const qty = Math.max(1, Math.min(100, parseInt(m && m.qty, 10) || 1));
      const message = clean(m && m.message, 200).replace(/\s+/g, ' ');
      if (!target || !drink) return reply(ack, { ok: false, error: 'Người này vừa rời quán rồi.' });
      if (isBlocked(p.userId, target.userId)) return reply(ack, { ok: false, error: 'Không thể tặng cho người này.' });
      if (!hit(`gift:${p.userId}`, 20, 60e3)) return reply(ack, { ok: false, error: 'Chậm lại chút nhé.' });
      if (message) {
        const v = await checkKind(message);
        if (!v.ok) return reply(ack, { ok: false, blocked: true, error: 'Lời nhắn này có thể làm người nhận buồn lòng, quán chưa gửi được.', reason: v.reason });
      }
      let got;
      try {
        got = db.transaction(() => {
          const r = economy.give(p.userId, target.userId, drink, qty);
          q.addGift.run(p.userId, target.userId, drink, qty, message, Date.now());
          return r;
        })();
      } catch (err) {
        if (err instanceof economy.NoCups) {
          return reply(ack, { ok: false, noCups: true, have: err.have, error: err.have ? `Bạn chỉ còn ${err.have} ly để tặng.` : 'Bạn chưa có ly này để tặng. Gọi 1 ly là được tặng kèm 1 ly nhé!' });
        }
        console.error('Lỗi tặng nước trực tiếp', err);
        return reply(ack, { ok: false, error: 'Có lỗi, thử lại nhé.' });
      }
      const total = q.recvCount.get(target.userId, drink, target.userId, drink).n;
      const funny = funnyReply(drink, total);
      notifyUser(target.userId, {
        kind: `gift:${drink}`, actor: p.nickname, qty, message, funny, toGlass: got.toGlass, toTray: got.toTray, tray: got.tray,
      });
      io.emit('gift', { from: { sid: p.sid, nickname: p.nickname }, to: { sid: target.sid, nickname: target.nickname }, drink, qty });
      reply(ack, { ok: true, left: economy.giftable(p.userId, drink), reply: funny, count: total });
    });

    socket.on('emote', (e) => {
      if (!EMOTES.includes(e) || !hit(`emote:${p.userId}`, 10, 10e3) || !economy.isSeated(p.userId)) return;
      io.emit('emote', { sid: p.sid, e });
    });

    // Gọi nước ở quầy Cô Tư – cả quán thấy bạn cầm ly
    socket.on('order', (drink) => {
      if (!DRINKS.includes(drink) || !hit(`order:${p.userId}`, 6, 60e3)) return;
      io.emit('order', { sid: p.sid, drink, nickname: p.nickname });
      host.onOrder(p, drink);
    });

    socket.on('profile', () => {
      const fresh = userFromToken(token(socket, cookieName));
      if (!fresh) return;
      const pu = publicUser(fresh);
      p.nickname = pu.nickname;
      p.avatar = pu.avatar;
      io.emit('p:update', { sid: p.sid, nickname: p.nickname, avatar: p.avatar, seated: p.seated });
    });

    socket.on('disconnect', () => {
      players.delete(socket.id);
      host.onLeave(socket.id);
      if (![...players.values()].some((x) => x.userId === p.userId)) seat.offline(p.userId);
      io.emit('p:leave', socket.id);
      io.emit('online', countUnique());
    });
  });
}

const reply = (ack, data) => { if (typeof ack === 'function') ack(data); };
function token(socket, cookieName) {
  const raw = socket.handshake.headers.cookie || '';
  const t = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(cookieName + '='));
  return t ? decodeURIComponent(t.slice(cookieName.length + 1)) : null;
}
function pub(p) {
  return { sid: p.sid, uid: p.userId, nickname: p.nickname, avatar: p.avatar, x: p.x, y: p.y, dir: p.dir, moving: p.moving, sit: p.sit, seated: p.seated };
}
function countUnique() {
  return new Set([...players.values()].map((p) => p.userId)).size;
}
function broadcast(event, data) {
  if (io) io.emit(event, data);
}
function notifyUser(userId, data) {
  if (io) io.to(`user:${userId}`).emit('notify', data);
}
function kickUser(userId) {
  if (io) io.in(`user:${userId}`).disconnectSockets(true);
}
// Vừa gọi ly xong: mở khoá tương tác, báo cả quán người này đã ngồi
function seated(userId) {
  if (!io) return;
  for (const p of players.values()) {
    if (p.userId !== userId || p.seated) continue;
    p.seated = true;
    io.emit('p:update', { sid: p.sid, nickname: p.nickname, avatar: p.avatar, seated: true });
  }
  io.to(`user:${userId}`).emit('seated');
}

function stats() {
  const ids = [...new Set([...players.values()].map((p) => p.userId))];
  return { online: ids.length, onlineIds: ids };
}
function getHistory(ch) { return (history.get(ch) || []).slice(); }

module.exports = { close: () => io && io.close(), init, broadcast, notifyUser, kickUser, seated, stats, getHistory, WORLD, CHANNELS };
