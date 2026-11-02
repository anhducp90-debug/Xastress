'use strict';
const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const config = require('./config');
require('./db');
const auth = require('./auth');
const realtime = require('./realtime');
const posts = require('./posts');

const app = express();
if (config.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: config.isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

// Chống CSRF: request thay đổi dữ liệu phải là JSON (hoặc mang header riêng của app) và cùng Origin.
// Form HTML từ trang khác không gửi được JSON / header tuỳ chỉnh nếu không qua CORS preflight.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!req.is('application/json') && req.get('x-requested-with') !== 'xastress') {
    return res.status(415).json({ error: 'Yêu cầu không hợp lệ.' });
  }
  const origin = req.get('origin');
  if (origin) {
    const host = req.get('host');
    const allowed = [config.publicOrigin, `http://${host}`, `https://${host}`].filter(Boolean);
    if (!allowed.includes(origin)) return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
  }
  next();
});
app.use('/api', auth.attachUser);

const authLimiter = rateLimit({
  windowMs: 15 * 60e3, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Thử quá nhiều lần, vui lòng đợi 15 phút.' },
});

app.post('/api/auth/register', authLimiter, auth.register);
app.post('/api/auth/login', authLimiter, auth.login);
app.post('/api/auth/logout', auth.logout);
app.get('/api/auth/me', auth.me);
app.post('/api/auth/profile', auth.requireUser, auth.updateProfile);
app.post('/api/auth/password', authLimiter, auth.requireUser, auth.changePassword);
app.post('/api/auth/delete', authLimiter, auth.requireUser, auth.deleteAccount);
app.use('/api', posts);
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Không tìm thấy.' }));

app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: config.isProd ? '1h' : 0 }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dữ liệu không hợp lệ.' });
  console.error(err);
  res.status(500).json({ error: 'Quán đang trục trặc chút, thử lại sau nhé.' });
});

const server = http.createServer(app);
realtime.init(server, { userFromToken: auth.userFromToken, cookieName: auth.COOKIE, publicUser: auth.publicUser });

if (require.main === module) {
  server.listen(config.port, config.host, () => {
    console.log(`☕ Xả Stress đang mở quán tại http://${config.host}:${config.port}`);
  });
}
module.exports = { app, server };
