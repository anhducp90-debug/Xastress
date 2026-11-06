// Giao diện: đăng nhập, bảng tâm sự, bình luận, hồ sơ, realtime.
import { Game } from './game.js';
import { TABLES, tableById } from './world.js';
import { createMenu, drinkById, treatChips } from './menu.js';
import { createSocial } from './social.js';
import { drawAvatarPreview as drawAvatar2D, AVATAR_OPTIONS, AVATAR_LABELS, PALETTE, HAIR_NAMES, HAT_NAMES } from './sprites.js';

let drawAvatarPreview = drawAvatar2D;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------- An toàn HTML ----------
class Raw { constructor(s) { this.s = s; } }
const raw = (s) => new Raw(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) {
      const v = vals[i];
      if (v instanceof Raw) out += v.s;
      else if (Array.isArray(v)) out += v.map((x) => (x instanceof Raw ? x.s : esc(x))).join('');
      else out += esc(v);
    }
  });
  return raw(out);
}

// ---------- API ----------
async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { 'X-Requested-With': 'xastress', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  try { data = await res.json(); } catch { /* bỏ qua */ }
  if (res.status === 403 && data.needOrder) setTimeout(() => menu.openMenu(), 300); // chưa gọi ly trong lượt vào quán này
  if (!res.ok) { const e = new Error(data.error || 'Có lỗi xảy ra, thử lại nhé.'); e.data = data; e.status = res.status; throw e; }
  return data;
}

// ---------- Hằng số hiển thị ----------
const MOODS = {
  met: 'Mệt mỏi 😮‍💨', buon: 'Buồn 😢', tuc: 'Bực tức 😤', lo: 'Lo âu 😟', chan: 'Chán nản 😞', ap_luc: 'Áp lực 🥵',
};
const REACTS = { dongcam: '🫂 Đồng cảm', coLen: '💪 Cố lên', om: '❤️ Thương' };
const ENCOURAGE = [
  'Bạn đã làm rất tốt rồi.', 'Mình hiểu cảm giác này.', 'Cố lên, rồi mọi chuyện sẽ ổn!',
  'Nghỉ ngơi chút đi bạn nhé.', 'Bạn không một mình đâu.', 'Cảm ơn bạn đã dám kể ra.',
];
const NPC_COMFORT = [
  'Con à, buồn thì cứ buồn, khóc được thì cứ khóc. Xong rồi mình uống ly trà, đứng dậy đi tiếp.',
  'Ai cũng có lúc thấy mình chẳng ra gì. Nhưng con đã cố gắng tới hôm nay, vậy là giỏi lắm rồi.',
  'Chuyện lớn cỡ nào, chia nhỏ ra từng ngày mà gỡ. Hôm nay chỉ cần làm một việc nhỏ thôi.',
  'Đừng so mình với người ta. Mỗi người một ly trà, mỗi người một vị.',
  'Mệt thì nghỉ, đâu ai bắt con chạy hoài. Ngủ một giấc, mai trời lại sáng.',
  'Có người lắng nghe là nhẹ lòng một nửa rồi đó. Kể cho mọi người trong quán nghe đi con.',
];
const SUPPORT_HTML = html`
  <div class="support">
    <h3>💗 Bạn không một mình</h3>
    <p>Nếu bạn đang nghĩ đến việc làm hại bản thân hoặc đang gặp nguy hiểm, hãy liên hệ ngay:</p>
    <ul>
      <li>🚑 Cấp cứu: <a href="tel:115">115</a> · Công an: <a href="tel:113">113</a></li>
      <li>📞 Đường dây nóng Ngày Mai (hỗ trợ trầm cảm, khủng hoảng tâm lý): <a href="tel:0963061414">096 306 1414</a></li>
      <li>🧒 Tổng đài Quốc gia Bảo vệ Trẻ em (miễn phí, 24/7): <a href="tel:111">111</a></li>
    </ul>
    <p>Hoặc gọi cho một người bạn tin tưởng ngay lúc này. Quán luôn ở đây, nhưng bạn xứng đáng được giúp đỡ trực tiếp. <br><small>Số điện thoại có thể thay đổi theo thời gian – hãy kiểm tra lại nếu không gọi được.</small></p>
  </div>`;

function notifText(kind, live, qty = 1) {
  const [k, v] = kind.split(':');
  if (k === 'comment') return live ? 'vừa gửi lời động viên cho bạn 💌' : 'đã gửi lời động viên 💌';
  if (k === 'treat' || k === 'gift') { const d = drinkById[v]; return d ? `${live ? 'vừa ' : 'đã '}mời bạn ${qty} ly ${d.name.toLowerCase()} ${d.icon}` : `đã mời bạn ${qty} ly nước 🍵`; }
  return live ? `vừa ${REACTS[v] || 'thả tim'} tâm sự của bạn` : `đã bày tỏ ${REACTS[v] || ''}`;
}

function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} ngày trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}
function toast(msg, warn = false) {
  const el = document.createElement('div');
  el.className = `toast${warn ? ' warn' : ''}`;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 4500);
}

// ---------- Trạng thái ----------
let me = null;
let socket = null;
let game = null;
let currentView = null;

