'use strict';
// Không gian quán realtime: vị trí nhân vật, bong bóng chat, biểu cảm.
const { maskBadWords, clean, hasCrisisSignal } = require('./moderation');
const { hit } = require('./ratelimit');

const WORLD = { w: 640, h: 448 };
const EMOTES = ['wave', 'heart', 'hug', 'cheer', 'tea', 'sad', 'laugh'];

let io = null;
const players = new Map(); // socket.id -> player

function init(server, { userFromToken, cookieName, publicUser }) {
  const { Server } = require('socket.io');
  io = new Server(server, { serveClient: true, cors: { origin: false } });

  io.use((socket, next) => {
    const raw = socket.handshake.headers.cookie || '';
    const token = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(cookieName + '='));
    const user = token ? userFromToken(decodeURIComponent(token.slice(cookieName.length + 1))) : null;
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const u = publicUser(socket.data.user);
    const p = {
      sid: socket.id, userId: u.id, nickname: u.nickname, avatar: u.avatar,
      x: 70 + Math.random() * 60, y: 326 + Math.random() * 14, dir: 'up', moving: false, sit: false,
    };
    players.set(socket.id, p);
    socket.join(`user:${u.id}`);
    socket.emit('world:init', { you: socket.id, players: [...players.values()].map(pub) });
    socket.broadcast.emit('p:join', pub(p));
    io.emit('online', countUnique());

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

    socket.on('chat', (text) => {
      const t = clean(text, 120).replace(/\s+/g, ' ');
      if (!t) return;
      if (!hit(`chat:${p.userId}`, 8, 15e3)) return socket.emit('sys', 'Nói chậm thôi, mọi người nghe không kịp đâu ☺');
      io.emit('chat', { sid: p.sid, nickname: p.nickname, text: maskBadWords(t), at: Date.now() });
      if (hasCrisisSignal(t)) socket.emit('support');
    });

    socket.on('emote', (e) => {
      if (!EMOTES.includes(e) || !hit(`emote:${p.userId}`, 10, 10e3)) return;
      io.emit('emote', { sid: p.sid, e });
    });

    socket.on('profile', () => {
      // Client báo đã đổi avatar/biệt danh → đọc lại từ DB qua session
      const fresh = userFromToken(token(socket, cookieName));
      if (!fresh) return;
      const pu = publicUser(fresh);
      p.nickname = pu.nickname;
      p.avatar = pu.avatar;
      io.emit('p:update', { sid: p.sid, nickname: p.nickname, avatar: p.avatar });
    });

    socket.on('disconnect', () => {
      players.delete(socket.id);
      io.emit('p:leave', socket.id);
      io.emit('online', countUnique());
    });
  });
}

function token(socket, cookieName) {
  const raw = socket.handshake.headers.cookie || '';
  const t = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(cookieName + '='));
  return t ? decodeURIComponent(t.slice(cookieName.length + 1)) : null;
}
function pub(p) {
  return { sid: p.sid, nickname: p.nickname, avatar: p.avatar, x: p.x, y: p.y, dir: p.dir, moving: p.moving, sit: p.sit };
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

module.exports = { init, broadcast, notifyUser, kickUser, WORLD };
