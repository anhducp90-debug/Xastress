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

// Model gợi ý (Claude theo bảng giá hiện hành của Anthropic, $ cho mỗi 1 triệu token vào/ra).
// GPT/Gemini: bấm "Tải danh sách model mới nhất" trên trang quản trị để lấy trực tiếp từ nhà cung cấp.
const RECOMMENDED = {
  anthropic: [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 – mặc định, thông minh ($4 / $20)' },
    { id: 'claude-fable-5-1', label: 'Claude Fable 5.1 – mạnh nhất ($10 / $50)' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 – nhanh, cân bằng ($2 / $10)' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 – rẻ nhất, hợp hoạt náo ($0.10 / $0.50)' },
  ],
  openai: [
    { id: 'gpt-5-mini', label: 'gpt-5-mini (gợi ý – bấm tải danh sách để xem model mới nhất)' },
    { id: 'gpt-5', label: 'gpt-5 (gợi ý)' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash (gợi ý – bấm tải danh sách để xem model mới nhất)' },
    { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro (gợi ý)' },
  ],
};
const REFUSED = 'Chuyện này cô không nói tiếp được, con thông cảm nha. Nếu con đang gặp nguy hiểm, gọi ngay 115 hoặc đường dây Ngày Mai 096 306 1414 nhé.';

// Thống kê dùng AI trong ngày (cho trang quản trị)
const usage = { day: '', calls: {}, errors: {}, ...(settings.get('ai_usage', null) || {}) }; // giữ số lượt qua lần khởi động lại
const vnDay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
function track(provider, ok) {
  const d = vnDay();
  if (usage.day !== d) { usage.day = d; usage.calls = {}; usage.errors = {}; }
  const m = ok ? usage.calls : usage.errors;
  m[provider] = (m[provider] || 0) + 1;
  settings.set('ai_usage', usage);
}

function current() {
  const s = settings.get('ai', {});
  const disabled = env.AI_ENABLED === '0';
  let provider = s.provider;
  if (!provider) provider = (ENV_KEYS.anthropic || env.ANTHROPIC_AUTH_TOKEN) ? 'anthropic' : 'none';
  if (disabled || !PROVIDERS.includes(provider)) provider = 'none';
  const key = provider === 'none' ? null : (settings.getSecret(`${provider}_key`) || ENV_KEYS[provider] || null);
  // Mỗi nhà cung cấp có 2 model: chat = tâm sự (gói AI), fast = hoạt náo & kiểm duyệt
  const m = (s.models && s.models[provider]) || {};
  const chatModel = (typeof m === 'string' ? m : m.chat) || DEFAULT_MODELS[provider];
  const fastModel = (typeof m === 'string' ? m : m.fast) || chatModel;
  const effort = s.effort || env.AI_EFFORT || 'medium';
  const usable = provider !== 'none' && (!!key || (provider === 'anthropic' && !!env.ANTHROPIC_AUTH_TOKEN));
  return { provider: usable ? provider : 'none', chosen: provider, key, model: chatModel, chatModel, fastModel, effort };
}
// Trần chi phí: tối đa N lượt gọi AI mỗi ngày (cả quán). Hết lượt thì Cô Tư dùng câu soạn sẵn tới 0h.
function dailyCap() {
  const s = settings.get('ai', {});
  const v = s.dailyCap ?? parseInt(env.AI_DAILY_CAP || '3000', 10);
  return Number.isFinite(v) && v > 0 ? v : 0; // 0 = không giới hạn
}
function usedToday() {
  if (usage.day !== vnDay()) return 0;
  return Object.values(usage.calls).reduce((a, b) => a + b, 0) + Object.values(usage.errors).reduce((a, b) => a + b, 0);
}
const overCap = () => { const c = dailyCap(); return c > 0 && usedToday() >= c; };
const isEnabled = () => current().provider !== 'none' && !overCap();

// ---------- Claude (Anthropic SDK) ----------
// Tính năng theo model: fallback phía server (khi bộ lọc an toàn từ chối) chỉ có ở một số model;
// effort & structured outputs có từ thế hệ Claude 4.5/4.6 trở đi.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
const fallbackOK = (m) => /^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/.test(m);
const effortOK = (m) => /^claude-(fable|mythos|opus-5|opus-4-[5-8]|sonnet-5|sonnet-4-6|haiku-5)/.test(m);
const caps = (m) => (fallbackOK(m) ? FALLBACK : {});
const clients = new Map();
function anthropic(key) {
  const k = key || '__env__';
  if (!clients.has(k)) clients.set(k, key ? new Anthropic({ apiKey: key }) : new Anthropic());
  return clients.get(k);
}
const A = {
  async complete(c, { system, user, schema }) {
    const model = c.fastModel;
    const oc = {};
    if (effortOK(model)) oc.effort = 'low';
    if (schema && effortOK(model)) oc.format = { type: 'json_schema', schema };
    const sys = schema && !oc.format ? `${system}\nChỉ trả lời bằng một đối tượng JSON đúng schema sau, không thêm chữ nào khác: ${JSON.stringify(schema)}` : system;
    const res = await anthropic(c.key).beta.messages.create({
      model, max_tokens: 2000, system: sys, messages: [{ role: 'user', content: user }],
      ...(Object.keys(oc).length ? { output_config: oc } : {}),
      ...caps(model),
    }, { timeout: 20000, maxRetries: 1 });
    if (res.stop_reason === 'refusal') return null;
    const b = res.content.find((x) => x.type === 'text');
    return b ? b.text.trim() : null;
  },
  async stream(c, { system, messages, onText, signal }) {
    const model = c.chatModel;
    const s = anthropic(c.key).beta.messages.stream({
      model, max_tokens: 16000,
      system: [{ type: 'text', text: system[0], cache_control: { type: 'ephemeral' } }, ...system.slice(1).map((t) => ({ type: 'text', text: t }))],
      messages, ...(effortOK(model) ? { output_config: { effort: c.effort } } : {}), ...caps(model),
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
    const body = { model: c.fastModel, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
    if (schema) body.response_format = { type: 'json_schema', json_schema: { name: 'ket_qua', schema, strict: true } };
    const res = await post(`${OPENAI_BASE()}/chat/completions`, { Authorization: `Bearer ${c.key}` }, body);
    const data = await res.json();
    const m = data.choices && data.choices[0] && data.choices[0].message;
    if (!m || m.refusal) return null;
    return (m.content || '').trim() || null;
  },
  async stream(c, { system, messages, onText, signal }) {
    const res = await post(`${OPENAI_BASE()}/chat/completions`, { Authorization: `Bearer ${c.key}` }, {
      model: c.chatModel, stream: true, messages: [{ role: 'system', content: system.join('\n\n') }, ...messages],
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
    const res = await post(`${GEMINI_BASE()}/models/${encodeURIComponent(c.fastModel)}:generateContent`, { 'x-goog-api-key': c.key }, body);
    const text = geminiText(await res.json()).trim();
    return text || null;
  },
  async stream(c, { system, messages, onText, signal }) {
    const res = await post(`${GEMINI_BASE()}/models/${encodeURIComponent(c.chatModel)}:streamGenerateContent?alt=sse`, { 'x-goog-api-key': c.key }, {
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
  if (overCap()) throw new Error('Đã hết lượt AI hôm nay');
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

// ---------- Danh sách model trực tiếp từ nhà cung cấp ----------
const modelCache = new Map();
async function listModels(provider) {
  const c = current();
  const key = settings.getSecret(`${provider}_key`) || ENV_KEYS[provider];
  if (!key && !(provider === 'anthropic' && env.ANTHROPIC_AUTH_TOKEN)) throw new Error('Chưa có khoá API cho nhà cung cấp này.');
  const ck = `${provider}:${(key || '').slice(-6)}`;
  const hit = modelCache.get(ck);
  if (hit && Date.now() - hit.at < 10 * 60e3) return hit.items;
  let items = [];
  if (provider === 'anthropic') {
    for await (const m of anthropic(key).models.list({ limit: 100 })) items.push({ id: m.id, label: m.display_name || m.id, created: m.created_at });
  } else if (provider === 'openai') {
    const res = await fetch(`${OPENAI_BASE()}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const skip = /(embed|audio|tts|whisper|image|dall-e|realtime|transcribe|moderation|search|babbage|davinci|instruct)/;
    items = (data.data || []).filter((m) => /^(gpt|o\d|chatgpt)/.test(m.id) && !skip.test(m.id))
      .sort((a, b) => (b.created || 0) - (a.created || 0)).map((m) => ({ id: m.id, label: m.id, created: m.created }));
  } else if (provider === 'gemini') {
    const res = await fetch(`${GEMINI_BASE()}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    items = (data.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/.test(m.name) && !/(embedding|aqa|image|tts)/.test(m.name))
      .map((m) => ({ id: m.name.replace(/^models\//, ''), label: `${m.displayName || m.name} (${m.name.replace(/^models\//, '')})` }));
  }
  void c;
  modelCache.set(ck, { at: Date.now(), items });
  return items;
}
const stream = (args) => run('stream', args);

module.exports = { complete, stream, isEnabled, current, dailyCap, usedToday, overCap, listModels, usage, PROVIDERS, DEFAULT_MODELS, RECOMMENDED, Anthropic };
