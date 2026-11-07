// Điền thông tin đơn vị vận hành (quản trị viên nhập trong trang quản trị) vào các trang pháp lý
(async () => {
  const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
  let s = {};
  try { s = await (await fetch('/api/site-info')).json(); } catch { /* hiện chữ mặc định */ }
  for (const el of document.querySelectorAll('[data-k]')) {
    const v = s[el.dataset.k];
    if (v !== undefined && v !== '') el.textContent = v;
    else if (!el.textContent.trim()) { el.textContent = '(đang cập nhật)'; el.classList.add('missing'); }
  }
  for (const el of document.querySelectorAll('[data-if]')) if (!s[el.dataset.if]) el.remove();
  for (const el of document.querySelectorAll('a[data-mail]')) {
    if (s.email) { el.href = `mailto:${s.email}`; el.textContent = s.email; } else { el.removeAttribute('href'); el.textContent = '(đang cập nhật)'; el.classList.add('missing'); }
  }
  const pw = document.getElementById('paywallText');
  if (pw && s.paywallMode === 'auto' && !s.paywallOn) pw.innerHTML = `Quán <b>miễn phí</b> cho tất cả mọi người cho tới khi đủ <b>${fmt(s.paywallUsers)}</b> khách tham gia, sau đó mới bắt đầu tính xu khi gọi nước. Mỗi khách mới có 1 phiếu gọi ly miễn phí. Quán sẽ thông báo trong quán trước khi bắt đầu tính phí.`;
  if (pw && s.paywallOn) pw.innerHTML = 'Quán <b>đang tính xu</b> khi gọi nước. Mỗi khách mới có 1 phiếu gọi ly miễn phí; ly của mình (được tặng) uống miễn phí.';
  const pk = document.querySelector('[data-packages]');
  if (pk && Array.isArray(s.packages)) {
    pk.innerHTML = s.packages.map((p) => `<tr><td>${p.label.replace(/[<>&]/g, '')}</td><td>${fmt(p.xu)} xu</td><td>${fmt(p.vnd)}đ</td><td>${p.stars ? `${fmt(p.stars)} ⭐` : '—'}</td></tr>`).join('');
  }
  for (const a of document.querySelectorAll('header.top nav a')) if (a.getAttribute('href') === location.pathname) a.setAttribute('aria-current', 'page');
})();
