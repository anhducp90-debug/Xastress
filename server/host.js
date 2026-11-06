'use strict';
// Cô Tư hoạt náo – "người giữ lửa" của quán:
//  - chào khách mới vào, nhắc riêng người chưa gọi ly, rao khi có người gọi ly
//  - quán im lặng thì khơi chuyện: câu hỏi mở hoặc bình chọn vui (có tổng kết)
//  - thả câu hỏi đúng chủ đề ở các bàn đang có người
//  - được gọi ("Cô Tư ơi", "@Cô Tư") thì đáp trong chat
//  - tâm sự mới mà chưa ai hỏi han sau ~2 phút thì vào bình luận động viên trước
// Có khoá Claude thì nội dung do AI nghĩ; không có thì dùng kho câu soạn sẵn dưới đây.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');
const ai = require('./ai');
const { TABLES, DRINK_INFO } = require('./constants');
const { hasCrisisSignal, maskBadWords } = require('./moderation');
const { hit } = require('./ratelimit');

const NAME = 'Cô Tư';
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

// ---------- Kho câu soạn sẵn ----------
const POLLS = [
  { question: 'Sếp nhắn việc lúc 11 giờ đêm, các con làm sao?', options: ['Trả lời ngay', 'Để sáng mai', 'Giả vờ ngủ say 😴'] },
  { question: 'Cuối tuần lý tưởng của các con là gì?', options: ['Ngủ nướng tới trưa', 'Đi chơi xa', 'Ngồi quán trà đá cả ngày'] },
  { question: 'Lương về, việc đầu tiên các con làm là gì?', options: ['Trả nợ', 'Gửi tiết kiệm', 'Tự thưởng một bữa', 'Nhìn nó bay đi 💸'] },
  { question: 'Họp online mà tắt camera, các con đang làm gì?', options: ['Vẫn nghe chăm chú', 'Ăn sáng', 'Làm việc khác', 'Ngủ gật'] },
  { question: 'Mẹ hỏi "Bao giờ lấy vợ/chồng?", các con đáp sao?', options: ['Sang năm mẹ ạ', 'Đổi chủ đề', 'Hỏi lại "Bao giờ mẹ tăng tiền tiêu vặt?"'] },
  { question: 'Stress quá thì các con xả bằng cách nào?', options: ['Ăn thật nhiều', 'Ngủ một giấc', 'Tập thể dục', 'Ra quán Cô Tư kể chuyện'] },
  { question: 'Đồng nghiệp hay đẩy việc cho mình, nên làm gì?', options: ['Nói thẳng nhẹ nhàng', 'Báo sếp', 'Cắn răng làm', 'Đẩy ngược lại 😏'] },
  { question: 'Deadline còn 1 tiếng, việc còn 80%. Các con chọn?', options: ['Xin thêm thời gian', 'Làm nhanh bản tạm', 'Cầu nguyện mất điện'] },
  { question: 'Trà đá hay trà chanh mới là chân ái vỉa hè?', options: ['Trà đá', 'Trà chanh', 'Cả hai, cô ơi!'] },
  { question: 'Người yêu cũ nhắn "Dạo này ổn không?", các con…', options: ['Trả lời lịch sự', 'Seen không rep', 'Chặn luôn', 'Kể với cả quán 😂'] },
  { question: 'Đi làm muộn vì tắc đường, lý do nào thuyết phục nhất?', options: ['Tắc đường thật', 'Xe hỏng', 'Đồng hồ chạy chậm', 'Thật thà nhận ngủ quên'] },
  { question: 'Mỗi tối các con lướt điện thoại bao lâu trước khi ngủ?', options: ['Dưới 15 phút', 'Khoảng 1 tiếng', 'Tới lúc rơi vào mặt 📱'] },
];
const OPEN = [
  'Hôm nay ai có chuyện gì vui không, kể cô nghe với? Chuyện bé tí cũng được 😄',
  'Cô hỏi thật: dạo này điều gì làm các con mệt nhất?',
  'Có ai từng nghỉ việc mà không hối hận không? Kể cô nghe coi.',
  'Món ăn nào làm các con thấy được an ủi nhất khi buồn?',
  'Câu nói nào của người khác từng giúp các con vượt qua lúc khó khăn?',
  'Quán đang yên quá… Ai kể một chuyện "dở khóc dở cười" tuần này đi!',
  'Nếu được nghỉ 3 ngày không ai làm phiền, các con sẽ làm gì?',
  'Có ai đang thức khuya làm việc không? Vào uống ly trà gừng với cô nè 🫚',
];
const TABLE_Q = {
  congviec: ['Bàn Công Việc ơi, có ai đang bị deadline dí không?', 'Sếp tốt nhất các con từng gặp có gì đặc biệt?', 'Ai từng xin tăng lương thành công chưa, chỉ bí kíp đi!'],
  giadinh: ['Bàn Gia Đình: có ai hay bị so sánh với "con nhà người ta" không?', 'Lần gần nhất các con nói "con thương bố/mẹ" là khi nào?', 'Ở chung với bố mẹ hay ra ở riêng, các con thấy sao?'],
  tinhcam: ['Bàn Tình Cảm: chia tay rồi thì bao lâu mới hết buồn hả các con?', 'Yêu xa có ai trụ được không, kể cô nghe?', 'Điều nhỏ nhất làm các con thấy được thương là gì?'],
  hochanh: ['Bàn Học Hành: mùa thi tới rồi, ai đang ôn bài xuyên đêm không?', 'Học ngành mình không thích, các con xoay xở thế nào?', 'Mẹo học nào hiệu quả nhất mà các con từng thử?'],
  tienbac: ['Bàn Cơm Áo Gạo Tiền: cuối tháng ai đang "ăn mì gói" giơ tay 🙋', 'Các con tiết kiệm kiểu gì mà vẫn sống vui?', 'Vay tiền bạn bè rồi khó đòi, có ai từng bị chưa?'],
  cuocsong: ['Bàn Chuyện Đời: có ai thấy mình đang "lạc lối" giữa đời không?', 'Điều gì khiến các con thấy cuộc sống vẫn đáng yêu?', 'Một thói quen nhỏ giúp các con sống nhẹ nhàng hơn là gì?'],
};
const GREETS = [
  'Ơ, {names} tới rồi! Ngồi đi các con, hôm nay uống gì? Trà đá cô mới pha đấy 🧊',
  'Chào {names}! Kiếm cái ghế nhựa ngồi đi, gọi ly gì cho mát ruột nào?',
  '{names} ghé quán à? Vào đây, có chuyện gì cứ kể, cả quán nghe hết 🍵',
];
const NUDGES = [
  'Ngồi đi con, gọi một ly trà đá đi rồi nói chuyện với mọi người – hôm nay quán miễn phí đấy 🧊',
  'Đứng mãi mỏi chân con ạ! Bấm 🧋 Gọi nước chọn một ly, cô mang ra ngay.',
];
const ORDER_SHOUTS = [
  'Có ngay ly {drink} cho {name}! Ai đang rảnh ghé ngồi chung với {name} nè 🍵',
  '{name} gọi {drink} rồi kìa. Hôm nay có chuyện gì thế con, kể cả quán nghe đi!',
  'Ly {drink} của {name} đây! Nhớ là gọi 1 ly được tặng kèm 1 ly, mời ai đó trong quán nha 🎁',
];
const MENTION_REPLIES = [
  'Cô đây con! Có chuyện gì cứ nói, cô nghe hết 🍵',
  'Gọi cô có việc gì thế? Ly nữa không con?',
  'Ơi cô đây! Con thấy trong người thế nào rồi?',
  'Cô nghe đây. Kể tiếp đi, mọi người trong quán cũng đang nghe đấy.',
];
const CRISIS_REPLY = 'Con ơi, cô lo cho con lắm. Gọi ngay 115 hoặc đường dây Ngày Mai 096 306 1414 nhé, và nhắn cho một người thân đang ở gần. Cô vẫn ngồi đây với con.';
const POST_COMMENTS = [
  'Cô đọc rồi con ạ. Nghe thôi đã thấy mệt thay con. Kể tiếp cho cô nghe, chuyện bắt đầu từ lúc nào?',
  'Thương con. Viết ra được thế này là con mạnh mẽ lắm rồi. Hôm nay con đã ăn uống gì chưa?',
  'Cô ngồi đây với con nè. Không cần giải quyết ngay đâu, cứ thở chậm một chút đã. Mọi người trong quán sẽ ghé động viên con.',
];
const SUMMARY = 'Chốt bình chọn: "{winner}" thắng với {n} phiếu! Ai chọn khác thì vào kể lý do cho cả quán nghe đi 😄';

