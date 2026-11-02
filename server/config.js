'use strict';
const fs = require('fs');
const path = require('path');

// Nạp .env đơn giản (không cần thư viện dotenv)
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;
module.exports = {
  port: parseInt(env.PORT || '3000', 10),
  host: env.HOST || '127.0.0.1',
  isProd: env.NODE_ENV === 'production',
  dbPath: path.resolve(__dirname, '..', env.DB_PATH || './data/xastress.db'),
  publicOrigin: env.PUBLIC_ORIGIN || '',
  adminUsernames: (env.ADMIN_USERNAMES || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  trustProxy: env.TRUST_PROXY === '1',
  sessionDays: 30,
  ai: {
    // Có ANTHROPIC_API_KEY (hoặc ANTHROPIC_AUTH_TOKEN) thì bật Cô Tư AI; đặt AI_ENABLED=0 để tắt hẳn
    enabled: !!(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN) && env.AI_ENABLED !== '0',
    model: env.AI_MODEL || 'claude-opus-5-5',
    effort: env.AI_EFFORT || 'medium',
  },
};