// ---------- Modal ----------
function openModal(content, view) {
  $('#modalBody').onclick = null;
  $('#modalBody').innerHTML = content.s;
  $('#modal').classList.remove('hidden');
  currentView = view;
  hydrateAvatars($('#modalBody'));
  const first = $('#modalBody [autofocus]');
  if (first) first.focus();
}
function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modalBody').innerHTML = '';
  currentView = null;
  if (breathTimer) { clearInterval(breathTimer); breathTimer = null; }
}
const isModalOpen = () => !$('#modal').classList.contains('hidden') || !$('#auth').classList.contains('hidden');
$('#modalClose').onclick = closeModal;
$('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') closeModal(); });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal();
  else if (e.key === 'Enter' && !isModalOpen() && document.activeElement !== $('#chatInput') && me) {
    e.preventDefault(); $('#chatInput').focus();
  }
});

// Avatar mini trong danh sách
function avatarCanvas(av) {
  return html`<canvas width="40" height="60" data-av="${JSON.stringify(av)}"></canvas>`;
}
function hydrateAvatars(root) {
  for (const c of $$('canvas[data-av]', root)) {
    try { drawAvatarPreview(c, JSON.parse(c.dataset.av)); } catch { /* bỏ qua */ }
  }
}

// ---------- Trình chỉnh avatar ----------
function avatarEditor(container, preview, initial) {
  const av = { ...initial };
  const label = (k, v) => {
    if (k === 'hairStyle') return raw(`<em>${esc(HAIR_NAMES[v])}</em>`);
    if (k === 'hat') return raw(`<em>${esc(HAT_NAMES[v])}</em>`);
    const col = PALETTE[k][v];
    return raw(`<em><i class="swatch" data-color="${esc(col)}"></i></em>`);
  };
  const render = () => {
    container.innerHTML = Object.keys(AVATAR_OPTIONS).map((k) => html`
      <div class="opt"><span>${AVATAR_LABELS[k]}</span><div>
        <button type="button" class="btn small" data-k="${k}" data-d="-1" aria-label="Trước">◀</button>
        ${label(k, av[k])}
        <button type="button" class="btn small" data-k="${k}" data-d="1" aria-label="Sau">▶</button>
      </div></div>`.s).join('');
    for (const sw of $$('.swatch', container)) sw.style.background = sw.dataset.color;
    drawAvatarPreview(preview, av);
  };
  container.onclick = (e) => {
    const b = e.target.closest('button[data-k]');
    if (!b) return;
    const k = b.dataset.k, n = AVATAR_OPTIONS[k];
    av[k] = (av[k] + Number(b.dataset.d) + n) % n;
    render();
  };
  let dirI = 0;
  preview.onclick = () => { dirI = (dirI + 1) % 4; drawAvatarPreview(preview, av, ['down', 'left', 'up', 'right'][dirI]); };
  render();
  return av;
}
const randomAvatar = () => Object.fromEntries(Object.entries(AVATAR_OPTIONS).map(([k, n]) => [k, Math.floor(Math.random() * n)]));
const NICK_A = ['Trà', 'Hạt', 'Mây', 'Gió', 'Lá', 'Nắng', 'Mưa', 'Cỏ', 'Sương', 'Khói'];
const NICK_B = ['Chanh', 'Hướng Dương', 'Bàng', 'Đá', 'Lạc', 'Phố', 'Chiều', 'Muộn', 'Xanh', 'Nhài'];
const randomNick = () => `${NICK_A[Math.random() * 10 | 0]} ${NICK_B[Math.random() * 10 | 0]} #${1000 + (Math.random() * 9000 | 0)}`;

// ---------- Đăng nhập / đăng ký ----------
let regAvatar = null;
function setupAuth() {
  regAvatar = avatarEditor($('#regAvatar'), $('#regPreview'), randomAvatar());
  $('#registerForm').nickname.value = randomNick();
  $('#randNick').onclick = () => { $('#registerForm').nickname.value = randomNick(); };
  for (const t of $$('.tab')) {
    t.onclick = () => {
      $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
      $('#registerForm').classList.toggle('hidden', t.dataset.tab !== 'register');
      $('#loginForm').classList.toggle('hidden', t.dataset.tab !== 'login');
    };
  }
  $('#registerForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    $('#regErr').textContent = '';
    try {
      const { user } = await api('/auth/register', { body: { username: f.username.value.trim(), password: f.password.value, nickname: f.nickname.value.trim(), avatar: regAvatar } });
      enter(user, true);
    } catch (err) { $('#regErr').textContent = err.message; }
  };
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    $('#loginErr').textContent = '';
    try {
      const { user } = await api('/auth/login', { body: { username: f.username.value.trim(), password: f.password.value } });
      enter(user, false);
    } catch (err) { $('#loginErr').textContent = err.message; }
  };
}

async function enter(user, isNew) {
  await gameReady;
  me = user;
  $('#auth').classList.add('hidden');
  for (const id of ['#hud', '#chatbar', '#help']) $(id).classList.remove('hidden');
  $('#adminBtn').classList.toggle('hidden', !me.isAdmin);
  connect();
  refreshTables();
  refreshNotifs();
  if (isNew) {
    setTimeout(() => openNpc(true), 600);
  }
}

function showAuth() {
  me = null;
  if (socket) { socket.disconnect(); socket = null; }
  if (game) game.clearPlayers();
  for (const id of ['#hud', '#chatbar', '#help']) $(id).classList.add('hidden');
  $('#auth').classList.remove('hidden');
}

