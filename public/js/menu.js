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

  function openMenu(mood) {
    const rec = mood && MOOD_PICK[mood] ? MOOD_PICK[mood].drinks : [];
    openModal(html`
      <div class="menu-board">
        <h2 class="chalk-title">🍵 Thực đơn quán Cô Tư</h2>
        <p class="chalk-sub">Hôm nay bạn thấy thế nào? Cô gợi ý món hợp lòng:</p>
        <div class="mood-chips">${Object.entries(MOOD_PICK).map(([k, m]) => html`<button type="button" class="chip-btn ${k === mood ? 'on' : ''}" data-mood="${k}">${m.label}</button>`)}</div>
        <div class="menu-grid">${DRINKS.map((d) => html`
          <button type="button" class="menu-item ${rec.includes(d.id) ? 'rec' : ''}" data-drink="${d.id}">
            ${rec.includes(d.id) ? html`<span class="rec-badge">Cô gợi ý</span>` : ''}
            <span class="mi-icon">${d.icon}</span>
            <span class="mi-name">${d.name}</span>
            <span class="mi-price">${d.price}</span>
            <span class="mi-tag">${d.tag}</span>
          </button>`)}</div>
        <p class="chalk-foot">Giá chỉ để vui thôi, quán không thu tiền 😄 · Những gì bạn viết trong các món này chỉ ở trên máy bạn.</p>
      </div>`, 'menu');
    $('#modalBody').onclick = (e) => {
      const m = e.target.closest('[data-mood]');
      if (m) return openMenu(m.dataset.mood === mood ? null : m.dataset.mood);
      const d = e.target.closest('[data-drink]');
      if (d) order(d.dataset.drink);
    };
  }

  function order(id, emit = true) {
    const d = drinkById[id];
    const s = ctx.getSocket();
    if (emit && s && id !== 'nuocmia') s.emit('order', id);
    const shell = (body) => html`
      <button class="linkish" id="backMenu">← Xem lại thực đơn</button>
      <div class="served"><span class="served-icon">${d.icon}</span><div><h2>${d.name}</h2><p class="tag">${d.desc}</p></div></div>
      <div id="activity">${body}</div>`;
    const run = ACTIVITIES[id];
    openModal(shell(run.view()), 'menu');
    $('#backMenu').onclick = () => openMenu();
    run.bind();
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
          order('daunanh', false);
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
      view: () => html`<p class="tag">Chọn một người đang cần động viên, rồi chọn món để mời. Họ sẽ nhận được thông báo: “Có người mời bạn một ly…”.</p><div id="giftList"><p class="empty">Đang xem ai cần một ly nước…</p></div>`,
      bind: async () => {
        try {
          const { posts } = await api('/posts?limit=30');
          const need = posts.filter((p) => !p.isMine && !p.resolved).slice(0, 12);
          const el = $('#giftList');
          if (!el) return;
          el.innerHTML = need.length ? need.map((p) => html`
            <div class="gift-row">
              <div class="gift-text">${p.author ? p.author.nickname : '🎭 Ẩn danh'}: “${p.content.slice(0, 90)}${p.content.length > 90 ? '…' : ''}”</div>
              <div class="gift-drinks">${DRINKS.filter((d) => d.id !== 'nuocmia').concat([drinkById.nuocmia]).map((d) => html`<button type="button" class="btn small" title="Mời ${d.name}" data-gift="${p.id}" data-d="${d.id}">${d.icon}</button>`)}</div>
            </div>`.s).join('') : html`<div class="empty">Quán hôm nay ai cũng ổn cả. Ly nước mía này cô mời bạn luôn 🎋</div>`.s;
          el.onclick = async (e) => {
            const b = e.target.closest('[data-gift]');
            if (!b) return;
            b.disabled = true;
            try {
              await api(`/posts/${b.dataset.gift}/treat`, { body: { drink: b.dataset.d } });
              toast(`Đã mời ${drinkById[b.dataset.d].name}. Một ly nước, một tấm lòng 💛`);
              const s = ctx.getSocket(); if (s) s.emit('emote', 'heart');
              b.closest('.gift-row').classList.add('gifted');
            } catch (err) { toast(err.message, true); b.disabled = false; }
          };
        } catch (err) { toast(err.message, true); }
      },
    },
  };

  return { openMenu, order };
}
