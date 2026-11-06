// Trang quản trị quán: tổng quan, AI cho Cô Tư (Claude / ChatGPT / Gemini), điều khiển Cô Tư,
// kinh tế & thu phí, người dùng, báo cáo, tâm sự, thanh toán.
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
const when = (t) => (t ? new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—');
const DRINK_ICON = { trada: '🧊', tragung: '🫚', nuocsau: '🍈', caphe: '☕', daunanh: '🥛', nuocdua: '🥥', trachanh: '🍋', nuocmia: '🎋' };
const TABLES = { congviec: '💼 Công Việc', giadinh: '🏠 Gia Đình', tinhcam: '💔 Tình Cảm', hochanh: '📚 Học Hành', tienbac: '💸 Cơm Áo Gạo Tiền', cuocsong: '🌧️ Chuyện Đời' };

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { 'X-Requested-With': 'xastress', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Lỗi ${res.status}`), { status: res.status });
  return data;
}
let toastTimer;
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = `toast${err ? ' err' : ''}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 4000);
}
const setBars = (root) => { for (const b of root.querySelectorAll('.bar i')) b.style.width = `${Math.min(100, Number(b.dataset.w) || 0)}%`; };

let timer = null;
const main = $('#main');
function setTimer(fn, ms) { clearInterval(timer); timer = fn ? setInterval(fn, ms) : null; }

// ================= Tổng quan =================
async function overview() {
  const o = await api('/admin/overview');
  const e = o.economy;
  const pct = Math.round((e.participants / e.threshold) * 100);
  const ai = o.ai;
  const PROV = { anthropic: 'Claude', openai: 'ChatGPT (OpenAI API)', gemini: 'Gemini', none: 'Tắt – dùng câu soạn sẵn' };
  const calls = Object.values(ai.usage.calls || {}).reduce((a, b) => a + b, 0);
  const errs = Object.values(ai.usage.errors || {}).reduce((a, b) => a + b, 0);
  $('#repCount').textContent = o.openReports; $('#repCount').classList.toggle('hidden', !o.openReports);
  main.innerHTML = `
    <h1>📊 Tổng quan</h1>
    <div class="grid">
      ${[['🟢 Đang trong quán', o.online], ['👥 Khách', o.users], ['🆕 Khách mới hôm nay', o.newUsersToday], ['📝 Tâm sự hôm nay', `${o.postsToday} / ${o.postsTotal}`],
        ['💬 Bình luận hôm nay', o.commentsToday], ['🧋 Ly gọi hôm nay', o.ordersToday], ['🎁 Ly tặng hôm nay', o.cupsGiftedToday], ['✉️ Tin riêng hôm nay', o.dmsToday],
        ['🚩 Báo cáo chờ xử lý', o.openReports], ['⭐ Đã bán', `${fmt(o.payments.stars)}⭐ · ${fmt(o.payments.xu)} xu`]]
        .map(([k, v]) => `<div class="tile"><div class="v">${esc(typeof v === 'number' ? fmt(v) : v)}</div><div class="k">${k}</div></div>`).join('')}
    </div>
    <div class="card">
      <b>💰 Thu phí:</b> ${e.paywall ? '<span class="pill">Đang thu phí</span>' : '<span class="pill ok">Đang miễn phí</span>'}
      <span class="muted">· chế độ ${esc(e.mode)}</span>
      <div class="bar"><i data-w="${pct}"></i></div>
      <span class="muted">${fmt(e.participants)}/${fmt(e.threshold)} khách (${pct}%) – đủ ${fmt(e.threshold)} khách sẽ tự bắt đầu thu phí ở chế độ "auto".</span>
    </div>
    <div class="card">
      <b>🤖 AI của Cô Tư:</b> ${ai.provider === 'none' ? '<span class="pill off">Tắt</span>' : '<span class="pill ok">Đang chạy</span>'} ${esc(PROV[ai.provider])}
      ${ai.provider !== 'none' ? `<span class="muted">· model <code>${esc(ai.model)}</code></span>` : ''}
      ${ai.chosen !== ai.provider ? `<div class="note red">Đã chọn ${esc(PROV[ai.chosen])} nhưng chưa có khoá API hợp lệ → Cô Tư đang dùng câu soạn sẵn.</div>` : ''}
      <div class="muted">Hôm nay: ${fmt(calls)} lượt gọi AI, ${fmt(errs)} lỗi.</div>
      <div><b>🎙️ Cô Tư hoạt náo:</b> ${o.cotu.enabled ? '<span class="pill ok">Bật</span>' : '<span class="pill off">Tắt</span>'}</div>
    </div>`;
  setBars(main);
}