// ---------- Realtime ----------
function connect() {
  if (socket) socket.disconnect();
  socket = window.io({ withCredentials: true });
  social.bindSocket(socket);
  socket.on('connect_error', (err) => {
    if (err.message === 'unauthorized') { toast('Phiên đăng nhập đã hết, mời bạn vào quán lại.', true); showAuth(); }
  });
  socket.on('world:init', ({ you, players }) => {
    game.clearPlayers();
    for (const p of players) {
      if (p.sid === you) game.setMe(p);
      else game.upsertPlayer(p);
    }
  });
  socket.on('p:join', (p) => game.upsertPlayer(p));
  socket.on('p:move', (p) => game.upsertPlayer(p));
  socket.on('p:update', (u) => game.updatePlayer(u));
  socket.on('p:leave', (sid) => game.removePlayer(sid));
  socket.on('online', (n) => { $('#online').textContent = `${n} người trong quán`; });
  socket.on('emote', (m) => game.emote(m.sid, m.e));
  socket.on('order', (o) => {
    const d = drinkById[o.drink];
    if (!d) return;
    game.say(o.sid, `${d.icon} Cô ơi, cho ly ${d.name.toLowerCase()}!`);
    if (game.coTuSay) setTimeout(() => game.coTuSay(`Có ngay ${d.name.toLowerCase()} cho ${o.nickname} đây!`), 1200);
    if (game.holdDrink) setTimeout(() => game.holdDrink(o.sid, o.drink), 1800);
  });
  socket.on('sys', (m) => toast(m));
  socket.on('support', () => openSupport());
  socket.on('post:new', (p) => { game.sparkleTable(p.tableId); refreshTables(); });
  socket.on('post:remove', () => refreshTables());
  socket.on('notify', (n) => {
    if (n.kind === 'xu') { toast(`🪙 Đã nạp ${n.amount} xu vào ví qua Telegram. Cảm ơn bạn ủng hộ quán!`); return; }
    if (n.kind === 'tg_linked') { toast('✅ Đã liên kết Telegram. Chọn gói xu trong bot nhé.'); return; }
    toast(`${n.actor} ${notifText(n.kind, true, n.qty || 1)}${n.message ? `: “${n.message}”` : ''}`);
    if (n.funny) setTimeout(() => toast(`😅 ${n.funny}`), 700);
    if (n.toGlass || n.toTray) {
      const parts = [];
      if (n.toGlass) parts.push('🥤 1 ly là của bạn để uống');
      if (n.toTray) parts.push(`🎁 ${n.toTray} ly vào khay để tặng tiếp (giờ có ${n.tray} ly)`);
      setTimeout(() => toast(parts.join(' · ')), 1400);
    }
    refreshNotifs();
  });
  socket.on('treat', (t) => { game.sparkleTable(t.tableId); });
  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') { toast('Bạn đã bị mời ra khỏi quán.', true); showAuth(); }
  });
}

async function refreshTables() {
  try {
    const { tables } = await api('/tables');
    game.setTableCounts(Object.fromEntries(tables.map((t) => [t.id, t.recent])));
  } catch { /* bỏ qua */ }
}
async function refreshNotifs() {
  try {
    const { unread } = await api('/notifications');
    $('#bell').textContent = unread;
    $('#bell').classList.toggle('hidden', !unread);
  } catch { /* bỏ qua */ }
}

// ---------- Hiển thị tâm sự ----------
function postCard(p, { clickable = true, full = false } = {}) {
  const who = p.author ? html`${avatarCanvas(p.author.avatar)} ${p.author.nickname}` : html`🎭 Một vị khách ẩn danh`;
  const t = tableById[p.tableId];
  return html`
  <article class="post ${clickable ? 'clickable' : ''}" data-post="${p.id}">
    <div class="meta">
      <span class="who">${who}</span>${p.isMine ? html` <span class="mood">của bạn</span>` : ''}
      <span>· ${ago(p.createdAt)}</span>
      <span class="mood">${MOODS[p.mood] || ''}</span>
      ${!full && t ? html`<span class="mood">${t.icon} ${t.name}</span>` : ''}
      ${p.resolved ? html`<span class="resolved">✨ Đã vượt qua</span>` : ''}
    </div>
    <div class="content ${full ? '' : 'clamp'}">${p.content}</div>
    <div class="reacts">
      ${Object.entries(REACTS).map(([k, label]) => html`<button class="btn small react ${p.myReactions.includes(k) ? 'on' : ''}" data-react="${k}" data-id="${p.id}">${label} <b>${p.reactions[k] || 0}</b></button>`)}
      <span class="mood">💬 ${p.commentCount}</span>
      ${p.treats && p.treats.total ? html`<span class="counters">${raw(treatChips(p.treats))}</span>` : ''}
    </div>
  </article>`;
}

function bindPostList(root, reopen) {
  root.onclick = async (e) => {
    const r = e.target.closest('[data-react]');
    if (r) {
      e.stopPropagation();
      try {
        const res = await api(`/posts/${r.dataset.id}/react`, { body: { kind: r.dataset.react } });
        const card = r.closest('.post');
        for (const b of $$('[data-react]', card)) {
          b.classList.toggle('on', res.myReactions.includes(b.dataset.react));
          b.querySelector('b').textContent = res.reactions[b.dataset.react];
        }
        if (res.added && socket) socket.emit('emote', { dongcam: 'hug', coLen: 'cheer', om: 'heart' }[r.dataset.react]);
      } catch (err) { toast(err.message, true); }
      return;
    }
    const card = e.target.closest('.post.clickable');
    if (card) openPost(+card.dataset.post, reopen);
  };
}