// ---------- Trạng thái ----------
const S = {
  io: null, players: null, push: null, roomSize: null,
  lastPublic: Date.now(), lastTopic: 0, lastTable: {}, recentTopics: [], polls: new Map(),
  greetQueue: new Set(), greeted: new Map(), joined: new Map(), nudged: new Set(), busy: false, lastMention: 0,
  timer: null, botId: null,
};

function ensureBot() {
  const row = db.prepare("SELECT id FROM users WHERE username = '__cotu__'").get();
  if (row) { S.botId = row.id; return; }
  const hash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 4);
  const av = JSON.stringify({ skin: 1, hairColor: 0, hairStyle: 2, shirt: 7, pants: 2, hat: 1 });
  S.botId = db.prepare('INSERT INTO users (username, pass_hash, nickname, avatar, is_bot, created_at) VALUES (?, ?, ?, ?, 1, ?)')
    .run('__cotu__', hash, 'Cô Tư (AI)', av, Date.now()).lastInsertRowid;
}

const enabled = () => config.cotu.enabled;
const aiOn = () => ai.isEnabled();

// Gửi một tin của Cô Tư vào kênh chat
function say(channel, text, extra = {}) {
  if (!S.push) return null;
  const item = { channel, npc: true, nickname: NAME, text: maskBadWords(String(text).slice(0, 400)), at: Date.now(), ...extra };
  S.push(item);
  if (channel === 'public') S.lastPublic = item.at;
  return item;
}