// ================= AI cho Cô Tư =================
const PROV_INFO = {
  none: { name: 'Tắt AI', desc: 'Cô Tư dùng kho câu soạn sẵn. Không tốn phí.' },
  anthropic: { name: 'Claude (Anthropic)', desc: 'Khoá API tại platform.claude.com → API Keys.', link: 'https://platform.claude.com/' },
  openai: { name: 'ChatGPT (OpenAI API)', desc: 'Khoá API tại platform.openai.com/api-keys. Gói ChatGPT Plus KHÔNG dùng được – API tính phí riêng.', link: 'https://platform.openai.com/api-keys' },
  gemini: { name: 'Gemini (Google)', desc: 'Khoá API tại aistudio.google.com/apikey. Gói Gemini Advanced/Google One KHÔNG dùng được – cần khoá API.', link: 'https://aistudio.google.com/apikey' },
};
async function aiTab() {
  const s = (await api('/admin/settings')).ai;
  main.innerHTML = `
    <h1>🤖 AI cho Cô Tư</h1>
    <div class="note">⚠️ <b>Gói ChatGPT Plus hay Gemini Advanced dùng cho cá nhân trên app/web, không có API</b> nên không gắn vào website được.
      Để Cô Tư chạy bằng GPT hay Gemini, bạn cần <b>khoá API</b> của nhà cung cấp đó (tính phí theo lượng dùng, tách biệt với gói Plus).
      Gemini có gói API miễn phí, nhưng ở gói miễn phí Google có thể dùng dữ liệu để cải thiện sản phẩm – với nội dung tâm sự nhạy cảm nên dùng gói trả phí.</div>
    <h2>Chọn nhà cung cấp</h2>
    <div class="prov">${Object.entries(PROV_INFO).map(([k, p]) => `
      <label class="opt ${s.provider === k ? 'on' : ''}"><h3><input type="radio" name="prov" value="${k}" ${s.provider === k ? 'checked' : ''}>${esc(p.name)}
        ${s.active === k ? '<span class="pill ok">đang chạy</span>' : ''}</h3>
        <div class="muted">${esc(p.desc)}</div>
        ${p.link ? `<a href="${p.link}" target="_blank" rel="noopener">Lấy khoá API ↗</a>` : ''}</label>`).join('')}
    </div>
    <h2>Khoá API & model</h2>
    <div class="card">
      ${['anthropic', 'openai', 'gemini'].map((k) => `
        <div class="row">
          <b>${esc(PROV_INFO[k].name)}</b>
          <label class="f">Khoá API <input type="password" autocomplete="off" data-key="${k}" placeholder="${esc(s.keys[k] || 'chưa có')}"></label>
          <label class="f">Model <input data-model="${k}" value="${esc(s.models[k])}"></label>
          ${s.keys[k] && s.keys[k] !== '(.env)' ? `<button class="btn danger" data-delkey="${k}">Xoá khoá</button>` : ''}
        </div>`).join('<hr>')}
      <p class="muted">Để trống ô khoá = giữ nguyên khoá đã lưu. Khoá được mã hoá khi lưu và không bao giờ hiển thị lại đầy đủ. Tên model có thể thay đổi theo thời gian – kiểm tra trang tài liệu của nhà cung cấp.</p>
      <label class="f">Mức suy nghĩ (chỉ áp dụng cho Claude khi tâm sự)
        <select id="effort">${['low', 'medium', 'high'].map((x) => `<option ${s.effort === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <div class="row"><button class="btn primary" id="saveAi">💾 Lưu</button><button class="btn green" id="testAi">⚡ Thử gọi AI</button><span id="testOut" class="muted"></span></div>
    </div>`;
  // khắc phục: style inline bị CSP chặn -> đặt độ rộng nhãn bằng JS
  for (const b of main.querySelectorAll('.row > b')) b.style.minWidth = '150px';
  main.querySelectorAll('.opt').forEach((o) => { o.onclick = () => { main.querySelectorAll('.opt').forEach((x) => x.classList.toggle('on', x === o)); }; });
  main.querySelectorAll('[data-delkey]').forEach((b) => { b.onclick = async () => {
    if (!confirm('Xoá khoá API này?')) return;
    await api('/admin/settings/ai', { body: { keys: { [b.dataset.delkey]: '' } } }); toast('Đã xoá khoá.'); aiTab();
  }; });
  $('#saveAi').onclick = async () => {
    const keys = {}, models = {};
    main.querySelectorAll('[data-key]').forEach((i) => { if (i.value.trim()) keys[i.dataset.key] = i.value.trim(); });
    main.querySelectorAll('[data-model]').forEach((i) => { models[i.dataset.model] = i.value.trim(); });
    const provider = (main.querySelector('input[name=prov]:checked') || {}).value;
    try {
      const r = await api('/admin/settings/ai', { body: { provider, keys, models, effort: $('#effort').value } });
      toast(r.active === 'none' && provider !== 'none' ? 'Đã lưu, nhưng nhà cung cấp này chưa có khoá API → Cô Tư dùng câu soạn sẵn.' : 'Đã lưu cài đặt AI ✓', r.active === 'none' && provider !== 'none');
      aiTab();
    } catch (err) { toast(err.message, true); }
  };
  $('#testAi').onclick = async () => {
    $('#testOut').textContent = 'Đang gọi…';
    try { const r = await api('/admin/ai/test', { body: {} }); $('#testOut').textContent = `✓ ${r.provider} / ${r.model} (${r.ms} ms): “${r.text}”`; }
    catch (err) { $('#testOut').textContent = `✗ ${err.message}`; }
  };
}

// ================= Điều khiển Cô Tư =================
async function cotuTab() {
  const c = (await api('/admin/settings')).cotu;
  const F = [['quietMinutes', 'Quán im lặng bao lâu thì khơi chuyện (phút)'], ['gapMinutes', 'Tối thiểu giữa 2 lần khơi chuyện (phút)'], ['tableQuietMinutes', 'Bàn chủ đề im lặng bao lâu (phút)'],
    ['pollMinutes', 'Thời gian mỗi bình chọn (phút)'], ['postCommentDelaySec', 'Tâm sự chưa ai hỏi han sau bao lâu thì Cô Tư vào (giây)'], ['nudgeSeconds', 'Nhắc người chưa gọi ly sau (giây)']];
  main.innerHTML = `
    <h1>🎙️ Điều khiển Cô Tư</h1>
    <div class="card">
      <label class="row"><input type="checkbox" id="cEnabled" ${c.enabled ? 'checked' : ''}> <b>Bật Cô Tư hoạt náo</b> (chào khách, khơi chuyện, bình chọn, trả lời khi được gọi, bình luận tâm sự bị bỏ trống)</label>
      <div class="grid">${F.map(([k, l]) => `<label class="f">${l}<input type="number" step="0.5" min="0.1" data-c="${k}" value="${esc(c[k])}"></label>`).join('')}</div>
      <button class="btn primary" id="saveC">💾 Lưu</button>
    </div>
    <h2>Cô Tư nói ngay</h2>
    <div class="card">
      <textarea id="sayText" maxlength="400" placeholder="Ví dụ: Tối nay 21h quán có chủ đề “Chuyện công sở”, các con ghé chơi nhé!"></textarea>
      <div class="row">
        <select id="sayCh"><option value="public">🌐 Cả quán</option>${Object.entries(TABLES).map(([k, v]) => `<option value="table:${k}">${v}</option>`).join('')}</select>
        <button class="btn primary" id="sayBtn">🗣️ Cô Tư nói</button>
        <button class="btn" id="topicQ">💭 Khơi chuyện ngay</button>
        <button class="btn" id="topicP">📊 Bình chọn ngẫu nhiên</button>
      </div>
    </div>
    <h2>Tự tạo bình chọn</h2>
    <div class="card">
      <label class="f">Câu hỏi <input id="pq" maxlength="160" placeholder="Làm thêm giờ không lương: nhận hay từ chối?"></label>
      <div class="row">${[1, 2, 3, 4].map((i) => `<input data-po placeholder="Lựa chọn ${i}${i > 2 ? ' (tuỳ chọn)' : ''}" maxlength="40">`).join('')}</div>
      <button class="btn primary" id="pollBtn">📊 Mở bình chọn trong chat cả quán</button>
    </div>
    <h2>Chat cả quán (trực tiếp)</h2>
    <div class="card"><div class="feed" id="feed"></div></div>`;
  $('#saveC').onclick = async () => {
    const body = { enabled: $('#cEnabled').checked };
    main.querySelectorAll('[data-c]').forEach((i) => { body[i.dataset.c] = Number(i.value); });
    try { await api('/admin/settings/cotu', { body }); toast('Đã lưu ✓'); } catch (err) { toast(err.message, true); }
  };
  $('#sayBtn').onclick = async () => {
    try { await api('/admin/cotu/say', { body: { text: $('#sayText').value, channel: $('#sayCh').value } }); $('#sayText').value = ''; toast('Cô Tư đã nói ✓'); feed(); }
    catch (err) { toast(err.message, true); }
  };
  $('#topicQ').onclick = async () => { await api('/admin/cotu/topic', { body: { poll: false, channel: $('#sayCh').value } }); toast('Đã khơi chuyện ✓'); feed(); };
  $('#topicP').onclick = async () => { await api('/admin/cotu/topic', { body: { poll: true, channel: 'public' } }); toast('Đã mở bình chọn ✓'); feed(); };
  $('#pollBtn').onclick = async () => {
    const options = [...main.querySelectorAll('[data-po]')].map((i) => i.value.trim()).filter(Boolean);
    try { await api('/admin/cotu/poll', { body: { question: $('#pq').value, options } }); toast('Đã mở bình chọn ✓'); feed(); }
    catch (err) { toast(err.message, true); }
  };
  async function feed() {
    const { items } = await api('/admin/chat?channel=public');
    const el = $('#feed'); if (!el) return;
    el.innerHTML = items.length ? items.map((m) => `<div class="m ${m.npc ? 'npc' : ''}"><span class="muted">${when(m.at)}</span> <b>${esc(m.npc ? '🍵 Cô Tư' : m.nickname)}</b>: ${esc(m.text)}
      ${m.poll ? `<div class="muted">📊 ${m.poll.options.map((o, i) => `${esc(o)}: ${m.poll.counts[i]}`).join(' · ')}${m.poll.closed ? ' (đã chốt)' : ''}</div>` : ''}</div>`).join('') : '<span class="muted">Chưa có tin nhắn.</span>';
    el.scrollTop = el.scrollHeight;
  }
  feed();
  setTimer(feed, 5000);
}

// ================= Kinh tế =================
async function economyTab() {
  const s = await api('/admin/settings');
  const o = await api('/admin/overview');
  main.innerHTML = `
    <h1>💰 Kinh tế & thu phí</h1>
    <div class="card">
      <h2>Thu phí</h2>
      <div class="row">
        <label class="f">Chế độ <select id="pwMode">
          <option value="auto" ${s.paywall.mode === 'auto' ? 'selected' : ''}>auto – tự thu phí khi đủ số khách</option>
          <option value="off" ${s.paywall.mode === 'off' ? 'selected' : ''}>off – miễn phí mãi</option>
          <option value="on" ${s.paywall.mode === 'on' ? 'selected' : ''}>on – thu phí ngay</option></select></label>
        <label class="f">Số khách để bắt đầu thu phí <input type="number" id="pwUsers" min="1" value="${esc(s.paywall.users)}"></label>
      </div>
      <div class="bar"><i data-w="${Math.round((o.economy.participants / o.economy.threshold) * 100)}"></i></div>
      <span class="muted">Hiện có ${fmt(o.economy.participants)} khách · ${o.economy.paywall ? 'đang thu phí' : 'đang miễn phí'}</span>
      <h2>Giá mỗi ly (xu)</h2>
      <div class="grid">${Object.entries(s.prices).map(([k, v]) => `<label class="f">${DRINK_ICON[k] || ''} ${esc(s.drinks[k])}<input type="number" min="0" data-price="${k}" value="${v}"></label>`).join('')}</div>
      <button class="btn primary" id="saveEco">💾 Lưu</button>
    </div>
    <h2>Gói xu bán qua bot Telegram</h2>
    <table><tr><th>Gói</th><th>Xu</th><th>Giá (Telegram Stars)</th></tr>
      ${s.packages.map((p) => `<tr><td>${esc(p.label)}</td><td>${fmt(p.xu)}</td><td>${fmt(p.stars)} ⭐</td></tr>`).join('')}</table>
    <p class="muted">Đổi gói xu trong <code>server/constants.js</code> (XU_PACKAGES) rồi khởi động lại dịch vụ.</p>`;
  setBars(main);
  $('#saveEco').onclick = async () => {
    const prices = {};
    main.querySelectorAll('[data-price]').forEach((i) => { prices[i.dataset.price] = Number(i.value); });
    try { await api('/admin/settings/economy', { body: { paywall: { mode: $('#pwMode').value, users: Number($('#pwUsers').value) }, prices } }); toast('Đã lưu ✓'); economyTab(); }
    catch (err) { toast(err.message, true); }
  };
}

// ================= Người dùng =================
async function usersTab(q = '') {
  const { items } = await api(`/admin/users?q=${encodeURIComponent(q)}`);
  main.innerHTML = `
    <h1>👥 Người dùng</h1>
    <div class="row"><input id="uq" placeholder="Tìm theo biệt danh…" value="${esc(q)}"><button class="btn" id="uqBtn">🔍 Tìm</button>
      <span class="muted">Trang quản trị chỉ hiện biệt danh, không hiện tên đăng nhập của khách.</span></div>
    <table><tr><th>#</th><th>Biệt danh</th><th>Vào quán</th><th>Tâm sự</th><th>Bị báo cáo</th><th>Xu</th><th>Trạng thái</th><th></th></tr>
    ${items.map((u) => `<tr>
      <td>${u.id}</td><td><span class="dot ${u.online ? 'on' : ''}"></span>${esc(u.nickname)} ${u.is_admin ? '<span class="pill warn">admin</span>' : ''}</td>
      <td>${when(u.created_at)}</td><td>${u.posts}</td><td>${u.reported ? `<span class="pill">${u.reported}</span>` : 0}</td><td>${fmt(u.xu)}</td>
      <td>${u.banned ? '<span class="pill">Đã khoá</span>' : '<span class="pill ok">Hoạt động</span>'}</td>
      <td class="row"><button class="btn" data-xu="${u.id}">± Xu</button>
        <button class="btn ${u.banned ? '' : 'danger'}" data-ban="${u.id}" data-b="${u.banned ? 0 : 1}">${u.banned ? 'Mở khoá' : 'Khoá'}</button></td></tr>`).join('')}
    </table>`;
  $('#uqBtn').onclick = () => usersTab($('#uq').value);
  $('#uq').onkeydown = (e) => { if (e.key === 'Enter') usersTab($('#uq').value); };
  main.onclick = async (e) => {
    const x = e.target.closest('[data-xu]'), b = e.target.closest('[data-ban]');
    try {
      if (x) {
        const d = prompt('Cộng (số dương) hoặc trừ (số âm) bao nhiêu xu? Ví dụ: 50 hoặc -20');
        if (!d) return;
        const r = await api(`/admin/users/${x.dataset.xu}/xu`, { body: { delta: Number(d) } }); toast(`Ví hiện có ${fmt(r.xu)} xu`); usersTab(q);
      }
      if (b) {
        if (b.dataset.b === '1' && !confirm('Khoá tài khoản này? Người dùng sẽ bị đăng xuất ngay.')) return;
        await api(`/admin/users/${b.dataset.ban}/ban`, { body: { banned: b.dataset.b === '1' } }); toast('Đã cập nhật ✓'); usersTab(q);
      }
    } catch (err) { toast(err.message, true); }
  };
}

// ================= Báo cáo =================
async function reportsTab() {
  const { reports } = await api('/admin/reports');
  main.innerHTML = `
    <h1>🚩 Báo cáo vi phạm</h1>
    ${reports.length ? `<table><tr><th>Loại</th><th>Nội dung</th><th>Số báo cáo</th><th>Lý do</th><th>Trạng thái</th><th></th></tr>
    ${reports.map((r) => `<tr><td>${r.type === 'post' ? 'Tâm sự' : 'Bình luận'} #${r.id}</td><td class="content">${esc(r.content || '(đã xoá)')}</td>
      <td><span class="pill">${r.count}</span></td><td class="content muted">${esc(r.reasons || '—')}</td>
      <td>${!r.exists ? 'Đã xoá' : r.hidden ? '<span class="pill off">Đang ẩn</span>' : '<span class="pill ok">Đang hiện</span>'}</td>
      <td class="row">${r.exists ? `<button class="btn" data-hide="${r.type}" data-id="${r.id}" data-h="${r.hidden ? 0 : 1}">${r.hidden ? 'Hiện lại' : 'Ẩn'}</button>
        <button class="btn danger" data-ban="${r.type}" data-id="${r.id}">Khoá tác giả</button>` : ''}</td></tr>`).join('')}</table>`
      : '<div class="card">Quán sạch sẽ, chưa có báo cáo nào 🧹</div>'}`;
  main.onclick = async (e) => {
    const h = e.target.closest('[data-hide]'), b = e.target.closest('[data-ban]');
    try {
      if (h) { await api('/admin/hide', { body: { type: h.dataset.hide, id: Number(h.dataset.id), hidden: h.dataset.h === '1' } }); toast('Đã cập nhật ✓'); reportsTab(); }
      if (b && confirm('Khoá tài khoản tác giả?')) { await api('/admin/ban', { body: { type: b.dataset.ban, id: Number(b.dataset.id) } }); toast('Đã khoá ✓'); reportsTab(); }
    } catch (err) { toast(err.message, true); }
  };
}

// ================= Tâm sự =================
async function postsTab() {
  const { items } = await api('/admin/posts');
  main.innerHTML = `
    <h1>📝 Tâm sự gần đây</h1>
    <table><tr><th>#</th><th>Bàn</th><th>Người viết</th><th>Nội dung</th><th>💬</th><th>🚩</th><th>Trạng thái</th><th></th></tr>
    ${items.map((p) => `<tr><td>${p.id}</td><td>${TABLES[p.table_id] || p.table_id}</td><td>${p.anonymous ? '🎭 ẩn danh' : esc(p.nickname)}</td>
      <td class="content">${esc(p.content.slice(0, 300))}</td><td>${p.comments}</td><td>${p.reports ? `<span class="pill">${p.reports}</span>` : 0}</td>
      <td>${p.hidden ? '<span class="pill off">Ẩn</span>' : p.resolved ? '<span class="pill ok">Đã vượt qua</span>' : 'Hiện'} <div class="muted">${when(p.created_at)}</div></td>
      <td class="row"><button class="btn" data-hide="${p.id}" data-h="${p.hidden ? 0 : 1}">${p.hidden ? 'Hiện lại' : 'Ẩn'}</button>
        <button class="btn danger" data-del="${p.id}">Xoá</button></td></tr>`).join('')}</table>
    <p class="muted">Tâm sự ẩn danh: trang quản trị cũng không hiện biệt danh người viết.</p>`;
  main.onclick = async (e) => {
    const h = e.target.closest('[data-hide]'), d = e.target.closest('[data-del]');
    try {
      if (h) { await api('/admin/hide', { body: { type: 'post', id: Number(h.dataset.hide), hidden: h.dataset.h === '1' } }); postsTab(); }
      if (d && confirm('Xoá vĩnh viễn tâm sự này?')) { await api(`/posts/${d.dataset.del}`, { method: 'DELETE' }); toast('Đã xoá'); postsTab(); }
    } catch (err) { toast(err.message, true); }
  };
}

// ================= Thanh toán =================
async function paymentsTab() {
  const { items } = await api('/admin/payments');
  main.innerHTML = `
    <h1>⭐ Thanh toán qua Telegram</h1>
    ${items.length ? `<table><tr><th>Thời gian</th><th>Khách</th><th>Gói</th><th>Xu</th><th>Stars</th><th>Mã giao dịch</th></tr>
      ${items.map((p) => `<tr><td>${when(p.created_at)}</td><td>${esc(p.nickname || '(đã xoá)')}</td><td>${esc(p.package)}</td><td>${fmt(p.xu)}</td><td>${fmt(p.stars)} ⭐</td><td><code>${esc(p.charge_id)}</code></td></tr>`).join('')}</table>`
      : '<div class="card">Chưa có giao dịch nào. Quán đang miễn phí hoặc chưa ai mua xu.</div>'}
    <p class="muted">Hoàn tiền Stars: dùng mã giao dịch với lệnh refundStarPayment của Telegram Bot API.</p>`;
}

// ================= Điều hướng =================
const TABS = { overview, ai: aiTab, cotu: cotuTab, economy: economyTab, users: () => usersTab(), reports: reportsTab, posts: postsTab, payments: paymentsTab };
async function go(tab) {
  setTimer(null);
  main.onclick = null;
  for (const b of document.querySelectorAll('#nav button')) b.classList.toggle('on', b.dataset.tab === tab);
  try {
    await TABS[tab]();
    if (tab === 'overview') setTimer(() => overview().catch(() => {}), 15000);
  } catch (err) {
    main.innerHTML = `<div class="card note red">${esc(err.message)}</div>`;
  }
  history.replaceState(null, '', `#${tab}`);
}
$('#nav').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); };

(async () => {
  try {
    const { user } = await api('/auth/me');
    if (!user || !user.isAdmin) {
      main.innerHTML = '<div class="card note red">Trang này chỉ dành cho quản trị viên. Đăng nhập ở <a href="/">quán</a> bằng tài khoản có trong <code>ADMIN_USERNAMES</code>.</div>';
      $('#nav').classList.add('hidden');
      return;
    }
    $('#who').textContent = `👤 ${user.nickname}`;
    const t = location.hash.slice(1);
    go(TABS[t] ? t : 'overview');
  } catch (err) { main.textContent = err.message; }
})();
