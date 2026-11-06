// Giao tiếp trong quán: chat cả quán / theo bàn / tin riêng, menu tương tác khi bấm vào người khác,
// và luật "gọi 1 ly mới được tương tác".
import { TABLES, tableById } from './world.js';
import { DRINKS, drinkById } from './menu.js';

const CHEER_LINES = {
  dongvien: ['Cố lên bạn ơi, bạn làm được mà! 💪', 'Mình tin bạn sẽ vượt qua!', 'Từng bước nhỏ thôi, bạn đang làm tốt lắm!', 'Hôm nay vất vả rồi, bạn giỏi lắm!'],
  anui: ['Ôm bạn một cái thật chặt 🤗', 'Có mình ở đây, bạn không một mình đâu.', 'Buồn thì cứ buồn, mình ngồi cạnh bạn nè.', 'Mọi chuyện rồi sẽ ổn thôi, thương bạn.'],
};
const CHEER_ICON = { dongvien: '💪', anui: '🤗' };

/**
 * ctx: { $, html, raw, api, toast, openModal, closeModal, getGame, getSocket, getMe, menu, drawAvatar, ago }
 */
export function createSocial(ctx) {
  const { $, html, api, toast } = ctx;
  const S = {
    seated: false, tab: 'public', table: 'congviec', dmPeer: null, dmItems: [], convos: [], unread: 0,
    logs: new Map(), collapsed: matchMedia('(max-width: 720px)').matches,
  };
  const logOf = (ch) => { if (!S.logs.has(ch)) S.logs.set(ch, []); return S.logs.get(ch); };
  const currentChannel = () => (S.tab === 'public' ? 'public' : S.tab === 'table' ? `table:${S.table}` : null);
  const sock = () => ctx.getSocket();
  const time = (at) => new Date(at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // ---------- Luật gọi ly ----------
  function setSeated(v, announce = false) {
    S.seated = v;
    const input = $('#chatInput');
    input.placeholder = v ? placeholder() : '☕ Gọi 1 ly ở quầy Cô Tư để trò chuyện cùng mọi người…';
    $('#chatbar').classList.toggle('locked', !v);
    if (v && announce) toast('☕ Mời bạn ngồi! Giờ bạn có thể trò chuyện, kể chuyện, động viên và tặng nước cho mọi người.');
  }
  function needOrder(msg) {
    toast(msg || '☕ Mời bạn gọi một ly ở quầy Cô Tư trước đã nhé!', true);
    ctx.menu.openMenu();
  }
  function placeholder() {
    if (S.tab === 'public') return 'Nói với cả quán… (Enter)';
    if (S.tab === 'table') return `Nói ở ${tableById[S.table].icon} bàn ${tableById[S.table].name}…`;
    return S.dmPeer ? `Nhắn riêng cho ${S.dmPeer.nickname}…` : 'Chọn một người để nhắn riêng';
  }

  // ---------- Khung chat ----------
  function setupPanel() {
    const sel = $('#tableSel');
    sel.innerHTML = TABLES.map((t) => html`<option value="${t.id}">${t.icon} ${t.name}</option>`.s).join('');
    sel.value = S.table;
    sel.onchange = () => { joinTable(sel.value); setTab('table'); };
    $('#chatPanel').onclick = (e) => {
      const t = e.target.closest('.ctab');
      if (t) return setTab(t.dataset.ch);
      if (e.target.closest('#chatMin')) { S.collapsed = !S.collapsed; render(); return; }
      const nick = e.target.closest('[data-who]');
      if (nick) return onNickClick(Number(nick.dataset.uid), nick.dataset.sid, nick.dataset.nick);
      const conv = e.target.closest('[data-conv]');
      if (conv) return openThread({ uid: Number(conv.dataset.conv), nickname: conv.dataset.nick });
      if (e.target.closest('#dmBack')) { S.dmPeer = null; loadConvos(); }
    };
    $('#chatForm').onsubmit = (e) => { e.preventDefault(); send(); };
    $('#chatInput').onfocus = () => { if (!S.seated) { $('#chatInput').blur(); needOrder(); } };
    render();
  }
  function setTab(tab) {
    S.tab = tab;
    S.collapsed = false;
    if (tab === 'dm' && !S.dmPeer) loadConvos();
    render();
  }
  function joinTable(id) {
    if (!tableById[id]) return;
    S.table = id;
    $('#tableSel').value = id;
    const s = sock(); if (s) s.emit('chat:join', `table:${id}`);
  }
  // Ngồi vào bàn nào thì chat bàn đó
  function sitAt(id) { if (S.table !== id) joinTable(id); setTab('table'); }

  function line(m) {
    if (m.sys) return html`<div class="cm sys">${m.text}</div>`;
    const mine = ctx.getMe() && m.uid === ctx.getMe().id;
    return html`<div class="cm ${mine ? 'mine' : ''}"><b class="cm-nick" data-who data-uid="${m.uid}" data-sid="${m.sid || ''}" data-nick="${m.nickname}">${m.nickname}</b>: ${m.text} <time>${time(m.at)}</time></div>`;
  }
  function render() {
    $('#chatPanel').classList.toggle('collapsed', S.collapsed);
    for (const b of document.querySelectorAll('.ctab')) b.classList.toggle('active', b.dataset.ch === S.tab);
    $('#dmBadge').textContent = S.unread;
    $('#dmBadge').classList.toggle('hidden', !S.unread);
    $('#chatMin').textContent = S.collapsed ? '▴' : '▾';
    if (S.seated) $('#chatInput').placeholder = placeholder();
    const box = $('#chatLog');
    if (S.tab === 'dm') {
      if (S.dmPeer) {
        box.innerHTML = html`<div class="dm-head"><button class="linkish" id="dmBack">←</button> ✉️ <b>${S.dmPeer.nickname}</b></div>
          ${S.dmItems.length ? S.dmItems.map((m) => html`<div class="cm ${m.mine ? 'mine' : ''}">${m.mine ? 'Bạn' : S.dmPeer.nickname}: ${m.text} <time>${time(m.at)}</time></div>`) : html`<div class="cm sys">Chưa có tin nhắn. Gửi lời chào đầu tiên nhé 👋</div>`}`.s;
      } else {
        box.innerHTML = S.convos.length
          ? S.convos.map((c) => html`<button class="conv" data-conv="${c.uid}" data-nick="${c.nickname}"><b>${c.nickname}</b>${c.unread ? html` <span class="badge">${c.unread}</span>` : ''}<span>${c.last.mine ? 'Bạn: ' : ''}${c.last.text}</span></button>`.s).join('')
          : html`<div class="cm sys">Chưa có tin riêng. Bấm vào một người trong quán → ✉️ Nhắn riêng.</div>`.s;
      }
    } else {
      const items = logOf(currentChannel());
      box.innerHTML = items.length ? items.map((m) => line(m).s).join('') : html`<div class="cm sys">${S.tab === 'public' ? 'Quán đang yên ắng. Chào mọi người một câu nhé ☕' : `Bàn ${tableById[S.table].name} chưa ai lên tiếng.`}</div>`.s;
    }
    box.scrollTop = box.scrollHeight;
  }
  function push(ch, item) {
    const l = logOf(ch); l.push(item); if (l.length > 100) l.shift();
    if (currentChannel() === ch && S.tab !== 'dm') render();
    else if (!item.sys) markTab(ch === 'public' ? 'public' : 'table');
  }
  function markTab(tab) { const b = document.querySelector(`.ctab[data-ch="${tab}"]`); if (b) b.classList.add('ping'); setTimeout(() => b && b.classList.remove('ping'), 3000); }

  function send() {
    const input = $('#chatInput');
    const text = input.value.trim();
    if (!text) return;
    if (!S.seated) return needOrder();
    const s = sock(); if (!s) return;
    if (S.tab === 'dm') {
      if (!S.dmPeer) return toast('Chọn một người để nhắn riêng nhé.');
      s.emit('dm', { to: S.dmPeer.uid, text }, (r) => {
        if (r && r.needOrder) return needOrder(r.error);
        if (!r || !r.ok) return toast((r && r.error) || 'Không gửi được.', true);
        S.dmItems.push({ mine: true, text: r.item.text, at: r.item.at }); render();
      });
    } else {
      s.emit('chat', { channel: currentChannel(), text }, (r) => {
        if (r && r.needOrder) return needOrder(r.error);
        if (r && !r.ok) toast(r.error, true);
      });
    }
    input.value = '';
  }

  async function loadConvos() {
    try { const r = await api('/dms'); S.convos = r.items; S.unread = r.unread; render(); } catch { /* bỏ qua */ }
  }
  async function openThread(peer) {
    S.tab = 'dm'; S.collapsed = false; S.dmPeer = peer; S.dmItems = [];
    render();
    try {
      const r = await api(`/dms/${peer.uid}`);
      S.dmPeer = r.peer; S.dmItems = r.items;
      const c = S.convos.find((x) => x.uid === peer.uid); if (c) { S.unread = Math.max(0, S.unread - c.unread); c.unread = 0; }
      render();
      $('#chatInput').focus();
    } catch (err) { toast(err.message, true); }
  }
  function onNickClick(uid, sid, nickname) {
    const g = ctx.getGame();
    const online = sid && g.players.get(sid) ? sid : [...g.players.values()].find((p) => p.uid === uid)?.sid;
    if (online) return openPlayer(online);
    if (ctx.getMe() && uid !== ctx.getMe().id) openThread({ uid, nickname });
  }

  // ---------- Bấm vào người trong quán ----------
  function openPlayer(sid) {
    const p = ctx.getGame().players.get(sid);
    const me = ctx.getMe();
    if (!p || !me || p.uid === me.id) return;
    ctx.openModal(html`
      <div class="pl-card">
        <canvas id="plAv" width="96" height="120"></canvas>
        <div>
          <h2>${p.nickname}</h2>
          <p class="tag">${p.seated ? '☕ Đang ngồi trong quán' : '👀 Đang xem thực đơn, chưa gọi ly'}</p>
        </div>
      </div>
      <div class="pl-actions">
        <button class="btn" data-act="dm">✉️ Nhắn riêng</button>
        <button class="btn warm" data-act="dongvien">💪 Động viên</button>
        <button class="btn warm" data-act="anui">🤗 An ủi</button>
        <button class="btn green" data-act="gift">🎁 Tặng nước</button>
        <button class="btn" data-act="wave">👋 Vẫy chào</button>
        <button class="btn" data-act="block">🚫 Chặn</button>
      </div>
      <div id="plPanel"></div>`, 'player');
    ctx.drawAvatar($('#plAv'), p.avatar);
    $('.pl-actions').onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'dm') { ctx.closeModal(); return openThread({ uid: p.uid, nickname: p.nickname }); }
      if (act === 'block') return blockUser(p);
      if (!S.seated) return needOrder();
      if (act === 'wave') { sock().emit('emote', 'wave'); toast(`Bạn vẫy chào ${p.nickname} 👋`); return; }
      if (act === 'gift') return giftPanel(p);
      cheerPanel(p, act);
    };
  }

  function cheerPanel(p, kind) {
    const panel = $('#plPanel');
    panel.innerHTML = html`
      <div class="cheer-box">
        <b>${CHEER_ICON[kind]} ${kind === 'dongvien' ? 'Động viên' : 'An ủi'} ${p.nickname}</b>
        <div class="suggest">${CHEER_LINES[kind].map((l) => html`<button type="button" data-line="${l}">${l}</button>`)}</div>
        <form id="cheerForm" class="row"><input name="t" maxlength="140" placeholder="Hoặc tự viết lời của bạn…"><button class="btn warm" type="submit">Gửi</button></form>
      </div>`.s;
    const go = (text) => sock().emit('cheer', { sid: p.sid, kind, text }, (r) => {
      if (r && r.needOrder) return needOrder(r.error);
      if (!r || !r.ok) return toast((r && r.error) || 'Không gửi được.', true);
      toast(`Đã gửi lời ${kind === 'dongvien' ? 'động viên' : 'an ủi'} tới ${p.nickname} 💛`);
      ctx.closeModal();
    });
    panel.querySelector('.suggest').onclick = (e) => { const b = e.target.closest('[data-line]'); if (b) go(b.dataset.line); };
    $('#cheerForm').onsubmit = (e) => { e.preventDefault(); const t = e.target.t.value.trim(); if (t) go(t); };
  }

  async function giftPanel(p) {
    const panel = $('#plPanel');
    const w = await api('/wallet');
    const avail = DRINKS.filter((d) => w.tray[d.id] > 0);
    if (!avail.length) {
      panel.innerHTML = html`<div class="no-cups">Bạn chưa có ly nào để tặng. <button class="btn small warm" id="toMenu">🧋 Gọi 1 ly (được tặng kèm 1 ly)</button></div>`.s;
      $('#toMenu').onclick = () => ctx.menu.openMenu();
      return;
    }
    panel.innerHTML = html`
      <form id="pGift" class="treat-form">
        <b>🎁 Tặng ${p.nickname}</b>
        <div class="drink-pick">${avail.map((d, i) => html`<label title="${d.name}: ${w.tray[d.id]} ly"><input type="radio" name="drink" value="${d.id}" ${i === 0 ? ctx.raw('checked') : ''}><span>${d.icon}<i>${w.tray[d.id]}</i></span></label>`)}</div>
        <div class="qty-pick">Tặng <input type="number" name="qty" min="1" value="1"> ly · <button type="button" class="btn small" data-q="all">Tất cả</button></div>
        <input name="message" maxlength="200" placeholder="Lời nhắn (tuỳ chọn) – tử tế thôi nha 💛">
        <p class="pay-note" data-note></p>
        <p class="err" data-err></p>
        <button class="btn warm" type="submit">🎁 Tặng</button>
      </form>`.s;
    const f = $('#pGift');
    const max = () => w.tray[f.drink.value] || 0;
    const note = () => {
      if (Number(f.qty.value) > max()) f.qty.value = max();
      if (Number(f.qty.value) < 1) f.qty.value = 1;
      f.qty.max = max();
      f.querySelector('[data-note]').textContent = `Bạn có ${max()} ly ${drinkById[f.drink.value].name.toLowerCase()} để tặng → còn lại ${max() - Number(f.qty.value)} ly.`;
    };
    f.oninput = note; f.onchange = note; note();
    f.onclick = (e) => { if (e.target.closest('[data-q]')) { f.qty.value = max(); note(); } };
    f.onsubmit = (e) => {
      e.preventDefault();
      const err = f.querySelector('[data-err]'); err.textContent = '';
      const drink = f.drink.value, qty = Number(f.qty.value);
      sock().emit('gift', { sid: p.sid, drink, qty, message: f.message.value }, (r) => {
        if (r && r.needOrder) return needOrder(r.error);
        if (!r || !r.ok) { err.textContent = `${(r && r.error) || 'Không gửi được.'} ${(r && r.reason) || ''}`; return; }
        panel.innerHTML = html`<div class="treat-done">
          <div class="td-head">🎉 Đã tặng ${p.nickname} ${qty} ly ${drinkById[drink].name.toLowerCase()} ${drinkById[drink].icon}</div>
          <div class="reply-bubble"><b>${p.nickname}:</b> “${r.reply}”</div>
          <small class="tag">Bạn còn ${r.left} ly ${drinkById[drink].name.toLowerCase()} để tặng. Lời đáp vui do quán tự tạo theo số ly người ấy đã nhận.</small>
        </div>`.s;
      });
    };
  }

  async function blockUser(p) {
    if (!confirm(`Chặn ${p.nickname}? Người này sẽ không nhắn riêng, động viên hay tặng nước cho bạn được nữa.`)) return;
    try { await api('/blocks', { body: { uid: p.uid } }); toast(`Đã chặn ${p.nickname}. Bỏ chặn trong ✉️ Riêng → mở cuộc trò chuyện.`); ctx.closeModal(); }
    catch (err) { toast(err.message, true); }
  }

  // ---------- Sự kiện socket ----------
  function bindSocket(s) {
    const g = () => ctx.getGame();
    s.on('world:init', (w) => {
      setSeated(!!w.seated);
      // Chưa gọi ly trong lượt vào quán này -> mở thực đơn (nếu không có hộp thoại khác đang mở)
      if (!w.seated) setTimeout(() => { if (document.querySelector('#modal').classList.contains('hidden')) ctx.menu.openMenu(); }, 900);
      joinTable(S.table);
      loadConvos();
    });
    s.on('seated', () => setSeated(true, true));
    s.on('need-order', (m) => needOrder(m));
    s.on('chat:history', ({ channel, items }) => { S.logs.set(channel, items.slice()); if (currentChannel() === channel) render(); });
    s.on('chat', (m) => {
      push(m.channel, m);
      if (m.channel === 'public' || m.channel === `table:${S.table}`) g().say(m.sid, m.channel === 'public' ? m.text : `${tableById[S.table].icon} ${m.text}`);
    });
    s.on('dm', (m) => {
      const me = ctx.getMe();
      const peer = m.from.uid === me.id ? m.to : m.from;
      const mine = m.from.uid === me.id;
      if (S.tab === 'dm' && S.dmPeer && S.dmPeer.uid === peer.uid) { S.dmItems.push({ mine, text: m.text, at: m.at }); render(); return; }
      if (!mine) { S.unread += 1; toast(`✉️ ${m.from.nickname} nhắn riêng: “${m.text.slice(0, 60)}”`); }
      loadConvos();
    });
    s.on('cheer', (c) => {
      g().emote(c.from.sid, c.emote);
      g().say(c.from.sid, `${CHEER_ICON[c.kind]} ${c.to.nickname}: ${c.text}`);
      push('public', { sys: true, text: `${CHEER_ICON[c.kind]} ${c.from.nickname} ${c.kind === 'dongvien' ? 'động viên' : 'an ủi'} ${c.to.nickname}: “${c.text}”` });
      if (g().myId === c.to.sid) {
        toast(`${CHEER_ICON[c.kind]} ${c.from.nickname} ${c.kind === 'dongvien' ? 'động viên' : 'an ủi'} bạn: “${c.text}”`);
        setTimeout(() => g().emote(c.to.sid, 'heart'), 900);
      }
    });
    s.on('gift', (x) => {
      const d = drinkById[x.drink];
      g().emote(x.from.sid, 'tea');
      g().say(x.from.sid, `🎁 Mời ${x.to.nickname} ${x.qty} ly ${d.name.toLowerCase()} ${d.icon}`);
      if (g().holdDrink) setTimeout(() => g().holdDrink(x.to.sid, x.drink), 800);
      push('public', { sys: true, text: `🎁 ${x.from.nickname} tặng ${x.to.nickname} ${x.qty} ly ${d.name.toLowerCase()} ${d.icon}` });
    });
  }

  return { setupPanel, bindSocket, openPlayer, openThread, sitAt, setSeated, needOrder, isSeated: () => S.seated };
}
