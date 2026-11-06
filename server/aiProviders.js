'use strict';
// Một giao diện chung cho 3 nhà cung cấp AI: Claude (Anthropic), ChatGPT (OpenAI API), Gemini (Google API).
// Nhà cung cấp, model và khoá API chọn trên trang quản trị; nếu chưa chỉnh thì lấy từ .env.
//   complete({ system, user, schema }) -> chuỗi (JSON nếu có schema) hoặc null nếu bị từ chối
//   stream({ system: [đoạn cố định, đoạn theo món], messages, onText, signal }) -> toàn bộ câu trả lời
const Anthropic = require('@anthropic-ai/sdk');
const settings = require('./settings');

const env = process.env;
const DEFAULT_MODELS = {
  anthropic: env.AI_MODEL || 'claude-opus-5-5',
  openai: env.OPENAI_MODEL || 'gpt-5-mini',
  gemini: env.GEMINI_MODEL || 'gemini-2.5-flash',
};
const ENV_KEYS = { anthropic: env.ANTHROPIC_API_KEY, openai: env.OPENAI_API_KEY, gemini: env.GEMINI_API_KEY };
const PROVIDERS = ['anthropic', 'openai', 'gemini'];
const REFUSED = 'Chuyện này cô không nói tiếp được, con thông cảm nha. Nếu con đang gặp nguy hiểm, gọi ngay 115 hoặc đường dây Ngày Mai 096 306 1414 nhé.';

// Thống kê dùng AI trong ngày (cho trang quản trị)
const usage = { day: '', calls: {}, errors: {} };
function track(provider, ok) {
  const d = new Date().toISOString().slice(0, 10);
  if (usage.day !== d) { usage.day = d; usage.calls = {}; usage.errors = {}; }
  const m = ok ? usage.calls : usage.errors;
  m[provider] = (m[provider] || 0) + 1;
}

function current() {
  const s = settings.get('ai', {});
  const disabled = env.AI_ENABLED === '0';
  let provider = s.provider;
  if (!provider) provider = (ENV_KEYS.anthropic || env.ANTHROPIC_AUTH_TOKEN) ? 'anthropic' : 'none';
  if (disabled || !PROVIDERS.includes(provider)) provider = 'none';
  const key = provider === 'none' ? null : (settings.getSecret(`${provider}_key`) || ENV_KEYS[provider] || null);
  const model = (s.models && s.models[provider]) || DEFAULT_MODELS[provider];
  const effort = s.effort || env.AI_EFFORT || 'medium';
  const usable = provider !== 'none' && (!!key || (provider === 'anthropic' && !!env.ANTHROPIC_AUTH_TOKEN));
  return { provider: usable ? provider : 'none', chosen: provider, key, model, effort };
}
const isEnabled = () => current().provider !== 'none';

// ---------- Claude (Anthropic SDK) ----------
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
const clients = new Map();
function anthropic(key) {
  const k = key || '__env__';
  if (!clients.has(k)) clients.set(k, key ? new Anthropic({ apiKey: key }) : new Anthropic());
  return clients.get(k);
}
const A = {
  async complete(c, { system, user, schema }) {
    const res = await anthropic(c.key).beta.messages.create({
      model: c.model, max_tokens: 2000, system, messages: [{ role: 'user', content: user }],
      output_config: schema ? { effort: 'low', format: { type: 'json_schema', schema } } : { effort: 'low' },
      ...FALLBACK,
    }, { timeout: 20000, maxRetries: 1 });
    if (res.stop_reason === 'refusal') return null;
    const b = res.content.find((x) => x.type === 'text');
    return b ? b.text.trim() : null;
  },
  async stream(c, { system, messages, onText, signal }) {
    const s = anthropic(c.key).beta.messages.stream({
      model: c.model, max_tokens: 16000,
      system: [{ type: 'text', text: system[0], cache_control: { type: 'ephemeral' } }, ...system.slice(1).map((t) => ({ type: 'text', text: t }))],
      messages, output_config: { effort: c.effort }, ...FALLBACK,
    }, { signal });
    let text = '';
    for await (const ev of s) {
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') { text += ev.delta.text; onText(ev.delta.text); }
    }
    const final = await s.finalMessage();
    if (final.stop_reason === 'refusal' && !text.trim()) { text = REFUSED; onText(text); }
    return text.trim();
  },
};