async function openTable(id) {
  const t = tableById[id];
  openModal(html`<h2>${t.icon} Bàn ${t.name}</h2><p class="empty">Đang rót trà…</p>`, 'table');
  try {
    const { posts } = await api(`/posts?table=${encodeURIComponent(id)}`);
    if (currentView !== 'table') return;
    $('#modalBody').innerHTML = html`
      <h2>${t.icon} Bàn ${t.name}</h2>
      <p class="tag">Ngồi xuống nghe mọi người kể chuyện. Một lời động viên nhỏ có thể làm ai đó nhẹ lòng cả ngày.</p>
      <div class="actions"><button class="btn warm" id="writeHere">✍️ Kể chuyện ở bàn này</button></div>
      <div id="list">${posts.length ? posts.map((p) => postCard(p, { full: false })) : html`<div class="empty"><div class="big">🍵</div>Bàn này chưa ai kể chuyện. Bạn ngồi xuống kể trước nhé?</div>`}</div>
      ${posts.length >= 20 ? html`<div class="actions"><button class="btn" id="more">Xem thêm</button></div>` : ''}
    `.s;
    hydrateAvatars($('#modalBody'));
    $('#writeHere').onclick = () => openWrite(id);
    bindPostList($('#list'), () => openTable(id));
    const more = $('#more');
    if (more) more.onclick = () => loadMore(more, `/posts?table=${encodeURIComponent(id)}`, () => openTable(id));
  } catch (err) { toast(err.message, true); }
}

async function loadMore(btn, base, reopen) {
  const cards = $$('#list .post');
  const last = cards[cards.length - 1];
  if (!last) return;
  btn.disabled = true;
  try {
    const { posts } = await api(`${base}${base.includes('?') ? '&' : '?'}before=${last.dataset.post}`);
    $('#list').insertAdjacentHTML('beforeend', posts.map((p) => postCard(p).s).join(''));
    hydrateAvatars($('#list'));
    if (posts.length < 20) btn.remove(); else btn.disabled = false;
    bindPostList($('#list'), reopen);
  } catch (err) { toast(err.message, true); btn.disabled = false; }
}

async function openFeed() {
  openModal(html`<h2>📰 Quanh quán hôm nay</h2><p class="empty">Đang rót trà…</p>`, 'feed');
  try {
    const { posts } = await api('/posts');
    if (currentView !== 'feed') return;
    $('#modalBody').innerHTML = html`
      <h2>📰 Quanh quán hôm nay</h2>
      <p class="tag">Những câu chuyện mới nhất từ mọi bàn.</p>
      <div id="list">${posts.length ? posts.map((p) => postCard(p)) : html`<div class="empty"><div class="big">🍵</div>Quán còn vắng. Bạn mở hàng nhé!</div>`}</div>
      ${posts.length >= 20 ? html`<div class="actions"><button class="btn" id="more">Xem thêm</button></div>` : ''}`.s;
    hydrateAvatars($('#modalBody'));
    bindPostList($('#list'), openFeed);
    const more = $('#more');
    if (more) more.onclick = () => loadMore(more, '/posts', openFeed);
  } catch (err) { toast(err.message, true); }
}

async function openMine() {
  openModal(html`<h2>📜 Tâm sự của tôi</h2><p class="empty">Đang tìm…</p>`, 'mine');
  try {
    const [{ posts }, gifts] = await Promise.all([api('/posts/mine'), api('/me/treats')]);
    if (currentView !== 'mine') return;
    $('#modalBody').innerHTML = html`
      <h2>📜 Tâm sự của tôi</h2>
      <section class="treat-box">
        <h3>🎁 Quầy quà của bạn ${gifts.treats.total ? `– ${gifts.treats.total} ly nước` : ''}</h3>
        ${gifts.treats.total ? html`
          <div class="counters big">${raw(treatChips(gifts.treats))}</div>
          <div class="reply-bubble"><b>Bạn:</b> “${gifts.treats.funny}”</div>
          ${gifts.notes.filter((t) => t.message).slice(0, 12).map((t) => html`<div class="tnote">${drinkById[t.drink] ? drinkById[t.drink].icon : '🍵'}×${t.qty} <b>${t.from}</b>: “${t.message}” <small>${ago(t.createdAt)}</small></div>`)}`
        : html`<p class="tag">Khi bạn kể chuyện, mọi người có thể mời bạn trà đá, cà phê… kèm lời nhắn. Được tặng nhiều ly thì 1 ly là của bạn, phần còn lại bạn tặng tiếp cho người khác.</p>`}
      </section>
      <p class="tag">Chỉ mình bạn thấy danh sách này. Khi đã ổn hơn, hãy đánh dấu "Đã vượt qua" để truyền cảm hứng cho người khác ✨</p>
      <div id="list">${posts.length ? posts.map((p) => postCard(p)) : html`<div class="empty"><div class="big">📝</div>Bạn chưa kể chuyện nào.</div>`}</div>`.s;
    hydrateAvatars($('#modalBody'));
    bindPostList($('#list'), openMine);
  } catch (err) { toast(err.message, true); }
}