function init({ io, players, push, roomSize }) {
  Object.assign(S, { io, players, push, roomSize });
  ensureBot();
  if (S.timer) clearInterval(S.timer);
  S.timer = setInterval(() => { tick().catch((e) => console.error('Cô Tư hoạt náo lỗi:', e.message)); }, 20000);
  S.timer.unref();
}

// ---------- Sự kiện từ quán ----------
function onJoin(p, firstSocket) {
  S.joined.set(p.sid, Date.now());
  if (!enabled() || !firstSocket) return;
  const last = S.greeted.get(p.userId) || 0;
  if (Date.now() - last < 30 * 60e3) return;
  S.greeted.set(p.userId, Date.now());
  S.greetQueue.add(p.sid);
  setTimeout(flushGreets, 2500);
}
function flushGreets() {
  const names = [...S.greetQueue].map((sid) => S.players.get(sid)).filter(Boolean).map((p) => p.nickname);
  S.greetQueue.clear();
  if (!names.length) return;
  const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} và ${names.length - 3} người nữa` : names.join(names.length === 2 ? ' với ' : ', ');
  say('public', fill(pick(GREETS), { names: list }));
}
function onLeave(sid) { S.joined.delete(sid); S.nudged.delete(sid); }

function onOrder(p, drink) {
  if (!enabled() || !hit('host:order', 1, 30e3)) return;
  say('public', fill(pick(ORDER_SHOUTS), { name: p.nickname, drink: DRINK_INFO[drink] ? DRINK_INFO[drink].name : 'nước' }));
}

const MENTION_RE = /(^|[^\p{L}])(@?c[ôo]\s*t[ưu]|c[ôo]\s*ơi)([^\p{L}]|$)/iu;
function onChat(p, item) {
  if (item.channel === 'public') S.lastPublic = item.at;
  else S.lastTable[item.channel] = item.at;
  if (!MENTION_RE.test(item.text)) return;
  if (!hit(`host:m:${p.userId}`, 4, 10 * 60e3)) return;
  replyMention(p, item).catch((e) => console.error('Cô Tư trả lời lỗi:', e.message));
}
async function replyMention(p, item) {
  if (hasCrisisSignal(item.text)) return say(item.channel, CRISIS_REPLY);
  let text = null;
  if (aiOn() && !S.busy && Date.now() - S.lastMention > 5000) {
    S.busy = true; S.lastMention = Date.now();
    try {
      const recent = (S.history ? S.history(item.channel) : []).slice(-8).map((m) => `${m.nickname}: ${m.text}`).join('\n');
      text = await ai.hostReply(recent, p.nickname, item.text);
    } catch (e) { console.warn('Cô Tư AI không trả lời được:', e.status || e.message); } finally { S.busy = false; }
  }
  say(item.channel, text || `${p.nickname} ơi, ${pick(MENTION_REPLIES).replace(/^\p{L}/u, (c) => c.toLowerCase())}`);
}

// ---------- Khơi chuyện & bình chọn ----------
function remember(q) { S.recentTopics.push(q); if (S.recentTopics.length > 12) S.recentTopics.shift(); }
function fresh(list, key = (x) => x) { const f = list.filter((x) => !S.recentTopics.includes(key(x))); return pick(f.length ? f : list); }

async function startTopic(channel = 'public', poll = Math.random() < 0.5) {
  const tableId = channel.startsWith('table:') ? channel.slice(6) : null;
  let t = null;
  if (aiOn() && !S.busy) {
    S.busy = true;
    try { t = await ai.hostTopic({ poll: poll && !tableId, tableName: tableId ? TABLES[tableId] : null, recent: S.recentTopics.slice(-6).join(' | ') }); }
    catch (e) { console.warn('Cô Tư AI không nghĩ được chủ đề:', e.status || e.message); } finally { S.busy = false; }
  }
  if (!t) {
    if (tableId) t = { question: fresh(TABLE_Q[tableId] || OPEN), options: [] };
    else if (poll) t = { ...fresh(POLLS, (x) => x.question) };
    else t = { question: fresh(OPEN), options: [] };
  }
  remember(t.question);
  if (channel === 'public') S.lastTopic = Date.now(); else S.lastTable[`topic:${channel}`] = Date.now();
  if (t.options && t.options.length >= 2 && !tableId) return startPoll(channel, t.question, t.options);
  return say(channel, t.question);
}

function startPoll(channel, question, options) {
  const id = crypto.randomBytes(6).toString('hex');
  const poll = { id, channel, question, options, votes: new Map(), closesAt: Date.now() + config.cotu.pollMinutes * 60e3, closed: false };
  S.polls.set(id, poll);
  poll.item = say(channel, `📊 ${question}`, { poll: shapePoll(poll) });
  return poll;
}
function counts(poll) { const c = poll.options.map(() => 0); for (const v of poll.votes.values()) c[v] += 1; return c; }
function shapePoll(poll) { return { id: poll.id, question: poll.question, options: poll.options, counts: counts(poll), closesAt: poll.closesAt, closed: poll.closed }; }

function vote(userId, id, option) {
  const poll = S.polls.get(id);
  if (!poll || poll.closed) return { ok: false, error: 'Bình chọn đã kết thúc rồi.' };
  const o = Number(option);
  if (!Number.isInteger(o) || o < 0 || o >= poll.options.length) return { ok: false, error: 'Lựa chọn không hợp lệ.' };
  poll.votes.set(userId, o);
  const shaped = shapePoll(poll);
  if (poll.item) poll.item.poll = shaped;
  S.io.to(`ch:${poll.channel}`).emit('poll:update', { id, counts: shaped.counts });
  return { ok: true, counts: shaped.counts, mine: o };
}

async function closePoll(id) {
  const poll = S.polls.get(id);
  if (!poll || poll.closed) return;
  poll.closed = true;
  const c = counts(poll);
  const shaped = shapePoll(poll);
  if (poll.item) poll.item.poll = shaped;
  S.io.to(`ch:${poll.channel}`).emit('poll:close', { id, counts: c });
  const total = c.reduce((a, b) => a + b, 0);
  if (!total) { say(poll.channel, `Bình chọn "${poll.question}" không ai chọn hết… Các con ngại à? Thôi kể chuyện khác nào 😄`); return; }
  const max = Math.max(...c);
  const winner = poll.options[c.indexOf(max)];
  let text = null;
  if (aiOn() && !S.busy) {
    S.busy = true;
    try { text = await ai.hostPollSummary(poll.question, poll.options.map((o, i) => `${o}: ${c[i]}`).join(', ')); }
    catch (e) { console.warn('Cô Tư AI không tổng kết được:', e.status || e.message); } finally { S.busy = false; }
  }
  say(poll.channel, text || fill(SUMMARY, { winner, n: max }));
  setTimeout(() => S.polls.delete(id), 10 * 60e3).unref();
}

// Chạy mỗi 20 giây: nhắc người chưa gọi ly, đóng bình chọn hết giờ, khơi chuyện khi quán im lặng
async function tick() {
  if (!enabled() || !S.players) return;
  const now = Date.now();
  for (const poll of S.polls.values()) if (!poll.closed && poll.closesAt <= now) await closePoll(poll.id);
  const people = [...S.players.values()];
  if (!people.length) return;
  for (const p of people) {
    const since = S.joined.get(p.sid) || now;
    if (!p.seated && !S.nudged.has(p.sid) && now - since > config.cotu.nudgeSeconds * 1000) {
      S.nudged.add(p.sid);
      S.io.to(p.sid).emit('npc:whisper', { nickname: NAME, text: pick(NUDGES) });
    }
  }
  const openPoll = [...S.polls.values()].some((x) => !x.closed && x.channel === 'public');
  if (!openPoll && now - S.lastPublic > config.cotu.quietMinutes * 60e3 && now - S.lastTopic > config.cotu.gapMinutes * 60e3) {
    await startTopic('public');
    return;
  }
  for (const id of Object.keys(TABLES)) {
    const ch = `table:${id}`;
    if (S.roomSize(ch) < 2) continue;
    const lastMsg = S.lastTable[ch] || 0, lastTopic = S.lastTable[`topic:${ch}`] || 0;
    if (now - lastMsg > config.cotu.tableQuietMinutes * 60e3 && now - lastTopic > config.cotu.tableQuietMinutes * 60e3) {
      await startTopic(ch, false);
      return; // mỗi lượt chỉ khơi một chỗ cho đỡ ồn
    }
  }
}

// ---------- Không để tâm sự nào bị bỏ trống ----------
function onNewPost(postId) {
  if (!enabled()) return;
  setTimeout(() => { commentOnPost(postId).catch((e) => console.error('Cô Tư bình luận lỗi:', e.message)); }, config.cotu.postCommentDelaySec * 1000).unref();
}
async function commentOnPost(postId) {
  const p = db.prepare('SELECT * FROM posts WHERE id = ? AND hidden = 0').get(postId);
  if (!p) return null;
  if (db.prepare('SELECT COUNT(*) n FROM comments WHERE post_id = ?').get(postId).n > 0) return null; // đã có người hỏi han
  let text = null;
  if (hasCrisisSignal(p.content)) text = CRISIS_REPLY;
  else if (aiOn()) {
    try { text = await ai.hostPostComment(p.content, TABLES[p.table_id]); }
    catch (e) { console.warn('Cô Tư AI không bình luận được:', e.status || e.message); }
  }
  text = maskBadWords((text || pick(POST_COMMENTS)).slice(0, 600));
  const now = Date.now();
  const id = db.prepare('INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)').run(p.id, S.botId, text, now).lastInsertRowid;
  db.prepare('INSERT INTO notifications (user_id, kind, post_id, actor, created_at) VALUES (?, ?, ?, ?, ?)').run(p.user_id, 'comment', p.id, 'Cô Tư (AI)', now);
  if (S.io) S.io.to(`user:${p.user_id}`).emit('notify', { kind: 'comment', postId: p.id, actor: 'Cô Tư (AI)' });
  return id;
}

function setHistory(fn) { S.history = fn; }
function stop() { if (S.timer) clearInterval(S.timer); }

module.exports = { say, init, setHistory, onJoin, onLeave, onOrder, onChat, onNewPost, vote, tick, startTopic, startPoll, closePoll, commentOnPost, stop, botId: () => S.botId };
