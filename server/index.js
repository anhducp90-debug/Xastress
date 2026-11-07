'use strict';
const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
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
// Nén gzip: thư viện 3D ~2,1MB còn ~0,5MB. Không nén luồng SSE (Cô Tư AI trả lời từng chữ).
app.use(compression({ filter: (req, res) => !/event-stream/.test(String(res.getHeader('Content-Type') || '')) && compression.filter(req, res) }));

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
  windowMs: 15 * 60e3, limit: parseInt(process.env.AUTH_RATE_LIMIT || '20', 10), standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Thử quá nhiều lần, vui lòng đợi 15 phút.' },
});

app.post('/api/auth/register', authLimiter, auth.register);
app.post('/api/auth/login', authLimiter, auth.login);
app.post('/api/auth/logout', auth.logout);
app.get('/api/auth/me', auth.me);
app.post('/api/auth/profile', auth.requireUser, auth.updateProfile);
app.post('/api/auth/password', authLimiter, auth.requireUser, auth.changePassword);
app.post('/api/auth/delete', authLimiter, auth.requireUser, auth.deleteAccount);
app.post('/api/auth/consent', auth.requireUser, auth.consent);
app.post('/api/auth/recover', authLimiter, auth.recover);
app.post('/api/auth/recovery-code', authLimiter, auth.requireUser, auth.regenRecovery);
app.post('/api/auth/mfa/verify', authLimiter, auth.mfaVerify);
app.get('/api/admin/mfa', auth.requireAdmin, auth.mfaStatus);
app.post('/api/admin/mfa/setup', auth.requireAdmin, auth.mfaSetup);
app.post('/api/admin/mfa/enable', authLimiter, auth.requireAdmin, auth.mfaEnable);
app.post('/api/admin/mfa/disable', authLimiter, auth.requireAdmin, auth.mfaDisable);
// Tải về toàn bộ dữ liệu của mình
app.get('/api/me/export', auth.requireUser, (req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="xastress-du-lieu-cua-toi-${new Date().toISOString().slice(0, 10)}.json"`);
  res.setHeader('Cache-Control', 'no-store');
  res.type('application/json').send(JSON.stringify(require('./privacy').exportUser(req.user.id), null, 2));
});
app.use('/api', require('./legal'));
app.use('/api', posts);
app.use('/api', require('./aiRoutes'));
app.use('/api', require('./walletRoutes'));
app.use('/api', require('./dmRoutes'));
const adminRoutes = require('./adminRoutes');
adminRoutes.applyStored(); // nạp cài đặt quản trị đã lưu (thu phí, giá, Cô Tư)
app.use('/api', adminRoutes);
app.use('/api', require('./payRoutes'));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Không tìm thấy.' }));

// Thư viện Three.js (WebGL) phục vụ trực tiếp từ node_modules – không phụ thuộc CDN
app.use('/vendor/three', express.static(path.join(path.dirname(require.resolve('three')), '..', 'build'), {
  maxAge: config.isProd ? '7d' : 0, index: false,
}));
// Mã của quán: luôn hỏi lại máy chủ (ETag → 304 nếu không đổi) để sau mỗi lần cập nhật không bị lẫn bản cũ/mới
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, file) => { res.setHeader('Cache-Control', /\.(png|jpe?g|svg|webp|ico|woff2?)$/.test(file) ? 'public, max-age=604800' : 'no-cache'); },
}));

// Trang không tồn tại
app.use((req, res) => {
  if (req.method !== 'GET' || !req.accepts('html')) return res.status(404).end();
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dữ liệu không hợp lệ.' });
  console.error(err);
  res.status(500).json({ error: 'Quán đang trục trặc chút, thử lại sau nhé.' });
});

const server = http.createServer(app);
realtime.init(server, { userFromToken: auth.userFromToken, cookieName: auth.COOKIE, publicUser: auth.publicUser });

if (require.main === module) {
  require('./telegram').start(); // bot bán xu (chỉ chạy khi có TELEGRAM_BOT_TOKEN)
  require('./backup').start();   // tự sao lưu CSDL mỗi ngày
  server.listen(config.port, config.host, () => {
    console.log(`☕ Xả Stress đang mở quán tại http://${config.host}:${config.port}`);
  });
  // Đóng quán êm khi docker stop / systemctl restart: ngừng nhận kết nối, đóng CSDL gọn gàng
  const shutdown = (sig) => {
    console.log(`Nhận ${sig}, đóng quán…`);
    require('./telegram').stop();
    realtime.close();
    server.close(() => { try { require('./db').close(); } catch { /* đã đóng */ } process.exit(0); });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
module.exports = { app, server };
