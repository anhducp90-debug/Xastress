// Menu nước quán Cô Tư – mỗi món là một cách giải toả stress.
// Những gì người dùng viết trong các hoạt động ở đây KHÔNG gửi lên máy chủ
// (trừ khi họ chủ động bấm "Đăng lên bàn"); ghi chú riêng chỉ lưu trên máy của họ.

export const DRINKS = [
  { id: 'trada', icon: '🧊', name: 'Trà đá vỉa hè', price: '3k', color: '#c8862a', tag: 'Xả hết ra cho nhẹ',
    desc: 'Viết hết bực dọc ra giấy, rồi chọn đổ đi hoặc đặt lên bàn cho mọi người cùng nghe.' },
  { id: 'tragung', icon: '🫚', name: 'Trà gừng ấm', price: '10k', color: '#d9a13c', tag: 'Thở chậm, tim chậm',
    desc: 'Một phút thở theo nhịp cùng Cô Tư. Hít vào 4 – giữ 4 – thở ra 6.' },
  { id: 'nuocsau', icon: '🍈', name: 'Nước sấu đá', price: '12k', color: '#c9d97a', tag: 'Chua mà tỉnh',
    desc: 'Khi đầu óc rối như tơ vò: kéo mình về hiện tại bằng 5 giác quan.' },
  { id: 'caphe', icon: '☕', name: 'Cà phê đen đá', price: '15k', color: '#3b2416', tag: 'Gỡ rối từng việc',
    desc: 'Việc chồng chất? Viết ra mối lo, chia thành 3 việc nhỏ làm được ngay hôm nay.' },
  { id: 'daunanh', icon: '🥛', name: 'Sữa đậu nành nóng', price: '8k', color: '#efe3c2', tag: 'Thương mình một chút',
    desc: 'Nghe một lời dịu dàng và bỏ vào "lọ điều tốt" một việc bạn đã làm được.' },
  { id: 'nuocdua', icon: '🥥', name: 'Nước dừa tươi', price: '20k', color: '#e9f2e3', tag: 'Nghỉ 2 phút',
    desc: 'Hai phút thả lỏng cơ thể từ đầu đến chân. Không làm gì cả cũng được.' },
  { id: 'trachanh', icon: '🍋', name: 'Trà chanh chém gió', price: '10k', color: '#e6d65a', tag: 'Cười một cái',
    desc: 'Vài câu chuyện phiếm vỉa hè cho khoé miệng nhếch lên một chút.' },
  { id: 'nuocmia', icon: '🎋', name: 'Nước mía mời bạn', price: 'Mời', color: '#d8e6a0', tag: 'Ngọt cho người khác',
    desc: 'Mời một ly nước cho người đang buồn trong quán. Tử tế với người khác cũng làm mình nhẹ lòng.' },
];
export const drinkById = Object.fromEntries(DRINKS.map((d) => [d.id, d]));

const MOOD_PICK = {
  tuc: { label: 'Bực mình 😤', drinks: ['trada', 'nuocsau'] },
  lo: { label: 'Lo âu 😟', drinks: ['tragung', 'nuocsau'] },
  met: { label: 'Mệt rã rời 😮‍💨', drinks: ['nuocdua', 'daunanh'] },
  buon: { label: 'Buồn 😢', drinks: ['daunanh', 'trachanh'] },
  ap_luc: { label: 'Ngập việc 🥵', drinks: ['caphe', 'tragung'] },
  chan: { label: 'Chán chường 😞', drinks: ['trachanh', 'nuocmia'] },
};