// ---------- Đọc luồng Server-Sent Events chung ----------
async function* sse(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line.startsWith('data:')) yield line.slice(5).trim();
    }
  }
}
async function post(url, headers, body, signal) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: signal || AbortSignal.timeout(30000) });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

// ---------- ChatGPT (OpenAI API, REST /chat/completions) ----------
const OPENAI_BASE = () => (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const O = {
  async complete(c, { system, user, schema }) {
    const body = { model: c.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
    if (schema) body.response_format = { type: 'json_schema', json_schema: { name: 'ket_qua', schema, strict: true } };
    const res = await post(`${OPENAI_BASE()}/chat/completions`, { Authorization: `Bearer ${c.key}` }, body);
    const data = await res.json();
    const m = data.choices && data.choices[0] && data.choices[0].message;
    if (!m || m.refusal) return null;
    return (m.content || '').trim() || null;
  },
  async stream(c, { system, messages, onText, signal }) {
    const res = await post(`${OPENAI_BASE()}/chat/completions`, { Authorization: `Bearer ${c.key}` }, {
      model: c.model, stream: true, messages: [{ role: 'system', content: system.join('\n\n') }, ...messages],
    }, signal);
    let text = '';
    for await (const d of sse(res)) {
      if (d === '[DONE]') break;
      const delta = JSON.parse(d).choices?.[0]?.delta?.content;
      if (delta) { text += delta; onText(delta); }
    }
    if (!text.trim()) { text = REFUSED; onText(text); }
    return text.trim();
  },
};

// ---------- Gemini (Google Generative Language API, REST) ----------
const GEMINI_BASE = () => (env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
// Gemini chỉ nhận một phần JSON Schema: bỏ additionalProperties
function geminiSchema(s) {
  if (Array.isArray(s)) return s.map(geminiSchema);
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) if (k !== 'additionalProperties') out[k] = geminiSchema(v);
  return out;
}
const geminiText = (data) => (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
const G = {
  async complete(c, { system, user, schema }) {
    const body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }] };
    if (schema) body.generationConfig = { responseMimeType: 'application/json', responseSchema: geminiSchema(schema) };
    const res = await post(`${GEMINI_BASE()}/models/${encodeURIComponent(c.model)}:generateContent`, { 'x-goog-api-key': c.key }, body);
    const text = geminiText(await res.json()).trim();
    return text || null;
  },
  async stream(c, { system, messages, onText, signal }) {
    const res = await post(`${GEMINI_BASE()}/models/${encodeURIComponent(c.model)}:streamGenerateContent?alt=sse`, { 'x-goog-api-key': c.key }, {
      systemInstruction: { parts: [{ text: system.join('\n\n') }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    }, signal);
    let text = '';
    for await (const d of sse(res)) {
      const t = geminiText(JSON.parse(d));
      if (t) { text += t; onText(t); }
    }
    if (!text.trim()) { text = REFUSED; onText(text); }
    return text.trim();
  },
};

const IMPL = { anthropic: A, openai: O, gemini: G };
async function run(method, args) {
  const c = current();
  if (c.provider === 'none') throw new Error('AI chưa bật');
  try {
    const r = await IMPL[c.provider][method](c, args);
    track(c.provider, true);
    return r;
  } catch (err) {
    if (!(args.signal && args.signal.aborted)) track(c.provider, false);
    throw err;
  }
}
const complete = (args) => run('complete', args);
const stream = (args) => run('stream', args);

module.exports = { complete, stream, isEnabled, current, usage, PROVIDERS, DEFAULT_MODELS, Anthropic };