async function openPost(id, back) {
  try {
    const { post: p } = await api(`/posts/${id}`);
    const t = tableById[p.tableId];
    openModal(html`
      ${back ? html`<button class="linkish" id="back">← Quay lại</button>` : ''}
      <h2>${t ? `${t.icon} Bàn ${t.name}` : 'Tâm sự'}</h2>
      ${p.isMine && p.crisis ? SUPPORT_HTML : ''}
      <div id="list">${postCard(p, { clickable: false, full: true })}</div>
      <section class="treat-box">
        <h3>🎁 Nước mọi người mời ${p.treats.total ? `(${p.treats.total} ly)` : ''}</h3>
        ${p.treats.total ? html`
          <div class="counters big">${raw(treatChips(p.treats))}</div>
          <div class="reply-bubble"><b>${p.isMine ? 'Bạn' : 'Người được mời'}:</b> “${p.treats.funny}”</div>
          ${p.treatNotes.length ? html`<div class="treat-notes">${p.treatNotes.map((t) => html`<div class="tnote">${drinkById[t.drink] ? drinkById[t.drink].icon : '🍵'}×${t.qty} <b>${t.from}</b>: “${t.message}” <small>${ago(t.createdAt)}</small></div>`)}</div>` : ''}`
        : html`<p class="tag">${p.isMine ? 'Chưa ai mời nước. Mọi người sẽ ghé qua thôi 🍵' : 'Chưa ai mời. Mời người ấy ly nước đầu tiên nhé!'}</p>`}
        ${p.isMine ? '' : html`<div id="treatSlot"><button class="btn green" id="openTreat">🎁 Mời người này một ly</button></div>`}
      </section>
      <div class="actions">
        ${p.isMine ? html`<button class="btn ${p.resolved ? '' : 'green'}" id="resolve">${p.resolved ? '↩️ Bỏ đánh dấu' : '✨ Tôi đã vượt qua'}</button>
          <button class="btn" id="delPost">🗑️ Xoá</button>` : html`<button class="linkish" data-report="post" data-id="${p.id}">🚩 Báo cáo</button>`}
        ${me.isAdmin && !p.isMine ? html`<button class="linkish" id="adminDel">🛡️ Xoá (quản trị)</button>` : ''}
      </div>
      <h3>💌 Lời động viên (${p.comments.length})</h3>
      <div id="comments">${p.comments.length ? p.comments.map((c) => html`
        <div class="comment ${c.byAuthor ? 'author' : ''}">
          <div class="meta">${c.author ? html`${avatarCanvas(c.author.avatar)} <b>${c.author.nickname}</b>` : html`🎭 <b>Người kể chuyện</b>`}
            ${c.bot ? html`<span class="ai-tag" title="Trợ lý AI của quán, không phải người thật">AI</span>` : ''}
            ${c.byAuthor && c.author ? html`<span class="mood">người kể</span>` : ''} · ${ago(c.createdAt)}
            ${c.isMine || me.isAdmin ? html`<button class="linkish" data-delc="${c.id}">xoá</button>` : html`<button class="linkish" data-report="comment" data-id="${c.id}">🚩</button>`}
          </div>
          <div class="content">${c.content}</div>
        </div>`) : html`<p class="tag">Chưa có ai lên tiếng. Bạn là người đầu tiên nhé!</p>`}</div>
      <form id="commentForm" class="form">
        <div class="suggest">${ENCOURAGE.map((s) => html`<button type="button" data-s="${s}">${s}</button>`)}</div>
        <textarea name="content" maxlength="1000" placeholder="${p.isMine ? 'Cảm ơn mọi người, hoặc kể thêm…' : 'Viết đôi lời đồng cảm, cổ vũ… Hãy tử tế và đừng phán xét nhé.'}" required></textarea>
        <button class="btn warm" type="submit">💌 Gửi lời động viên</button>
      </form>
    `, 'post');
    if (back) $('#back').onclick = back;
    bindPostList($('#list'), null);
    const ot = $('#openTreat');
    if (ot) ot.onclick = () => menu.mountTreat($('#treatSlot'), p.id, () => setTimeout(() => { if (currentView === 'post') openPost(p.id, back); }, 3500));
    const form = $('#commentForm');
    $('.suggest', form).onclick = (e) => {
      const b = e.target.closest('[data-s]');
      if (b) { form.content.value = (form.content.value ? form.content.value.trim() + ' ' : '') + b.dataset.s; form.content.focus(); }
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/posts/${p.id}/comments`, { body: { content: form.content.value } });
        if (socket) socket.emit('emote', 'heart');
        openPost(p.id, back);
      } catch (err) { toast(err.message, true); }
    };
    const resolve = $('#resolve');
    if (resolve) resolve.onclick = async () => {
      try {
        const { post } = await api(`/posts/${p.id}/resolve`, { body: {} });
        if (post.resolved) { toast('Giỏi lắm! Cả quán tự hào về bạn ✨'); if (socket) socket.emit('emote', 'cheer'); }
        openPost(p.id, back);
      } catch (err) { toast(err.message, true); }
    };
    const del = $('#delPost') || $('#adminDel');
    if (del) del.onclick = async () => {
      if (!confirm('Xoá tâm sự này? Không thể hoàn tác.')) return;
      try { await api(`/posts/${p.id}`, { method: 'DELETE' }); toast('Đã xoá.'); back ? back() : closeModal(); }
      catch (err) { toast(err.message, true); }
    };
    $('#modalBody').onclick = async (e) => {
      const rep = e.target.closest('[data-report]');
      if (rep) {
        const reason = prompt('Lý do báo cáo (tuỳ chọn): xúc phạm, spam, nội dung nguy hiểm…');
        if (reason === null) return;
        try { await api('/report', { body: { type: rep.dataset.report, id: +rep.dataset.id, reason } }); toast('Cảm ơn bạn đã giúp quán sạch đẹp 🧹'); }
        catch (err) { toast(err.message, true); }
      }
      const dc = e.target.closest('[data-delc]');
      if (dc && confirm('Xoá lời này?')) {
        try { await api(`/comments/${dc.dataset.delc}`, { method: 'DELETE' }); openPost(p.id, back); }
        catch (err) { toast(err.message, true); }
      }
    };
  } catch (err) { toast(err.message, true); }
}

function openWrite(tableId, prefill = '') {
  openModal(html`
    <h2>✍️ Gọi ly trà, kể chuyện</h2>
    <p class="tag">Viết ra là đã nhẹ đi một nửa. Không ai biết bạn là ai nếu bạn chọn ẩn danh.</p>
    <form id="writeForm" class="form">
      <label>Ngồi bàn nào?
        <select name="tableId">${TABLES.map((t) => html`<option value="${t.id}" ${t.id === tableId ? raw('selected') : ''}>${t.icon} Bàn ${t.name}</option>`)}</select>
      </label>
      <div><b>Bạn đang thấy thế nào?</b>
        <div class="choices">${Object.entries(MOODS).map(([k, v], i) => html`<label><input type="radio" name="mood" value="${k}" ${i === 0 ? raw('checked') : ''}>${v}</label>`)}</div>
      </div>
      <label>Chuyện của bạn
        <textarea name="content" maxlength="3000" required minlength="10" autofocus placeholder="Hôm nay có chuyện gì làm bạn ức chế? Cứ kể hết ra đây…"></textarea>
        <span class="counter"><span id="cnt">0</span>/3000</span>
      </label>
      <label class="check"><input type="checkbox" name="anonymous" checked> 🎭 Đăng ẩn danh hoàn toàn (không hiện cả biệt danh)</label>
      <p class="err" id="writeErr"></p>
      <button class="btn big warm" type="submit">🍵 Đặt ly trà lên bàn</button>
    </form>`, 'write');
  const f = $('#writeForm');
  f.content.oninput = () => { $('#cnt').textContent = [...f.content.value].length; };
  if (prefill) { f.content.value = prefill; f.content.oninput(); }
  f.onsubmit = async (e) => {
    e.preventDefault();
    $('#writeErr').textContent = '';
    try {
      const { post } = await api('/posts', { body: { tableId: f.tableId.value, mood: f.mood.value, content: f.content.value, anonymous: f.anonymous.checked } });
      toast('Ly trà của bạn đã lên bàn. Mọi người sẽ ghé qua động viên bạn 🍵');
      if (socket) socket.emit('emote', 'tea');
      openPost(post.id, () => openTable(post.tableId));
    } catch (err) { $('#writeErr').textContent = err.message; }
  };
}

async function openNotifs() {
  try {
    const { items } = await api('/notifications');
    openModal(html`
      <h2>🔔 Thông báo</h2>
      ${items.length ? items.map((n) => html`
        <div class="notif ${n.read ? '' : 'unread'}" data-post="${n.postId}">
          <b>${n.actor}</b> ${notifText(n.kind, false, n.qty || 1)}
          ${n.message ? html`<div class="notif-msg">💌 “${n.message}”</div>` : ''}
          <small>“${n.preview}…” · ${ago(n.createdAt)}</small>
        </div>`) : html`<div class="empty"><div class="big">🔕</div>Chưa có thông báo nào.</div>`}`, 'notifs');
    $('#modalBody').onclick = (e) => {
      const n = e.target.closest('.notif');
      if (n) { $('#modalBody').onclick = null; openPost(+n.dataset.post, openNotifs); }
    };
    await api('/notifications/read', { body: {} });
    refreshNotifs();
  } catch (err) { toast(err.message, true); }
}

function openProfile() {
  openModal(html`
    <h2>👤 Danh tính của bạn</h2>
    <form id="profileForm" class="form">
      <div class="avatar-row">
        <canvas id="profPreview" width="120" height="150" title="Bấm để xoay"></canvas>
        <div class="grow">
          <label>Biệt danh công khai <input name="nickname" maxlength="32" value="${me.nickname}" required></label>
          <div id="profAvatar" class="avatar-editor"></div>
        </div>
      </div>
      <button class="btn warm" type="submit">💾 Lưu</button>
    </form>
    <h3>🔑 Đổi mật khẩu</h3>
    <form id="passForm" class="form">
      <input name="oldPassword" type="password" placeholder="Mật khẩu hiện tại" autocomplete="current-password" required>
      <input name="newPassword" type="password" placeholder="Mật khẩu mới (≥ 8 ký tự)" autocomplete="new-password" minlength="8" required>
      <button class="btn" type="submit">Đổi mật khẩu</button>
    </form>
    <h3>🚪 Rời quán</h3>
    <div class="actions">
      <button class="btn" id="logout">Đăng xuất</button>
      <button class="btn" id="delAcc">🗑️ Xoá tài khoản & toàn bộ dữ liệu</button>
    </div>`, 'profile');
  const av = avatarEditor($('#profAvatar'), $('#profPreview'), me.avatar);
  $('#profileForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const { user } = await api('/auth/profile', { body: { nickname: e.target.nickname.value, avatar: av } });
      me = user;
      if (socket) socket.emit('profile');
      toast('Đã lưu diện mạo mới ✨');
    } catch (err) { toast(err.message, true); }
  };
  $('#passForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/auth/password', { body: { oldPassword: e.target.oldPassword.value, newPassword: e.target.newPassword.value } });
      toast('Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.');
      e.target.reset();
      connect();
    } catch (err) { toast(err.message, true); }
  };
  $('#logout').onclick = async () => { await api('/auth/logout', { body: {} }).catch(() => {}); closeModal(); showAuth(); };
  $('#delAcc').onclick = async () => {
    const pw = prompt('Nhập mật khẩu để xác nhận XOÁ VĨNH VIỄN tài khoản cùng mọi tâm sự, bình luận:');
    if (!pw) return;
    try { await api('/auth/delete', { body: { password: pw } }); closeModal(); showAuth(); toast('Tài khoản đã được xoá. Chúc bạn luôn bình an 🌿'); }
    catch (err) { toast(err.message, true); }
  };
}

let breathTimer = null;
function openNpc(welcome = false) {
  openModal(html`
    <div class="npc">
      <canvas id="npcAv" width="80" height="100"></canvas>
      <div class="say" id="npcSay">${welcome
        ? `Chào ${me.nickname}! Lần đầu ghé quán hả? Ngồi đâu cũng được, mỗi bàn là một chuyện: công việc, gia đình, tình cảm… Có gì ức chế cứ kể, ở đây không ai phán xét đâu.`
        : 'Gì đó con? Uống ly trà đá cho mát rồi kể cô nghe.'}</div>
    </div>
    <div class="npc-menu">
      <button class="btn warm" data-npc="menu">🧋 Cô ơi, cho con xem thực đơn</button>
      <button class="btn" data-npc="write">🍵 Cho con một ly trà đá (kể chuyện)</button>
      <button class="btn" data-npc="comfort">😔 Cô ơi, con mệt quá…</button>
      <button class="btn" data-npc="breathe">🌬️ Thở cùng cô một chút</button>
      <button class="btn" data-npc="feed">📰 Hôm nay quán có chuyện gì?</button>
      <button class="btn" data-npc="rules">📜 Nội quy quán</button>
      <button class="btn" data-npc="support">☎️ Con cần được giúp ngay</button>
    </div>`, 'npc');
  drawAvatarPreview($('#npcAv'), { skin: 1, hairColor: 0, hairStyle: 2, shirt: 7, pants: 2, hat: 1 });
  $('.npc-menu').onclick = (e) => {
    const b = e.target.closest('[data-npc]');
    if (!b) return;
    const a = b.dataset.npc;
    if (breathTimer) { clearInterval(breathTimer); breathTimer = null; }
    if (a === 'write') openWrite();
    else if (a === 'menu') menu.openMenu();
    else if (a === 'feed') openFeed();
    else if (a === 'rules') openRules();
    else if (a === 'support') openSupport();
    else if (a === 'comfort') $('#npcSay').textContent = NPC_COMFORT[Math.floor(Math.random() * NPC_COMFORT.length)];
    else if (a === 'breathe') {
      const steps = [['Hít vào thật sâu bằng mũi…', 4], ['Giữ hơi lại…', 4], ['Thở ra chậm bằng miệng…', 6]];
      let i = 0, left = steps[0][1], round = 0;
      const tick = () => {
        $('#npcSay').textContent = `${steps[i][0]} ${left}`;
        if (--left < 0) { i = (i + 1) % 3; left = steps[i][1]; if (i === 0 && ++round >= 4) { clearInterval(breathTimer); breathTimer = null; $('#npcSay').textContent = 'Đó, thấy nhẹ hơn chưa con? Lúc nào bí bách cứ thở vậy nha.'; } }
      };
      tick();
      breathTimer = setInterval(tick, 1000);
    }
  };
}

function openSupport() {
  openModal(html`<h2>☎️ Cần giúp ngay</h2>${SUPPORT_HTML}
    <p class="tag">Trà Đá Xả Stress là cộng đồng chia sẻ, không thay thế bác sĩ hay chuyên gia tâm lý. Nếu cảm xúc tiêu cực kéo dài nhiều tuần, hãy tìm đến bệnh viện hoặc phòng khám tâm lý gần nhất.</p>`, 'support');
}
function openRules() {
  openModal(html`<h2>📜 Nội quy quán trà đá</h2>
    <ol>
      <li><b>Lắng nghe, không phán xét.</b> Ai cũng có hoàn cảnh riêng.</li>
      <li><b>Tử tế.</b> Không xúc phạm, mỉa mai, công kích người khác.</li>
      <li><b>Giữ bí mật.</b> Không tiết lộ thông tin cá nhân của mình hay người khác (tên thật, số điện thoại, địa chỉ, nơi làm việc…).</li>
      <li><b>Không quảng cáo, lừa đảo, rủ rê</b> vay tiền, đầu tư, gặp mặt.</li>
      <li><b>Không nội dung nguy hiểm</b>: hướng dẫn tự hại, bạo lực, thù ghét.</li>
      <li>Thấy nội dung xấu, hãy bấm <b>🚩 Báo cáo</b>. Nội dung bị nhiều người báo cáo sẽ tự động ẩn.</li>
    </ol>
    <p class="tag">Vi phạm có thể bị khoá tài khoản. Cảm ơn bạn đã giữ quán ấm áp 💛</p>`, 'rules');
}

async function openAdmin() {
  try {
    const { reports } = await api('/admin/reports');
    openModal(html`<h2>🛡️ Báo cáo vi phạm</h2>
      ${reports.length ? reports.map((r) => html`
        <div class="admin-item">
          <b>${r.type === 'post' ? 'Tâm sự' : 'Bình luận'} #${r.id}</b> · ${r.count} báo cáo · ${r.hidden ? '🙈 đang ẩn' : '👁️ đang hiện'} ${r.exists ? '' : '(đã xoá)'}
          <div class="tag">Lý do: ${r.reasons || '—'}</div>
          ${r.content ? html`<div class="content">${r.content}</div>` : ''}
          ${r.exists ? html`<div class="actions">
            ${r.postId ? html`<button class="btn small" data-view="${r.postId}">Xem</button>` : ''}
            <button class="btn small" data-hide="${r.type}" data-id="${r.id}" data-h="${r.hidden ? 0 : 1}">${r.hidden ? 'Hiện lại' : 'Ẩn'}</button>
            <button class="btn small warm" data-ban="${r.type}" data-id="${r.id}">Khoá tác giả</button></div>` : ''}
        </div>`) : html`<div class="empty">Quán sạch sẽ, chưa có báo cáo nào 🧹</div>`}`, 'admin');
    $('#modalBody').onclick = async (e) => {
      const v = e.target.closest('[data-view]');
      const h = e.target.closest('[data-hide]');
      const b = e.target.closest('[data-ban]');
      try {
        if (v) openPost(+v.dataset.view, openAdmin);
        if (h) { await api('/admin/hide', { body: { type: h.dataset.hide, id: +h.dataset.id, hidden: h.dataset.h === '1' } }); openAdmin(); }
        if (b && confirm('Khoá tài khoản tác giả?')) { await api('/admin/ban', { body: { type: b.dataset.ban, id: +b.dataset.id } }); toast('Đã khoá.'); openAdmin(); }
      } catch (err) { toast(err.message, true); }
    };
  } catch (err) { toast(err.message, true); }
}

// ---------- Nút & chat ----------
const menu = createMenu({
  $, html, raw, api, toast, openModal, closeModal, openWrite, supportHtml: SUPPORT_HTML,
  getSocket: () => socket,
  setTimer: (t) => { if (breathTimer) clearInterval(breathTimer); breathTimer = t; },
  clearTimer: () => { if (breathTimer) { clearInterval(breathTimer); breathTimer = null; } },
});
const OPENERS = { menu: () => menu.openMenu(), write: () => openWrite(), feed: openFeed, mine: openMine, notifs: openNotifs, profile: openProfile, admin: openAdmin, support: openSupport, rules: openRules };
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (!b) return;
  e.preventDefault();
  if (!me && !['support', 'rules'].includes(b.dataset.open)) return;
  OPENERS[b.dataset.open]();
});
const social = createSocial({
  $, html, raw, api, toast, openModal, closeModal, menu,
  getGame: () => game, getSocket: () => socket, getMe: () => me,
  drawAvatar: (c, a) => drawAvatarPreview(c, a),
});
social.setupPanel();
$('.emotes').onclick = (e) => {
  const b = e.target.closest('[data-emote]');
  if (!b || !socket) return;
  if (!social.isSeated()) return social.needOrder();
  socket.emit('emote', b.dataset.emote);
};

// ---------- Khởi động ----------
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}
let gameReady = null;
function boot() {
  // Form đăng nhập/đăng ký dùng được ngay, không chờ 3D tải xong
  setupAuth();
  gameReady = (async () => {
    let GameClass = Game;
    // Mặc định 3D; thêm ?2d vào URL để dùng bản 2D nhẹ cho máy yếu
    if (hasWebGL() && !new URLSearchParams(location.search).has('2d')) {
      try {
        const [g3, a3] = await Promise.all([import('./game3d.js'), import('./avatar3d.js')]);
        GameClass = g3.Game3D;
        drawAvatarPreview = a3.drawAvatar3D;
      } catch (err) { console.warn('Không tải được 3D, dùng bản 2D', err); }
    }
    game = new GameClass($('#game'), {
      onMove: (m) => socket && socket.connected && socket.volatile.emit('move', m),
      onTable: (id) => { social.sitAt(id); openTable(id); },
      onNpc: () => openNpc(false),
      onPlayer: (sid) => social.openPlayer(sid),
      isUiOpen: isModalOpen,
    });
    window.__game = game; // tiện debug trên console
    if (regAvatar) drawAvatarPreview($('#regPreview'), regAvatar);
  })();
  api('/auth/me').then(({ user }) => (user ? enter(user, false) : showAuth())).catch(showAuth);
}
boot();