const COMFORT = [
  'Con không cần phải giỏi mọi thứ. Hôm nay con vẫn đứng dậy được, vậy là đủ rồi.',
  'Mệt thì nghỉ, không ai chấm điểm con lúc con nghỉ đâu.',
  'Người ta hay nói "cố lên", cô thì nói: "chậm lại cũng được".',
  'Con đối xử với bạn bè dịu dàng thế nào, thì đối xử với mình y như vậy nhé.',
  'Cảm xúc nào cũng như cơn mưa rào mùa hạ: ào tới rồi cũng tạnh.',
  'Con đã vượt qua 100% những ngày tồi tệ trước đây. Hôm nay cũng vậy thôi.',
];
const JOKES = [
  'Sếp bảo "việc này dễ, làm 5 phút là xong". Cô bán trà 30 năm, chưa thấy "5 phút" nào của sếp dưới 3 tiếng.',
  'Lương về như người yêu cũ: đến rất vội, đi chẳng để lại gì.',
  'Ông hàng xóm bảo tập thể dục cho đỡ stress. Ổng đi bộ ra quán trà đá, ngồi đến tối. Vẫn tính là đi bộ.',
  'Deadline giống xe buýt: cứ tưởng còn lâu, ngẩng lên đã thấy nó đi qua.',
  'Người ta "chill" ở Đà Lạt, mình "chill" ở ghế nhựa xanh. Gió vẫn mát, mà trà rẻ hơn.',
  'Kế hoạch đầu tuần: dậy sớm, tập thể dục, ăn sạch. Thực tế thứ Hai: dậy kịp là may.',
  'Group chat công ty im lặng cả ngày, đúng 10 giờ tối thì rôm rả như chợ Tết.',
  'Bác xe ôm bảo: "Đường tắc thì cứ thong thả, đằng nào cũng tới". Áp dụng cho cả cuộc đời luôn.',
  'Tiền điện tháng này cao quá, chắc tại nhà mình "nóng" chuyện nhiều.',
  'Mẹ hỏi "bao giờ lấy vợ/chồng?". Con hỏi lại "bao giờ mẹ cho con ngủ nướng?". Cả hai cùng im.',
];
const BODY_STEPS = [
  'Ngồi thoải mái. Thả hai vai xuống, xa khỏi tai.',
  'Thả lỏng trán, hai hàng lông mày, cả quai hàm. Răng không cần cắn chặt.',
  'Để hai tay nặng xuống đùi. Các ngón tay mềm ra.',
  'Thở ra thật dài, để bụng xẹp xuống tự nhiên.',
  'Cảm nhận lưng đang tựa vào ghế, hai bàn chân chạm đất.',
  'Không cần nghĩ gì. Nếu có suy nghĩ chạy qua, cứ để nó đi như xe máy ngoài đường.',
];
const GROUND = [
  ['👀', 'Nhìn quanh và gọi tên 5 thứ bạn đang thấy.'],
  ['✋', 'Chạm vào 4 thứ quanh bạn: mặt bàn, vải áo, ly nước…'],
  ['👂', 'Lắng nghe 3 âm thanh: tiếng xe, tiếng quạt, tiếng thở của mình.'],
  ['👃', 'Tìm 2 mùi hương, hoặc nhớ lại 2 mùi bạn thích.'],
  ['👅', 'Nhận ra 1 vị trong miệng, hoặc nhấp một ngụm nước.'],
];

const store = {
  get(k, d) { try { const v = localStorage.getItem(`xs:${k}`); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`xs:${k}`, JSON.stringify(v)); } catch { /* chế độ riêng tư */ } },
};

/**
 * ctx: { $, html, raw, api, toast, openModal, closeModal, getSocket, openWrite, setTimer, clearTimer, onGift }
 */
export function createMenu(ctx) {
  const { $, html, raw, api, toast, openModal } = ctx;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  let aiStatus = null;
  const getStatus = async () => {
    if (!aiStatus) { try { aiStatus = await api('/ai/status'); } catch { aiStatus = { enabled: false, prices: {} }; } }
    return aiStatus;
  };

  // ---------- Ví: miễn phí / phiếu / xu / khay ----------
  const trayChips = (tray) => Object.entries(tray || {}).filter(([, n]) => n > 0)
    .map(([k, n]) => html`<span class="tchip">${drinkById[k] ? drinkById[k].icon : '🍵'}×${n}</span>`);
  function walletBar(w) {
    const e = w.economy;
    const hasTray = Object.values(w.tray).some((n) => n > 0);
    return html`<div class="wallet-box">
      ${e.paywall
        ? html`<div class="wallet"><span>👛 <b id="xuNow">${w.xu}</b> xu</span>
            <span>🎟️ Phiếu gọi ly miễn phí: ${w.vouchers.self}</span>
            ${w.telegram.enabled ? html`<button type="button" class="btn small green" data-buyxu>🪙 Mua xu qua Telegram</button>` : ''}</div>`
        : html`<div class="wallet free"><span>🎉 Quán đang <b>miễn phí</b> · gọi 1 ly được <b>tặng kèm 1 ly</b> để mời người khác</span>
            <span class="tag">${e.participants}/${e.threshold} khách · đủ ${e.threshold} khách mới bắt đầu tính phí</span></div>`}
      ${hasTray ? html`<div class="tray">🎁 Ly để tặng: ${trayChips(w.tray)}</div>` : ''}
      ${w.glasses.length ? html`<div class="tray">🥤 Ly của bạn (uống miễn phí): ${w.glasses.map((k) => html`<span class="tchip">${drinkById[k] ? drinkById[k].icon : '🍵'}</span>`)}</div>` : ''}
    </div>`;
  }
  // Mở bot Telegram để mua xu (mã liên kết dùng một lần)
  async function buyXu(btn) {
    btn.disabled = true;
    try {
      const r = await api('/telegram/link', { body: {} });
      const a = document.createElement('a');
      a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.className = 'btn small green';
      a.textContent = '➡️ Mở bot Telegram để mua xu';
      btn.replaceWith(a);
      window.open(r.url, '_blank', 'noopener');
      toast('Mở bot Telegram, chọn gói xu và thanh toán bằng ⭐ Stars. Xu sẽ tự vào ví 👛');
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-buyxu]'); if (b) { e.preventDefault(); buyXu(b); } });
  const needXuHtml = (w, need) => html`<div class="need-xu">Cần ${need} xu, ví đang có ${w.xu} xu.
    ${w.telegram && w.telegram.enabled ? html`<button type="button" class="btn small green" data-buyxu>🪙 Mua xu qua Telegram</button>` : html`<span class="tag">Quán chưa mở bán xu.</span>`}</div>`;
  const quote = (drink) => api(`/wallet/quote?drink=${drink}`);

  async function openMenu(mood) {
    const rec = mood && MOOD_PICK[mood] ? MOOD_PICK[mood].drinks : [];
    const [st, w, pk] = await Promise.all([getStatus(), api('/wallet').catch(() => null), api('/ai/packs').catch(() => ({ packs: [] }))]);
    const active = new Set(pk.packs.map((p) => p.drink));
    const priceOf = (d) => {
      if (!w) return '';
      if (!w.economy.paywall) return 'Miễn phí · +1 ly tặng';
      if (w.glasses.includes(d.id)) return 'Ly của bạn 🥤';
      return `${st.prices[d.id]} xu · +1 ly tặng`;
    };
    openModal(html`
      <div class="menu-board">
        <h2 class="chalk-title">🍵 Thực đơn quán Cô Tư</h2>
        ${w ? walletBar(w) : ''}
        <p class="chalk-sub">${st.enabled
          ? `Mỗi ly là một gói tâm sự với Cô Tư AI (${st.turns} lượt, dùng trong ${st.hours} giờ) kèm bài tập giải toả. Hôm nay bạn thấy thế nào?`
          : 'Mỗi ly là một cách giải toả stress. Hôm nay bạn thấy thế nào?'}</p>
        <div class="mood-chips">${Object.entries(MOOD_PICK).map(([k, m]) => html`<button type="button" class="chip-btn ${k === mood ? 'on' : ''}" data-mood="${k}">${m.label}</button>`)}</div>
        <div class="menu-grid">${DRINKS.map((d) => html`
          <button type="button" class="menu-item ${rec.includes(d.id) ? 'rec' : ''}" data-drink="${d.id}">
            ${rec.includes(d.id) ? html`<span class="rec-badge">Cô gợi ý</span>` : active.has(d.id) ? html`<span class="rec-badge own">Đang uống</span>` : ''}
            <span class="mi-icon">${d.icon}</span>
            <span class="mi-name">${d.name}</span>
            <span class="mi-price">${priceOf(d)}</span>
            <span class="mi-tag">${d.tag}</span>
            ${w && w.tray[d.id] ? html`<span class="mi-tray">🎁 ${w.tray[d.id]} ly để tặng</span>` : ''}
          </button>`)}</div>
        <p class="chalk-foot">Gọi 1 ly: uống 1 ly + được tặng kèm 1 ly để mời người khác. Được tặng nhiều ly: 1 ly là của bạn, còn lại để tặng tiếp 🔁 · Bài tập nhanh luôn miễn phí.</p>
      </div>`, 'menu');
    $('#modalBody').onclick = (e) => {
      const m = e.target.closest('[data-mood]');
      if (m) return openMenu(m.dataset.mood === mood ? null : m.dataset.mood);
      const d = e.target.closest('[data-drink]');
      if (d) order(d.dataset.drink);
    };
  }

  async function order(id, emit = true, tab) {
    const d = drinkById[id];
    const st = await getStatus();
    const current = tab || (st.enabled ? 'ai' : 'quick');
    openModal(html`
      <button class="linkish" id="backMenu">← Xem lại thực đơn</button>
      <div class="served"><span class="served-icon">${d.icon}</span><div><h2>${d.name}</h2><p class="tag">${d.desc}</p></div></div>
      <div id="orderBar" class="order-bar"></div>
      <div class="tabs served-tabs">
        <button class="tab ${current === 'ai' ? 'active' : ''}" data-tab="ai">💬 Tâm sự với Cô Tư AI</button>
        <button class="tab ${current === 'quick' ? 'active' : ''}" data-tab="quick">🧘 Bài tập nhanh</button>
        <button class="tab ${current === 'gift' ? 'active' : ''}" data-tab="gift">🎁 Mời người khác</button>
      </div>
      <div id="activity"></div>`, 'menu');
    $('#backMenu').onclick = () => openMenu();
    for (const t of document.querySelectorAll('.served-tabs .tab')) t.onclick = () => order(id, false, t.dataset.tab);
    renderOrderBar(id, st, current);
    if (current === 'ai') aiPanel(id, st);
    else if (current === 'gift') giftPanel(id);
    else { const run = ACTIVITIES[id]; $('#activity').innerHTML = run.view().s; run.bind(); }
  }

  // Gọi 1 ly = uống 1 ly (mở gói Cô Tư AI) + tặng kèm 1 ly vào khay
  async function renderOrderBar(id, st, current) {
    const bar = $('#orderBar');
    const [w, pk, qt] = await Promise.all([api('/wallet'), api('/ai/packs'), quote(id)]);
    if (!bar.isConnected) return;
    const pack = st.enabled && pk.packs.find((p) => p.drink === id);
    const tray = w.tray[id] || 0;
    bar.innerHTML = html`
      ${pack ? html`<span class="ob-status">☕ Đang uống – còn ${pack.turnsLeft} lượt tâm sự</span>` : ''}
      <button class="btn warm" id="doOrder" ${qt.enough ? '' : raw('disabled')}>🧋 ${pack ? 'Gọi thêm' : 'Gọi'} 1 ly – ${qt.text}${qt.bonus ? ' · tặng kèm 1 ly 🎁' : ''}</button>
      ${qt.enough ? '' : needXuHtml(w, qt.xu)}
      <span class="ob-tray">🎁 Ly ${drinkById[id].name.toLowerCase()} để tặng: <b>${tray}</b></span>`.s;
    const b = $('#doOrder');
    if (b) b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await api('/order', { body: { drink: id } });
        const s = ctx.getSocket(); if (s) s.emit('order', id);
        toast(`Cô Tư mang ra 1 ly ${drinkById[id].name.toLowerCase()}${r.plan && r.plan.bonus ? ` + 1 ly tặng kèm (giờ bạn có ${r.plan.tray} ly để tặng)` : ''} ☕`);
        order(id, false, current);
      } catch (err) { toast(err.message, true); b.disabled = false; }
    };
  }

  // ---------- Cô Tư AI ----------
  async function aiPanel(drink, st) {
    const box = $('#activity');
    if (!st.enabled) {
      box.innerHTML = html`<div class="done-box">🌙 Cô Tư AI đang nghỉ (quán chưa bật AI). Bạn dùng <b>Bài tập nhanh</b> hoặc kể chuyện ở các bàn nhé.</div>`.s;
      return;
    }
    const pk = await api('/ai/packs');
    const pack = pk.packs.find((p) => p.drink === drink);
    if (!pack) {
      box.innerHTML = html`<div class="ai-buy"><p>👆 Gọi 1 ly ở trên để mở <b>${st.turns} lượt tâm sự</b> với Cô Tư AI (dùng trong ${st.hours} giờ).</p>${PRIVACY}</div>`.s;
      return;
    }
    aiChat(pack);
  }

  const PRIVACY = html`<p class="fine ai-fine">🤖 Cô Tư AI là trợ lý ảo, không thay thế bác sĩ hay chuyên gia tâm lý. Tin nhắn được gửi tới dịch vụ AI (Anthropic Claude) để trả lời và tự xoá sau khi gói hết hạn 7 ngày; bạn có thể xoá ngay bất cứ lúc nào. Đừng kể tên thật, số điện thoại, địa chỉ.</p>`;

  async function aiChat(pack) {
    const box = $('#activity');
    const { messages } = await api(`/ai/packs/${pack.id}`);
    const until = new Date(pack.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    box.innerHTML = html`
      <div class="ai-chat">
        <div class="ai-head"><span>Còn <b id="turns">${pack.turnsLeft}</b> lượt · dùng tới ${until}</span><button class="linkish" id="aiClear">🗑️ Xoá cuộc trò chuyện</button></div>
        <div class="ai-log" id="aiLog">
          <div class="ai-msg bot">Ly ${drinkById[pack.drink].name.toLowerCase()} của con đây ${drinkById[pack.drink].icon}. Ngồi xuống đi, có chuyện gì cứ kể cô nghe.</div>
          ${messages.map((m) => html`<div class="ai-msg ${m.role === 'user' ? 'me' : 'bot'}">${m.content}</div>`)}
        </div>
        <form id="aiForm" class="ai-form">
          <textarea name="m" maxlength="1000" rows="2" placeholder="Kể với Cô Tư… (Enter để gửi, Shift+Enter xuống dòng)" autofocus></textarea>
          <button class="btn warm" type="submit">Gửi</button>
        </form>
        ${PRIVACY}
      </div>`.s;
    const log = $('#aiLog');
    log.scrollTop = log.scrollHeight;
    const form = $('#aiForm');
    form.m.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
    $('#aiClear').onclick = async () => {
      if (!confirm('Xoá toàn bộ cuộc trò chuyện và gói này? Lượt còn lại sẽ mất.')) return;
      await api(`/ai/packs/${pack.id}`, { method: 'DELETE' });
      toast('Đã xoá sạch. Không còn dấu vết nào 🧹');
      openMenu();
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = form.m.value.trim();
      if (!text) return;
      form.m.value = '';
      const btn = form.querySelector('button'); btn.disabled = true;
      const add = (cls, t) => { const d = document.createElement('div'); d.className = `ai-msg ${cls}`; d.textContent = t; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
      add('me', text);
      const bot = add('bot typing', 'Cô Tư đang nghĩ…');
      let got = '';
      try {
        const res = await fetch(`/api/ai/packs/${pack.id}/chat`, {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'xastress' },
          body: JSON.stringify({ message: text }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          bot.remove(); toast(d.error || 'Có lỗi, thử lại nhé.', true);
          if (d.expired) aiPanel(pack.drink, await getStatus());
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
            const ev = (chunk.match(/^event: (.*)$/m) || [])[1];
            const raw2 = (chunk.match(/^data: (.*)$/m) || [])[1];
            const data = raw2 ? JSON.parse(raw2) : null;
            if (ev === 'delta') { if (!got) bot.classList.remove('typing'); got += data; bot.textContent = got; log.scrollTop = log.scrollHeight; }
            else if (ev === 'crisis') { const s2 = document.createElement('div'); s2.innerHTML = ctx.supportHtml.s; log.appendChild(s2); }
            else if (ev === 'done') $('#turns').textContent = data.turnsLeft;
            else if (ev === 'error') { bot.classList.remove('typing'); bot.classList.add('err'); bot.textContent = data; }
          }
        }
      } catch {
        bot.classList.remove('typing'); bot.textContent = 'Mất kết nối rồi, con thử gửi lại nha.';
      } finally { btn.disabled = false; form.m.focus(); }
    };
  }

  // ---------- Mời nước kèm lời nhắn ----------
  // tray: số ly để tặng theo món (từ /wallet)
  function treatForm(drinkId, postId, onDone, tray, pickDrink = false) {
    const id = `tf${postId}`;
    const avail = DRINKS.filter((d) => tray[d.id] > 0);
    const first = pickDrink ? (tray[drinkId] ? drinkId : (avail[0] && avail[0].id)) : drinkId;
    if (!first || !tray[first]) {
      return {
        html: html`<div class="no-cups">Bạn chưa có ly ${pickDrink ? '' : drinkById[drinkId].name.toLowerCase() + ' '}nào để tặng.
          <button type="button" class="btn small warm" data-go-menu>🧋 Gọi 1 ly (được tặng kèm 1 ly)</button></div>`,
        bind: () => { const g = document.querySelector('[data-go-menu]'); if (g) g.onclick = () => (pickDrink ? openMenu() : order(drinkId, false, 'gift')); },
      };
    }
    return {
      html: html`
        <form class="treat-form" id="${id}">
          ${pickDrink ? html`<div class="drink-pick">${avail.map((d) => html`<label title="${d.name}: ${tray[d.id]} ly"><input type="radio" name="drink" value="${d.id}" ${d.id === first ? raw('checked') : ''}><span>${d.icon}<i>${tray[d.id]}</i></span></label>`)}</div>` : ''}
          <div class="qty-pick">Tặng
            <input type="number" name="qty" min="1" max="${tray[first]}" value="1" inputmode="numeric">
            ly · <button type="button" class="btn small" data-q="3">3</button><button type="button" class="btn small" data-q="10">10</button><button type="button" class="btn small" data-q="all">Tất cả</button>
          </div>
          <input name="message" maxlength="200" placeholder="Lời nhắn kèm ly nước (tuỳ chọn) – tử tế thôi nha 💛">
          <div class="suggest">${KIND_LINES.map((l) => html`<button type="button" data-s="${l}">${l}</button>`)}</div>
          <p class="pay-note" data-pay></p>
          <p class="err" data-err></p>
          <button class="btn warm" type="submit">🎁 Tặng</button>
        </form>`,
      bind: () => {
        const f = document.getElementById(id);
        const cur = () => (pickDrink ? f.drink.value : drinkId);
        const note = f.querySelector('[data-pay]');
        const refresh = () => {
          const max = tray[cur()] || 0;
          f.qty.max = max;
          if (Number(f.qty.value) > max) f.qty.value = max;
          if (Number(f.qty.value) < 1) f.qty.value = 1;
          note.textContent = `Khay còn ${max} ly ${drinkById[cur()].name.toLowerCase()} để tặng → tặng ${f.qty.value} ly, còn lại ${max - Number(f.qty.value)} ly.`;
        };
        f.onclick = (e) => {
          const sg = e.target.closest('[data-s]'); if (sg) f.message.value = sg.dataset.s;
          const qb = e.target.closest('[data-q]');
          if (qb) { f.qty.value = qb.dataset.q === 'all' ? tray[cur()] : qb.dataset.q; refresh(); }
        };
        f.oninput = refresh;
        f.onchange = refresh;
        refresh();
        f.onsubmit = async (e) => {
          e.preventDefault();
          const err = f.querySelector('[data-err]'); err.textContent = '';
          const drink = cur(), qty = Number(f.qty.value);
          const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
          try {
            const r = await api(`/posts/${postId}/treat`, { body: { drink, qty, message: f.message.value } });
            tray[drink] = r.left;
            const s = ctx.getSocket(); if (s) s.emit('emote', 'heart');
            onDone(r, drink, qty);
          } catch (ex) {
            err.textContent = ex.data && ex.data.blocked
              ? `🙅 ${ex.message} ${ex.data.reason || ''} Thử một câu gợi ý bên dưới nhé 👇`
              : ex.message;
            if (ex.data && ex.data.noCups) { tray[drink] = ex.data.have; refresh(); }
            btn.disabled = false;
          }
        };
      },
    };
  }
  function treatResult(r, drink, qty) {
    const d = drinkById[drink];
    return html`<div class="treat-done">
      <div class="td-head">🎉 Đã mời ${qty} ly ${d.name.toLowerCase()} ${d.icon}</div>
      <small class="tag">Khay của bạn còn ${r.left} ly ${d.name.toLowerCase()} để tặng. Người nhận có 1 ly để uống, phần còn lại họ tặng tiếp được 🔁</small>
      <div class="reply-bubble"><b>Người được mời:</b> “${r.reply}”</div>
      <div class="counters">${raw(treatChips(r.treats))}</div>
      <small class="tag">Lời đáp vui do quán tự tạo theo số ly người ấy đã nhận.</small>
    </div>`;
  }

  async function giftPanel(drinkId) {
    const box = $('#activity');
    box.innerHTML = html`<p class="tag">Chọn một người đang cần động viên, tặng họ ly ${drinkById[drinkId].name.toLowerCase()} kèm lời nhắn. Bạn chỉ tặng được số ly đang có để tặng.</p><div id="giftList"><p class="empty">Đang xem ai cần một ly nước…</p></div>`.s;
    try {
      const [{ posts }, w] = await Promise.all([api('/posts?limit=30'), api('/wallet')]);
      if (!w.tray[drinkId]) {
        const tf0 = treatForm(drinkId, 0, null, w.tray);
        const el0 = $('#giftList'); if (!el0) return;
        el0.innerHTML = tf0.html.s; tf0.bind();
        return;
      }
      const need = posts.filter((p) => !p.isMine && !p.resolved).slice(0, 12);
      const el = $('#giftList');
      if (!el) return;
      if (!need.length) { el.innerHTML = html`<div class="empty">Quán hôm nay ai cũng ổn cả 🎋</div>`.s; return; }
      el.innerHTML = need.map((p) => html`
        <div class="gift-row" data-row="${p.id}">
          <div class="gift-text">${p.author ? p.author.nickname : '🎭 Ẩn danh'}: “${p.content.slice(0, 100)}${p.content.length > 100 ? '…' : ''}”</div>
          <div class="counters">${raw(treatChips(p.treats))}</div>
          <button class="btn small" data-open-treat="${p.id}">🎁 Mời ly này</button>
          <div class="gift-slot"></div>
        </div>`.s).join('');
      el.onclick = (e) => {
        const b = e.target.closest('[data-open-treat]');
        if (!b) return;
        const row = b.closest('.gift-row');
        const slot = row.querySelector('.gift-slot');
        const tf = treatForm(drinkId, b.dataset.openTreat, (r, drink, qty) => { slot.innerHTML = treatResult(r, drink, qty).s; row.classList.add('gifted'); renderOrderBar(drinkId, aiStatus || {}, 'gift'); }, w.tray);
        b.remove();
        slot.innerHTML = tf.html.s;
        tf.bind();
      };
    } catch (err) { toast(err.message, true); }
  }

  // Mời nước ngay từ trang tâm sự
  async function mountTreat(container, postId, onDone) {
    const w = await api('/wallet');
    const tf = treatForm('trada', postId, (r, drink, qty) => { container.innerHTML = treatResult(r, drink, qty).s; if (onDone) onDone(r); }, w.tray, true);
    container.innerHTML = tf.html.s;
    tf.bind();
  }

  // ---------- Hoạt động của từng món ----------
  const ACTIVITIES = {
    trada: {
      view: () => html`
        <form id="ventForm" class="form">
          <textarea name="t" maxlength="3000" placeholder="Bực ai, bực gì, cứ viết hết ra. Không ai đọc đâu – trừ khi bạn muốn." autofocus></textarea>
          <div class="actions">
            <button type="button" class="btn" id="dump">🫗 Đổ đi (không lưu gì cả)</button>
            <button type="button" class="btn warm" id="share">🍵 Đặt lên bàn cho mọi người nghe</button>
          </div>
        </form>`,
      bind: () => {
        const f = $('#ventForm');
        $('#dump').onclick = () => {
          if (!f.t.value.trim()) return toast('Viết vài dòng đã rồi hẵng đổ nhé 😄');
          f.t.classList.add('pour');
          setTimeout(() => {
            $('#activity').innerHTML = html`<div class="done-box">🫗 Ly trà đã đổ xuống rãnh, cuốn theo hết bực dọc.<br><b>Không có gì được lưu lại.</b><br>Thở ra một hơi dài nào. Bạn thấy nhẹ hơn chút nào chưa?</div>`.s;
          }, 1300);
        };
        $('#share').onclick = () => ctx.openWrite(undefined, f.t.value);
      },
    },
    tragung: {
      view: () => html`
        <div class="breath"><div class="breath-circle" id="bc"><span id="bt">Sẵn sàng?</span></div></div>
        <p class="tag center" id="bcount">Theo vòng tròn: phồng lên thì hít vào, xẹp xuống thì thở ra.</p>
        <div class="actions center"><button class="btn warm" id="bstart">🌬️ Bắt đầu 1 phút</button></div>`,
      bind: () => {
        $('#bstart').onclick = () => {
          $('#bstart').remove();
          const steps = [['Hít vào…', 4, 1.35], ['Giữ…', 4, 1.35], ['Thở ra…', 6, 0.75]];
          let i = 0, left = steps[0][1], elapsed = 0;
          const c = $('#bc');
          const apply = () => { c.style.transitionDuration = `${steps[i][1]}s`; c.style.transform = `scale(${steps[i][2]})`; };
          apply();
          ctx.setTimer(setInterval(() => {
            elapsed++;
            if (!$('#bt')) return ctx.clearTimer();
            $('#bt').textContent = `${steps[i][0]} ${left}`;
            if (--left <= 0) { i = (i + 1) % 3; left = steps[i][1]; apply(); }
            $('#bcount').textContent = `Còn ${Math.max(0, 56 - elapsed)} giây`;
            if (elapsed >= 56) {
              ctx.clearTimer();
              $('#activity').innerHTML = html`<div class="done-box">🫚 Xong một phút rồi. Tim đập chậm lại chút nào chưa?<br>Lúc nào bí bách, chỉ cần thở ra dài hơn hít vào là cơ thể tự dịu xuống.</div>`.s;
            }
          }, 1000));
        };
      },
    },
    nuocsau: {
      view: () => html`<div class="ground" id="ground"></div>`,
      bind: () => {
        let i = 0;
        const show = () => {
          if (i >= GROUND.length) {
            $('#ground').innerHTML = html`<div class="done-box">🍈 Bạn đang ở đây, ngay lúc này, an toàn.<br>Những chuyện lo kia vẫn còn đó, nhưng giờ bạn đủ tỉnh để nhìn nó rõ hơn rồi.</div>`.s;
            return;
          }
          const [ic, t] = GROUND[i];
          $('#ground').innerHTML = html`
            <div class="ground-step"><span class="g-num">${5 - i}</span><span class="g-icon">${ic}</span><p>${t}</p></div>
            <div class="progress"><i data-w="${((i + 1) / GROUND.length) * 100}"></i></div>
            <div class="actions center"><button class="btn warm" id="gnext">${i < GROUND.length - 1 ? 'Xong, tiếp →' : 'Hoàn thành ✓'}</button></div>`.s;
          const bar = $('.progress i'); bar.style.width = `${bar.dataset.w}%`;
          $('#gnext').onclick = () => { i++; show(); };
        };
        show();
      },
    },
    caphe: {
      view: () => {
        const saved = store.get('plan', null);
        return html`
          <form id="planForm" class="form">
            <label>Điều làm bạn rối nhất lúc này là gì?
              <input name="worry" maxlength="200" placeholder="vd: Dự án trễ hạn, sếp hối liên tục" value="${saved ? saved.worry : ''}"></label>
            <b>3 việc nhỏ, làm được trong hôm nay (càng nhỏ càng tốt):</b>
            ${[0, 1, 2].map((k) => html`<label class="check plan-row"><input type="checkbox" name="d${k}" ${saved && saved.done[k] ? raw('checked') : ''}>
              <input name="s${k}" maxlength="120" placeholder="${['vd: Gửi email hỏi lại yêu cầu', 'vd: Làm xong phần mở đầu', 'vd: Xin dời hạn 1 ngày'][k]}" value="${saved ? saved.steps[k] : ''}"></label>`)}
            <p class="tag">💡 Mẹo của Cô Tư: việc nào mất dưới 5 phút thì làm luôn; việc nào không phải của mình thì mạnh dạn trả lại.</p>
            <div class="actions"><button type="button" class="btn" id="planClear">Xoá</button><button class="btn warm" type="submit">☕ Lưu trên máy này</button></div>
          </form>`;
      },
      bind: () => {
        const f = $('#planForm');
        const read = () => ({ worry: f.worry.value, steps: [0, 1, 2].map((k) => f[`s${k}`].value), done: [0, 1, 2].map((k) => f[`d${k}`].checked) });
        f.onchange = () => {
          const p = read();
          store.set('plan', p);
          if (p.steps.every((x) => x.trim()) && p.done.every(Boolean)) toast('Xong cả 3 việc! Giỏi quá, thưởng thêm ly trà đá 🧊');
        };
        f.onsubmit = (e) => { e.preventDefault(); store.set('plan', read()); toast('Đã lưu trên máy này. Làm từng việc một thôi nhé ☕'); };
        $('#planClear').onclick = () => { store.set('plan', null); f.reset(); for (const el of f.querySelectorAll('input')) if (el.type !== 'checkbox') el.value = ''; };
      },
    },
    daunanh: {
      view: () => {
        const jar = store.get('jar', []);
        return html`
          <div class="say-box">🥛 “${pick(COMFORT)}” <small>— Cô Tư</small></div>
          <form id="jarForm" class="form">
            <label>Hôm nay bạn đã làm được một điều gì, dù nhỏ? <input name="g" maxlength="140" placeholder="vd: Mình đã ăn sáng đàng hoàng / đã nói không với việc quá sức" autofocus></label>
            <button class="btn warm" type="submit">🫙 Bỏ vào lọ điều tốt</button>
          </form>
          <h3>🫙 Lọ điều tốt của bạn (${jar.length})</h3>
          <div class="jar">${jar.length ? jar.slice(-30).reverse().map((j) => html`<div class="jar-note">${j.t}<small>${new Date(j.at).toLocaleDateString('vi-VN')}</small></div>`) : html`<p class="tag">Lọ còn trống. Ngày buồn, mở lọ ra đọc lại sẽ thấy mình đã cố gắng nhiều thế nào.</p>`}</div>
          <p class="tag">Lọ chỉ nằm trên máy này, không ai khác đọc được.</p>`;
      },
      bind: () => {
        $('#jarForm').onsubmit = (e) => {
          e.preventDefault();
          const t = e.target.g.value.trim();
          if (!t) return;
          const jar = store.get('jar', []);
          jar.push({ t, at: Date.now() });
          store.set('jar', jar.slice(-200));
          toast('Đã bỏ vào lọ. Bạn giỏi hơn bạn nghĩ đấy 🫙');
          order('daunanh', false, 'quick');
        };
      },
    },
    nuocdua: {
      view: () => html`
        <div class="rest"><div class="rest-time" id="rtime">2:00</div><p class="rest-step" id="rstep">Cắm ống hút, ngả lưng ra ghế. Bấm bắt đầu khi bạn sẵn sàng.</p></div>
        <div class="actions center"><button class="btn warm" id="rstart">🥥 Nghỉ 2 phút</button></div>`,
      bind: () => {
        $('#rstart').onclick = () => {
          $('#rstart').remove();
          let t = 120;
          $('#rstep').textContent = BODY_STEPS[0];
          ctx.setTimer(setInterval(() => {
            if (!$('#rtime')) return ctx.clearTimer();
            t--;
            $('#rtime').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
            $('#rstep').textContent = BODY_STEPS[Math.min(BODY_STEPS.length - 1, Math.floor((120 - t) / 20))];
            if (t <= 0) {
              ctx.clearTimer();
              $('#activity').innerHTML = html`<div class="done-box">🥥 Hết 2 phút. Cảm ơn bạn đã cho mình nghỉ một chút.<br>Nghỉ ngơi không phải lười biếng – là sạc pin để đi tiếp.</div>`.s;
            }
          }, 1000));
        };
      },
    },
    trachanh: {
      view: () => html`<div class="say-box joke" id="joke">🍋 ${pick(JOKES)}</div>
        <div class="actions center"><button class="btn warm" id="more">😂 Kể thêm đi cô</button></div>`,
      bind: () => {
        $('#more').onclick = () => {
          $('#joke').textContent = `🍋 ${pick(JOKES)}`;
          const s = ctx.getSocket(); if (s) s.emit('emote', 'laugh');
        };
      },
    },
    nuocmia: {
      view: () => html`<div class="say-box">🎋 “Ngọt cho người là ngọt cho mình con ạ. Mời ai đó một ly đi, rồi xem họ cười kìa.” <small>— Cô Tư</small></div>
        <div class="actions center"><button class="btn warm" id="toGift">🎁 Chọn người để mời nước mía</button></div>`,
      bind: () => { $('#toGift').onclick = () => order('nuocmia', false, 'gift'); },
    },
  };

  return { openMenu, order, mountTreat };
}

const KIND_LINES = ['Mình hiểu mà, bạn không một mình đâu 💛', 'Bạn đã cố gắng nhiều lắm rồi', 'Uống ly nước cho mát rồi tính tiếp nha', 'Mai trời lại sáng, cố lên!'];

// Chip đếm số ly theo món: 🧊 101 · 🫚 3
export function treatChips(t) {
  if (!t || !t.total) return '';
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return Object.entries(t.counts).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `<span class="tchip" title="${esc(drinkById[k] ? drinkById[k].name : k)}">${drinkById[k] ? drinkById[k].icon : '🍵'} ${n}</span>`).join('');
}
