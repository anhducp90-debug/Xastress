'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xastress-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.ADMIN_USERNAMES = 'quanly';
process.env.AI_ENABLED = '0'; // test không gọi API thật
process.env.AUTH_RATE_LIMIT = '1000';
process.env.SEAT_GATE = '0';
process.env.HOST_ENABLED = '0'; // test riêng bên dưới gọi trực tiếp các hàm của Cô Tư // test riêng bên dưới bật lại luật "gọi ly mới vào quán"
process.env.TELEGRAM_BOT_TOKEN = 'test-token';
// Máy chủ giả lập OpenAI & Gemini (cổng cố định cho test)
process.env.OPENAI_BASE_URL = 'http://127.0.0.1:39901/v1';
process.env.GEMINI_BASE_URL = 'http://127.0.0.1:39901/v1beta';
process.env.TELEGRAM_BOT_USERNAME = 'xastress_bot';
const { server } = require('../server/index.js');
const { maskBadWords, hasCrisisSignal } = require('../server/moderation');

const C = { terms: true, privacy: true, age: true }; // đồng ý Điều khoản khi đăng ký
let base;
before(() => new Promise((r) => server.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); setTimeout(() => process.exit(0), 50); });

function client() {
  let cookie = '';
  const fn = async (p, body, method) => {
    const res = await fetch(base + '/api' + p, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { 'X-Requested-With': 'xastress', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return { status: res.status, data: await res.json() };
  };
  fn.cookie = () => cookie;
  return fn;
}

test('kiểm duyệt ngôn từ & tín hiệu khủng hoảng', () => {
  assert.strictEqual(maskBadWords('mệt vl luôn'), 'mệt v* luôn');
  assert.strictEqual(maskBadWords('vlog hay'), 'vlog hay');
  assert.ok(hasCrisisSignal('Dạo này mình chỉ muốn chết cho xong'));
  assert.ok(!hasCrisisSignal('Hôm nay mệt quá'));
});

test('luồng chính: đăng ký, đăng ẩn danh, động viên, thông báo, quyền riêng tư', async () => {
  const a = client(), b = client();
  let r = await a('/auth/register', { username: 'nguoi_a', password: 'matkhau123', consent: C, nickname: 'Trà Chanh' });
  assert.strictEqual(r.status, 200);
  assert.ok(!('username' in r.data.user), 'không lộ tên đăng nhập');
  r = await b('/auth/register', { username: 'nguoi_b', password: 'matkhau123', consent: C });
  assert.strictEqual(r.status, 200);
  assert.match(r.data.user.nickname, /#\d{4}$/);

  r = await a('/posts', { tableId: 'congviec', mood: 'met', content: 'Deadline dí sát nút, mệt mỏi quá trời', anonymous: true });
  assert.strictEqual(r.status, 200);
  const id = r.data.post.id;

  r = await b(`/posts/${id}`);
  assert.strictEqual(r.data.post.author, null, 'bài ẩn danh không lộ tác giả');
  assert.strictEqual(r.data.post.isMine, false);
  assert.ok(!JSON.stringify(r.data).includes('user_id'));

  r = await b(`/posts/${id}/react`, { kind: 'coLen' });
  assert.strictEqual(r.data.reactions.coLen, 1);
  r = await b(`/posts/${id}/comments`, { content: 'Cố lên bạn ơi!' });
  assert.strictEqual(r.data.post.comments.length, 1);
  r = await a(`/posts/${id}/comments`, { content: 'Cảm ơn mọi người nhiều' });
  assert.strictEqual(r.data.post.comments[1].author, null, 'chủ bài ẩn danh trả lời cũng ẩn danh');

  r = await a('/notifications');
  assert.strictEqual(r.data.unread, 2);

  r = await b(`/posts/${id}`, null, 'DELETE');
  assert.strictEqual(r.status, 404, 'không xoá được bài người khác');
  r = await a(`/posts/${id}/resolve`, {});
  assert.strictEqual(r.data.post.resolved, true);
});

test('báo cáo 3 lần thì tự ẩn; chặn CSRF; sai mật khẩu', async () => {
  const author = client();
  await author('/auth/register', { username: 'tacgia', password: 'matkhau123', consent: C });
  const { data } = await author('/posts', { tableId: 'cuocsong', content: 'Nội dung bị báo cáo thử nghiệm' });
  for (let i = 0; i < 3; i++) {
    const c = client();
    await c('/auth/register', { username: `rp${i}`, password: 'matkhau123', consent: C });
    await c('/report', { type: 'post', id: data.post.id, reason: 'spam' });
  }
  const list = await client()('/posts?table=cuocsong');
  assert.ok(!list.data.posts.some((p) => p.id === data.post.id));

  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' });
  assert.strictEqual(res.status, 403);
  const form = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'a=b' });
  assert.strictEqual(form.status, 415);
  const bad = await client()('/auth/login', { username: 'tacgia', password: 'sai-mat-khau' });
  assert.strictEqual(bad.status, 401);
});

test('xoá tài khoản xoá sạch dữ liệu', async () => {
  const c = client();
  await c('/auth/register', { username: 'xoatoi', password: 'matkhau123', consent: C });
  const { data } = await c('/posts', { tableId: 'tinhcam', content: 'Chuyện tình cảm buồn quá đi mất' });
  const r = await c('/auth/delete', { password: 'matkhau123' });
  assert.strictEqual(r.status, 200);
  const g = await client()(`/posts/${data.post.id}`);
  assert.strictEqual(g.status, 404);
});

// Gọi n ly một món (mỗi ly gọi được tặng kèm 1 ly vào khay)
async function orderN(c, drink, n) { for (let k = 0; k < n; k++) assert.strictEqual((await c('/order', { drink })).status, 200); }

test('luật ly: gọi 1 ly được tặng kèm 1 ly; chỉ tặng được ly trong khay; nhận 100 còn 99, tặng 10 còn 89', async () => {
  const a = client(), b = client(), x = client();
  await a('/auth/register', { username: 'luat_a', password: 'matkhau123', consent: C, nickname: 'Người A' });
  await b('/auth/register', { username: 'luat_b', password: 'matkhau123', consent: C });
  await x('/auth/register', { username: 'luat_x', password: 'matkhau123', consent: C });
  const pa = (await a('/posts', { tableId: 'congviec', content: 'Áp lực công việc quá trời luôn' })).data.post.id;
  const px = (await x('/posts', { tableId: 'cuocsong', content: 'Cuộc sống dạo này bế tắc quá' })).data.post.id;

  // B gọi 1 ly trà đá: miễn phí, kèm 1 ly để tặng
  const o = await b('/order', { drink: 'trada' });
  assert.strictEqual(o.data.plan.text, 'miễn phí');
  assert.strictEqual(o.data.plan.bonus, 1);
  assert.deepStrictEqual(o.data.wallet.tray, { trada: 1 });
  // chỉ tặng được 1 ly dư
  assert.strictEqual((await b(`/posts/${pa}/treat`, { drink: 'trada', qty: 3 })).status, 409);
  assert.strictEqual((await b(`/posts/${pa}/treat`, { drink: 'trada', qty: 1 })).data.left, 0);
  const none = await b(`/posts/${pa}/treat`, { drink: 'trada', qty: 1 });
  assert.strictEqual(none.status, 409);
  assert.ok(none.data.noCups);
  assert.strictEqual((await b(`/posts/${pa}/treat`, { drink: 'caphe', qty: 1 })).status, 409, 'không có cà phê trong khay thì không tặng được');

  // A đã nhận 1 ly (thành "ly của mình"); 11 người khác gọi đủ ly rồi tặng A thêm 99 ly -> tổng 100
  const givers = [];
  for (let i = 0; i < 10; i++) { const g = client(); await g('/auth/register', { username: `luat_g${i}`, password: 'matkhau123', consent: C }); givers.push(g); }
  for (let i = 0; i < 10; i++) {
    const n = i < 9 ? 10 : 9;
    await orderN(givers[i], 'trada', n);
    assert.strictEqual((await givers[i](`/posts/${pa}/treat`, { drink: 'trada', qty: n })).status, 200);
  }
  let w = (await a('/wallet')).data;
  assert.deepStrictEqual(w.glasses, ['trada'], '1 ly là ly của mình để uống');
  assert.deepStrictEqual(w.tray, { trada: 99 }, 'nhận 100 ly -> 99 ly để tặng');
  assert.strictEqual((await a(`/posts/${pa}`)).data.post.treats.counts.trada, 100);
  // A tặng đi 10 ly -> còn 89
  const t = await a(`/posts/${px}/treat`, { drink: 'trada', qty: 10, message: 'Chia bớt trà đá cho bạn nè' });
  assert.strictEqual(t.status, 200);
  assert.strictEqual(t.data.left, 89);
  assert.deepStrictEqual((await a('/wallet')).data.tray, { trada: 89 });
  // người nhận X: 1 ly của mình + 9 ly để tặng
  w = (await x('/wallet')).data;
  assert.deepStrictEqual([w.glasses, w.tray], [['trada'], { trada: 9 }]);
  const n = (await x('/notifications')).data.items.find((it) => it.kind === 'treat:trada');
  assert.strictEqual(n.qty, 10);
  assert.strictEqual(n.message, 'Chia bớt trà đá cho bạn nè');
});

test('mời nước: 101 ly trà đá -> lời đáp hài hước, bộ đếm theo món', async () => {
  const a = client();
  await a('/auth/register', { username: 'moi_a', password: 'matkhau123', consent: C });
  const id = (await a('/posts', { tableId: 'congviec', content: 'Hôm nay bị mắng oan, buồn ghê', anonymous: true })).data.post.id;
  let last;
  for (let i = 0; i < 11; i++) {
    const g = client();
    await g('/auth/register', { username: `moi_g${i}`, password: 'matkhau123', consent: C });
    const n = i < 10 ? 10 : 1;
    await orderN(g, 'trada', n);
    last = await g(`/posts/${id}/treat`, { drink: 'trada', qty: n, message: i === 10 ? 'Bạn không vô dụng đâu, nghỉ chút nhé' : '' });
    assert.strictEqual(last.status, 200);
  }
  assert.strictEqual(last.data.count, 101);
  assert.match(last.data.reply, /101 ly trà đá.*uống hết/);
  const post = (await a(`/posts/${id}`)).data.post;
  assert.deepStrictEqual(post.treats.counts, { trada: 101 });
  assert.ok(post.treatNotes.some((t) => t.message === 'Bạn không vô dụng đâu, nghỉ chút nhé'));
  assert.deepStrictEqual((await a('/wallet')).data.tray, { trada: 100 });
});

test('chặn lời nhắn tiêu cực kèm ly nước (không mất ly)', async () => {
  const a = client(), b = client();
  await a('/auth/register', { username: 'neg_a', password: 'matkhau123', consent: C });
  await b('/auth/register', { username: 'neg_b', password: 'matkhau123', consent: C });
  const { data } = await a('/posts', { tableId: 'giadinh', content: 'Cãi nhau với bố mẹ, mệt mỏi quá' });
  await orderN(b, 'trachanh', 1);
  for (const m of ['Đáng đời, ai bảo không nghe lời', 'Có thế thôi mà cũng than', 'đm cố lên', 'Mày yếu đuối quá']) {
    const r = await b(`/posts/${data.post.id}/treat`, { drink: 'trachanh', message: m });
    assert.strictEqual(r.status, 422, m);
    assert.ok(r.data.blocked && r.data.suggestions.length);
  }
  assert.deepStrictEqual((await b('/wallet')).data.tray, { trachanh: 1 }, 'lời nhắn bị chặn thì ly vẫn còn');
  const ok = await b(`/posts/${data.post.id}/treat`, { drink: 'trachanh', message: 'Đừng nghĩ mình thất bại nhé, thương bạn' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual((await a('/notifications')).data.items.filter((n) => n.kind.startsWith('treat')).length, 1);
});

test('khách mới: 0 xu, 1 phiếu; đang miễn phí thì gọi ly không trừ phiếu; giới hạn ly miễn phí mỗi ngày', async () => {
  const a = client();
  await a('/auth/register', { username: 'vi_a', password: 'matkhau123', consent: C });
  const w = (await a('/wallet')).data;
  assert.strictEqual(w.xu, 0);
  assert.deepStrictEqual(w.vouchers, { self: 1 });
  assert.deepStrictEqual(w.tray, {});
  assert.strictEqual(w.economy.paywall, false);
  assert.strictEqual(w.economy.threshold, 200);
  assert.strictEqual((await a('/wallet/quote?drink=caphe')).data.text, 'miễn phí');
  // AI bật: gọi thêm ly cùng món khi đang uống dở -> cộng lượt, vẫn tặng kèm 1 ly
  const ai = require('../server/ai');
  const orig = ai.isEnabled;
  ai.isEnabled = () => true;
  try {
    const r1 = (await a('/order', { drink: 'nuocdua' })).data;
    const r2 = (await a('/order', { drink: 'nuocdua' })).data;
    assert.strictEqual(r2.pack.id, r1.pack.id);
    assert.strictEqual(r2.pack.turnsLeft, 24);
    assert.strictEqual(r2.wallet.tray.nuocdua, 2);
  } finally { ai.isEnabled = orig; }
  await orderN(a, 'caphe', 8);
  const over = await a('/order', { drink: 'caphe' });
  assert.strictEqual(over.status, 200, 'quá 10 ly miễn phí/ngày vẫn được uống để vào quán');
  assert.strictEqual(over.data.plan.bonus, 0, 'nhưng không kèm ly tặng');
  const w2 = (await a('/wallet')).data;
  assert.deepStrictEqual([w2.tray, w2.vouchers.self], [{ nuocdua: 2, caphe: 8 }, 1]);
});

test('đã thu phí: ly của mình -> phiếu -> xu (mỗi ly gọi vẫn kèm 1 ly tặng); mua xu qua bot Telegram Stars', async () => {
  const config = require('../server/config');
  const economy = require('../server/economy');
  const telegram = require('../server/telegram');
  const a = client(), c = client();
  await a('/auth/register', { username: 'pay_a', password: 'matkhau123', consent: C, nickname: 'Người A' });
  await c('/auth/register', { username: 'pay_c', password: 'matkhau123', consent: C, nickname: 'Người C' });
  const pc = (await c('/posts', { tableId: 'giadinh', content: 'C kể chuyện gia đình rối ren' })).data.post.id;
  await orderN(a, 'tragung', 1);
  await a(`/posts/${pc}/treat`, { drink: 'tragung', qty: 1 }); // C có "ly của mình" trà gừng

  config.paywall.mode = 'on';
  try {
    let q2 = (await c('/wallet/quote?drink=tragung')).data;
    assert.deepStrictEqual([q2.method, q2.bonus], ['glass', 0], 'uống ly của mình, không kèm ly tặng');
    let r = await c('/order', { drink: 'tragung' });
    assert.strictEqual(r.data.plan.text, 'ly của bạn');
    r = await c('/order', { drink: 'caphe' });
    assert.deepStrictEqual([r.data.plan.text, r.data.wallet.tray.caphe], ['phiếu chào mừng', 1]);
    r = await c('/order', { drink: 'caphe' });
    assert.strictEqual(r.status, 402);
    assert.strictEqual(r.data.needXu, 15);

    // Mua xu qua bot Telegram (giả lập Bot API)
    const sent = [];
    telegram.setCaller(async (method, body) => { sent.push({ method, body }); return { message_id: 1 }; });
    const link = await c('/telegram/link', {});
    assert.match(link.data.url, /^https:\/\/t\.me\/xastress_bot\?start=/);
    const code = link.data.url.split('start=')[1];
    const from = { id: 777001 }, chat = { id: 777001 };
    await telegram.handleUpdate({ update_id: 1, message: { chat, from, text: `/start ${code}` } });
    assert.ok(sent.some((x) => x.method === 'sendMessage' && /Đã liên kết/.test(x.body.text)));
    assert.strictEqual((await c('/wallet')).data.telegram.linked, true);
    await telegram.handleUpdate({ update_id: 2, callback_query: { id: 'cb1', from, data: 'buy:vua', message: { chat } } });
    const inv = sent.find((x) => x.method === 'sendInvoice');
    assert.deepStrictEqual([inv.body.currency, inv.body.prices[0].amount], ['XTR', 40]);
    const payload = inv.body.payload;
    await telegram.handleUpdate({ update_id: 3, pre_checkout_query: { id: 'pq1', from, currency: 'XTR', total_amount: 40, invoice_payload: payload } });
    assert.deepStrictEqual(sent.find((x) => x.method === 'answerPreCheckoutQuery').body, { pre_checkout_query_id: 'pq1', ok: true });
    await telegram.handleUpdate({ update_id: 4, pre_checkout_query: { id: 'pq2', from: { id: 999 }, currency: 'XTR', total_amount: 40, invoice_payload: payload } });
    assert.strictEqual(sent.filter((x) => x.method === 'answerPreCheckoutQuery').pop().body.ok, false, 'người lạ không trả vào ví này được');
    const paid = { chat, from, successful_payment: { currency: 'XTR', total_amount: 40, invoice_payload: payload, telegram_payment_charge_id: 'ch_123' } };
    await telegram.handleUpdate({ update_id: 5, message: paid });
    await telegram.handleUpdate({ update_id: 6, message: paid }); // Telegram gửi trùng
    assert.strictEqual((await c('/wallet')).data.xu, 60, 'cộng đúng một lần');

    r = await c('/order', { drink: 'caphe' });
    assert.strictEqual(r.data.plan.text, '15 xu');
    assert.deepStrictEqual([r.data.wallet.xu, r.data.wallet.tray.caphe], [45, 2], 'trả xu vẫn được kèm 1 ly để tặng');
  } finally {
    config.paywall.mode = 'auto';
    economy.resetCache();
  }
});

test('luật "gọi 1 ly mới vào quán" + chat 3 kênh, tin riêng, chặn, động viên, tặng nước trực tiếp (socket)', async () => {
  const config = require('../server/config');
  const { io: ioc } = require('socket.io-client');
  config.seatGate = true;
  const a = client(), b = client();
  await a('/auth/register', { username: 'sock_a', password: 'matkhau123', consent: C, nickname: 'Khách A' });
  await b('/auth/register', { username: 'sock_b', password: 'matkhau123', consent: C, nickname: 'Khách B' });
  const conn = (c) => new Promise((resolve) => {
    const s = ioc(base, { extraHeaders: { Cookie: c.cookie() }, transports: ['websocket'] });
    s.on('world:init', (w) => resolve({ s, me: w.you, init: w }));
  });
  const wait = (s, ev) => new Promise((r) => s.once(ev, r));
  const emit = (s, ev, data) => new Promise((r) => s.emit(ev, data, r));
  const A = await conn(a), B = await conn(b);
  try {
    assert.strictEqual(A.init.seated, false);
    // Chưa gọi ly: không chat, không đăng bài
    let r = await emit(A.s, 'chat', { channel: 'public', text: 'xin chào' });
    assert.ok(r.needOrder);
    r = await a('/posts', { tableId: 'congviec', content: 'Thử đăng bài khi chưa gọi ly' });
    assert.strictEqual(r.status, 403);
    assert.ok(r.data.needOrder);
    // Gọi 1 ly -> được mở khoá (socket nhận 'seated')
    const seatedEvt = wait(A.s, 'seated');
    await a('/order', { drink: 'trada' });
    await seatedEvt;
    assert.strictEqual((await a('/wallet')).data.seated, true);
    await b('/order', { drink: 'tragung' });

    // Chat cả quán
    let got = wait(B.s, 'chat');
    assert.ok((await emit(A.s, 'chat', { channel: 'public', text: 'Chào cả quán!' })).ok);
    assert.strictEqual((await got).text, 'Chào cả quán!');
    // Chat theo bàn: chỉ người đang ở kênh bàn đó nhận
    A.s.emit('chat:join', 'table:congviec');
    const hist = await wait(B.s.emit('chat:join', 'table:congviec') && B.s, 'chat:history');
    assert.strictEqual(hist.channel, 'table:congviec');
    got = wait(B.s, 'chat');
    await new Promise((res) => setTimeout(res, 50));
    assert.ok((await emit(A.s, 'chat', { channel: 'table:congviec', text: 'Bàn công việc đây' })).ok);
    const tm = await got;
    assert.deepStrictEqual([tm.channel, tm.text], ['table:congviec', 'Bàn công việc đây']);

    // Tin riêng
    const bUid = B.init.players.find((p) => p.sid === B.me).uid;
    got = wait(B.s, 'dm');
    r = await emit(A.s, 'dm', { to: bUid, text: 'Chào B, dạo này ổn không?' });
    assert.ok(r.ok);
    assert.strictEqual((await got).text, 'Chào B, dạo này ổn không?');
    const convos = (await b('/dms')).data;
    assert.strictEqual(convos.unread, 1);
    assert.strictEqual(convos.items[0].nickname, 'Khách A');
    const thread = (await b(`/dms/${convos.items[0].uid}`)).data;
    assert.strictEqual(thread.items[0].text, 'Chào B, dạo này ổn không?');
    assert.strictEqual((await b('/dms')).data.unread, 0, 'đọc rồi thì hết chưa đọc');

    // Động viên & an ủi
    got = wait(B.s, 'cheer');
    assert.ok((await emit(A.s, 'cheer', { sid: B.me, kind: 'dongvien' })).ok);
    const ch = await got;
    assert.deepStrictEqual([ch.kind, ch.to.nickname, ch.from.nickname], ['dongvien', 'Khách B', 'Khách A']);
    r = await emit(A.s, 'cheer', { sid: B.me, kind: 'anui', text: 'Đáng đời' });
    assert.ok(r.blocked, 'lời an ủi tiêu cực bị chặn');

    // Tặng nước trực tiếp: A chỉ có 1 ly trà đá để tặng
    r = await emit(A.s, 'gift', { sid: B.me, drink: 'trada', qty: 2 });
    assert.ok(r.noCups);
    got = wait(B.s, 'notify');
    r = await emit(A.s, 'gift', { sid: B.me, drink: 'trada', qty: 1, message: 'Uống cho mát nha' });
    assert.deepStrictEqual([r.ok, r.left], [true, 0]);
    const n = await got;
    assert.deepStrictEqual([n.kind, n.message, n.toGlass], ['gift:trada', 'Uống cho mát nha', 1]);
    const gifts = (await b('/me/treats')).data;
    assert.strictEqual(gifts.treats.counts.trada, 1);
    assert.ok(gifts.notes.some((x) => x.direct && x.message === 'Uống cho mát nha'));

    // Chặn: B chặn A -> A không nhắn riêng, không động viên được
    const aUid = A.init.players.find((p) => p.sid === A.me).uid;
    await b('/blocks', { uid: aUid });
    assert.strictEqual((await emit(A.s, 'dm', { to: bUid, text: 'alo' })).ok, false);
    assert.strictEqual((await emit(A.s, 'cheer', { sid: B.me, kind: 'anui' })).ok, false);
    await b(`/blocks/${aUid}`, null, 'DELETE');
    assert.ok((await emit(A.s, 'dm', { to: bUid, text: 'Hết bị chặn rồi' })).ok);
  } finally {
    A.s.close(); B.s.close();
    config.seatGate = false;
  }
});

test('Cô Tư hoạt náo: trả lời khi được gọi, bình chọn + tổng kết, khơi chuyện, bình luận tâm sự bị bỏ trống', async () => {
  const host = require('../server/host');
  const { io: ioc } = require('socket.io-client');
  const a = client(), b = client();
  await a('/auth/register', { username: 'host_a', password: 'matkhau123', consent: C, nickname: 'Khách Hỏi' });
  await b('/auth/register', { username: 'host_b', password: 'matkhau123', consent: C, nickname: 'Khách Vote' });
  const conn = (c) => new Promise((resolve) => {
    const s = ioc(base, { extraHeaders: { Cookie: c.cookie() }, transports: ['websocket'] });
    s.on('world:init', (w) => resolve({ s, me: w.you }));
  });
  const waitFor = (s, ev, pred) => new Promise((r) => { const f = (x) => { if (pred(x)) { s.off(ev, f); r(x); } }; s.on(ev, f); });
  const emit = (s, ev, data) => new Promise((r) => s.emit(ev, data, r));
  const A = await conn(a), B = await conn(b);
  try {
    // Được gọi tên -> Cô Tư đáp trong chat cả quán
    let got = waitFor(B.s, 'chat', (m) => m.npc);
    await emit(A.s, 'chat', { channel: 'public', text: 'Cô Tư ơi, hôm nay quán có gì vui không?' });
    const rep = await got;
    assert.strictEqual(rep.nickname, 'Cô Tư');
    assert.match(rep.text, /Khách Hỏi/);
    // Gọi tên kèm dấu hiệu khủng hoảng -> trả lời an toàn kèm đường dây nóng
    got = waitFor(B.s, 'chat', (m) => m.npc);
    await emit(A.s, 'chat', { channel: 'public', text: 'cô tư ơi con muốn chết cho xong' });
    assert.match((await got).text, /096 306 1414/);

    // Bình chọn
    got = waitFor(B.s, 'chat', (m) => m.poll);
    const poll = host.startPoll('public', 'Trà đá hay trà chanh?', ['Trà đá', 'Trà chanh']);
    const pm = await got;
    assert.deepStrictEqual(pm.poll.options, ['Trà đá', 'Trà chanh']);
    const upd = waitFor(A.s, 'poll:update', (u) => u.id === poll.id);
    assert.ok((await emit(B.s, 'poll:vote', { id: poll.id, option: 0 })).ok);
    assert.deepStrictEqual((await upd).counts, [1, 0]);
    await emit(A.s, 'poll:vote', { id: poll.id, option: 0 });
    got = waitFor(B.s, 'chat', (m) => m.npc && /Trà đá/.test(m.text) && /2 phiếu/.test(m.text));
    await host.closePoll(poll.id);
    await got;
    assert.strictEqual((await emit(B.s, 'poll:vote', { id: poll.id, option: 1 })).ok, false, 'đã đóng thì không bầu được');

    // Khơi chuyện ở bàn chủ đề
    got = waitFor(A.s, 'chat', (m) => m.npc && m.channel === 'table:hochanh');
    A.s.emit('chat:join', 'table:hochanh');
    await new Promise((r) => setTimeout(r, 50));
    await host.startTopic('table:hochanh', false);
    assert.match((await got).text, /\S/);

    // Tâm sự chưa ai hỏi han -> Cô Tư bình luận trước, có nhãn AI
    const pid = (await a('/posts', { tableId: 'congviec', content: 'Không ai hiểu mình cả, mệt mỏi quá' })).data.post.id;
    assert.ok(await host.commentOnPost(pid));
    const post = (await b(`/posts/${pid}`)).data.post;
    assert.strictEqual(post.comments.length, 1);
    assert.deepStrictEqual([post.comments[0].bot, post.comments[0].author.nickname], [true, 'Cô Tư (AI)']);
    assert.strictEqual(await host.commentOnPost(pid), null, 'đã có bình luận thì không vào nữa');
    assert.ok((await a('/notifications')).data.items.some((n) => n.actor === 'Cô Tư (AI)'));
    // Cô Tư không tính vào số khách của quán (ngưỡng 200 khách)
    const w = (await a('/wallet')).data;
    const humans = require('../server/db').prepare('SELECT COUNT(*) n FROM users WHERE is_bot = 0 AND banned = 0').get().n;
    assert.strictEqual(w.economy.participants, humans);
  } finally { A.s.close(); B.s.close(); }
});

test('trang quản trị: phân quyền, tổng quan, kinh tế, người dùng, Cô Tư; AI chạy bằng ChatGPT (OpenAI API) và Gemini', async () => {
  const http = require('http');
  const seen = [];
  const mock = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const b = JSON.parse(body || '{}');
      const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      const sse = (chunks) => { res.writeHead(200, { 'content-type': 'text/event-stream' }); for (const c of chunks) res.write(`data: ${c}\n\n`); res.end(); };
      if (req.method === 'GET' && req.url.startsWith('/v1/models')) {
        return json({ data: [{ id: 'gpt-new-1', created: 3 }, { id: 'text-embedding-3', created: 2 }, { id: 'gpt-old', created: 1 }] });
      }
      if (req.method === 'GET' && req.url.startsWith('/v1beta/models')) {
        return json({ models: [{ name: 'models/gemini-new-pro', displayName: 'Gemini New Pro', supportedGenerationMethods: ['generateContent'] }, { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] }] });
      }
      if (req.url.startsWith('/v1/chat/completions')) {
        seen.push({ p: 'openai', auth: req.headers.authorization, stream: !!b.stream, fmt: !!b.response_format, model: b.model });
        if (req.headers.authorization !== 'Bearer sk-test-1234') { res.writeHead(401); return res.end('{"error":"bad key"}'); }
        if (b.stream) return sse([JSON.stringify({ choices: [{ delta: { content: 'Cô nghe ' } }] }), JSON.stringify({ choices: [{ delta: { content: 'đây con (GPT).' } }] }), '[DONE]']);
        const content = b.response_format ? JSON.stringify({ verdict: 'ok', reason: 'Tử tế.' }) : 'Chào cả quán! (GPT)';
        return json({ choices: [{ message: { role: 'assistant', content } }] });
      }
      if (req.url.startsWith('/v1beta/models/')) {
        seen.push({ p: 'gemini', key: req.headers['x-goog-api-key'], stream: req.url.includes('stream'), fmt: !!(b.generationConfig && b.generationConfig.responseSchema) });
        if (req.headers['x-goog-api-key'] !== 'gm-test-5678') { res.writeHead(403); return res.end('{}'); }
        const part = (t) => JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: t }] } }] });
        if (req.url.includes(':streamGenerateContent')) return sse([part('Cô nghe '), part('đây con (Gemini).')]);
        const isNeg = /Đáng đời/.test(JSON.stringify(b.contents));
        const t = b.generationConfig ? JSON.stringify({ verdict: isNeg ? 'negative' : 'ok', reason: isNeg ? 'Chê bai.' : 'Tử tế.' }) : 'Chào cả quán! (Gemini)';
        return json({ candidates: [{ content: { parts: [{ text: t }] } }] });
      }
      res.writeHead(404); res.end();
    });
  });
  await new Promise((r) => mock.listen(39901, '127.0.0.1', r));
  const prevAI = process.env.AI_ENABLED;
  delete process.env.AI_ENABLED;
  const admin = client(), user = client();
  await admin('/auth/register', { username: 'quanly', password: 'matkhau123', consent: C, nickname: 'Chủ Quán' });
  await user('/auth/register', { username: 'khach_thuong', password: 'matkhau123', consent: C, nickname: 'Khách Thường' });
  try {
    assert.strictEqual((await user('/admin/overview')).status, 403, 'khách thường không vào được');
    const ov = (await admin('/admin/overview')).data;
    assert.ok(ov.users >= 2 && ov.economy.threshold === 200 && 'online' in ov && 'payments' in ov);

    // ---- ChatGPT qua OpenAI API ----
    let r = await admin('/admin/settings/ai', { provider: 'openai', keys: { openai: 'sk-test-1234' }, models: { openai: 'gpt-test' } });
    assert.strictEqual(r.data.active, 'openai');
    const st = (await admin('/admin/settings')).data;
    assert.strictEqual(st.ai.keys.openai, '••••1234', 'chỉ hiện 4 ký tự cuối');
    assert.ok(!JSON.stringify(st).includes('sk-test-1234'), 'không bao giờ trả khoá ra ngoài');
    assert.ok(!JSON.stringify(require('../server/db').prepare("SELECT value FROM settings WHERE key = 'secrets'").get()).includes('sk-test-1234'), 'khoá được mã hoá trong CSDL');
    r = await admin('/admin/ai/test', {});
    assert.deepStrictEqual([r.data.ok, r.data.provider, r.data.text], [true, 'openai', 'Chào cả quán! (GPT)']);
    // Danh sách model lấy trực tiếp từ nhà cung cấp, lọc bỏ model không phải chat
    const lm = (await admin('/admin/ai/models?provider=openai')).data;
    assert.deepStrictEqual(lm.live.map((m) => m.id), ['gpt-new-1', 'gpt-old']);
    assert.ok((await admin('/admin/settings')).data.ai.recommended.anthropic.some((m) => m.id === 'claude-opus-5-5'));
    // 2 model riêng: tâm sự & hoạt náo/kiểm duyệt
    await admin('/admin/settings/ai', { models: { openai: { chat: 'gpt-chat-x', fast: 'gpt-fast-y' } } });
    await admin('/admin/ai/test', {});
    assert.strictEqual(seen.filter((x) => x.p === 'openai').pop().model, 'gpt-fast-y', 'việc ngắn dùng model hoạt náo');
    assert.strictEqual((await admin('/admin/settings/ai', { models: { openai: { chat: 'bad model!' } } })).status, 400);
    // gói Cô Tư AI trả lời stream bằng GPT
    const o = (await user('/order', { drink: 'trada' })).data;
    const chat = await fetch(`${base}/api/ai/packs/${o.pack.id}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: user.cookie() }, body: JSON.stringify({ message: 'Con mệt quá cô ơi' }) });
    const sseText = await chat.text();
    assert.strictEqual(seen.filter((x) => x.p === 'openai' && x.stream).pop().model, 'gpt-chat-x', 'tâm sự dùng model tâm sự');
    assert.match(sseText, /event: delta\ndata: "Cô nghe "/);
    assert.match(sseText, /event: done/);
    assert.ok(seen.some((x) => x.p === 'openai' && x.stream));

    // ---- Gemini qua Google API ----
    await admin('/admin/settings/ai', { provider: 'gemini', keys: { gemini: 'gm-test-5678' } });
    assert.deepStrictEqual((await admin('/admin/ai/models?provider=gemini')).data.live.map((m) => m.id), ['gemini-new-pro']);
    r = await admin('/admin/ai/test', {});
    assert.deepStrictEqual([r.data.provider, r.data.text], ['gemini', 'Chào cả quán! (Gemini)']);
    const pid = (await admin('/posts', { tableId: 'congviec', content: 'Chủ quán cũng có lúc mệt mỏi chứ' })).data.post.id;
    r = await user(`/posts/${pid}/treat`, { drink: 'trada', message: 'Đáng đời' });
    assert.strictEqual(r.status, 422, 'Gemini phân loại lời nhắn tiêu cực');
    assert.ok(seen.some((x) => x.p === 'gemini' && x.fmt), 'gửi kèm schema JSON cho Gemini');
    const o2 = (await user('/order', { drink: 'tragung' })).data;
    const chat2 = await (await fetch(`${base}/api/ai/packs/${o2.pack.id}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: user.cookie() }, body: JSON.stringify({ message: 'alo cô' }) })).text();
    assert.match(chat2, /Gemini/);
    // khoá sai -> nút thử báo lỗi rõ ràng
    await admin('/admin/settings/ai', { keys: { gemini: 'sai-khoa' } });
    r = await admin('/admin/ai/test', {});
    assert.strictEqual(r.status, 502);
    assert.match(r.data.error, /gemini/);

    // ---- Kinh tế ----
    r = await admin('/admin/settings/economy', { paywall: { mode: 'on' }, prices: { caphe: 20 } });
    assert.strictEqual(r.data.economy.paywall, true);
    assert.strictEqual(r.data.economy.prices.caphe, 20);
    assert.strictEqual((await user('/wallet/quote?drink=caphe')).data.text, 'phiếu chào mừng', 'khách mới vẫn còn phiếu');
    await admin('/admin/settings/economy', { paywall: { mode: 'auto' }, prices: { caphe: 15 } });
    assert.strictEqual((await user('/wallet')).data.economy.paywall, false);

    // ---- Người dùng ----
    const users = (await admin('/admin/users?q=Khách Thường')).data.items;
    assert.strictEqual(users.length, 1);
    assert.ok(!('username' in users[0]), 'không lộ tên đăng nhập');
    r = await admin(`/admin/users/${users[0].id}/xu`, { delta: 50 });
    assert.strictEqual(r.data.xu, 50);
    await admin(`/admin/users/${users[0].id}/ban`, { banned: true });
    assert.strictEqual((await user('/wallet')).status, 401, 'bị khoá thì mất phiên đăng nhập');
    await admin(`/admin/users/${users[0].id}/ban`, { banned: false });

    // ---- Điều khiển Cô Tư ----
    assert.ok((await admin('/admin/cotu/say', { text: 'Tối nay quán mở tới khuya nha các con!' })).data.ok);
    assert.ok((await admin('/admin/cotu/poll', { question: 'Trà đá hay trà chanh?', options: ['Trà đá', 'Trà chanh'] })).data.ok);
    const hist = (await admin('/admin/chat?channel=public')).data.items;
    assert.ok(hist.some((m) => m.npc && /mở tới khuya/.test(m.text)));
    assert.ok(hist.some((m) => m.poll && m.poll.question === 'Trà đá hay trà chanh?'));
    r = await admin('/admin/settings/cotu', { enabled: false, quietMinutes: 10 });
    assert.deepStrictEqual([r.data.cotu.enabled, require('../server/config').cotu.quietMinutes], [false, 10]);
    assert.strictEqual((await admin('/admin/settings/cotu', { quietMinutes: -1 })).status, 400);
  } finally {
    await admin('/admin/settings/ai', { provider: 'none' });
    if (prevAI !== undefined) process.env.AI_ENABLED = prevAI;
    mock.close();
  }
});

test('nền tảng thanh toán: VietQR, webhook SePay, chuyển thiếu, trùng, xác nhận tay, hoàn tiền, gán giao dịch, sổ cái', async () => {
  const vietqr = require('../server/vietqr');
  assert.strictEqual(vietqr.crc16('123456789'), '29B1', 'CRC16-CCITT chuẩn EMVCo');
  const pl = vietqr.payload({ bin: '970436', account: '0011001234567', amount: 50000, memo: 'XSABCDEFGH' });
  assert.ok(pl.startsWith('000201010212') && pl.includes('0006970436') && pl.includes('540550000') && pl.includes('0810XSABCDEFGH'));

  const admin = client(), u = client(), other = client();
  await admin('/auth/login', { username: 'quanly', password: 'matkhau123' });
  await u('/auth/register', { username: 'mua_xu', password: 'matkhau123', consent: C, nickname: 'Người Mua' });
  await other('/auth/register', { username: 'mua_xu_2', password: 'matkhau123', consent: C });
  assert.strictEqual((await u('/admin/pay/summary')).status, 403);

  // Chưa cấu hình ngân hàng / đang miễn phí
  let r = await u('/pay/orders', { package: 'vua' });
  assert.strictEqual(r.status, 400, 'đang miễn phí thì chưa cần nạp');
  r = await admin('/admin/pay/settings', { bank: { bin: '970436', account: '0011001234567', name: 'Nguyen Van A' }, sepayKey: 'sepay-secret-123', allowBeforePaywall: true, expiryMinutes: 30 });
  assert.match(r.data.preview, /^data:image\/png;base64,/);
  const ps = (await admin('/admin/pay/settings')).data;
  assert.deepStrictEqual([ps.bank.name, ps.sepayKey], ['NGUYEN VAN A', '••••-123']);

  // Tạo đơn chuyển khoản
  const info = (await u('/pay/info')).data;
  assert.deepStrictEqual([info.canBuy, info.methods.bank], [true, true]);
  const vua = info.packages.find((p) => p.id === 'vua');
  r = await u('/pay/orders', { package: 'vua' });
  const o1 = r.data.order;
  assert.match(o1.code, /^XS[A-HJ-NP-Z2-9]{8}$/);
  assert.deepStrictEqual([o1.amount, o1.xu, o1.status, o1.bank.name], [vua.vnd, vua.xu, 'pending', 'Vietcombank']);
  assert.match(o1.qr, /^data:image\/png/);
  assert.strictEqual((await u('/pay/orders', { package: 'vua' })).data.order.id, o1.id, 'gói giống nhau -> dùng lại đơn đang chờ');

  const hook = (key, body) => fetch(`${base}/api/pay/webhook/sepay`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Apikey ${key}` }, body: JSON.stringify(body) });
  assert.strictEqual((await hook('sai', { id: 1, transferType: 'in', transferAmount: vua.vnd, content: o1.code })).status, 401);
  // Chuyển thiếu -> không cộng xu, ghi nhận để đối soát
  let h = await (await hook('sepay-secret-123', { id: 101, transferType: 'in', transferAmount: 1000, content: o1.code })).json();
  assert.strictEqual(h.matched, false);
  // Đủ tiền, nội dung bị ngân hàng chèn dấu cách / viết thường
  const messy = `MBVCB.3278907 ${o1.code.slice(0, 4).toLowerCase()} ${o1.code.slice(4)} chuyen tien`;
  h = await (await hook('sepay-secret-123', { id: 102, transferType: 'in', transferAmount: vua.vnd, content: messy })).json();
  assert.strictEqual(h.matched, true);
  assert.strictEqual((await u(`/pay/orders/${o1.id}`)).data.order.status, 'paid');
  assert.strictEqual((await u('/wallet')).data.xu, vua.xu);
  h = await (await hook('sepay-secret-123', { id: 102, transferType: 'in', transferAmount: vua.vnd, content: messy })).json();
  assert.ok(h.duplicate, 'SePay gửi lại -> không cộng 2 lần');
  assert.strictEqual((await u('/wallet')).data.xu, vua.xu);

  // Xác nhận tay
  const nho = info.packages.find((p) => p.id === 'nho');
  const o2 = (await u('/pay/orders', { package: 'nho' })).data.order;
  assert.ok((await admin(`/admin/pay/orders/${o2.id}/confirm`, {})).data.order.status === 'paid');
  assert.strictEqual((await admin(`/admin/pay/orders/${o2.id}/confirm`, {})).status, 400, 'không xác nhận 2 lần');
  assert.strictEqual((await u('/wallet')).data.xu, vua.xu + nho.xu);

  // Hoàn tiền: thu hồi xu
  await admin(`/admin/pay/orders/${o1.id}/refund`, {});
  assert.strictEqual((await u('/wallet')).data.xu, nho.xu);

  // Giao dịch ghi sai nội dung -> admin gán vào đơn
  const o3 = (await other('/pay/orders', { package: 'nho' })).data.order;
  h = await (await hook('sepay-secret-123', { id: 103, transferType: 'in', transferAmount: nho.vnd, content: 'ck mua xu cho ban' })).json();
  assert.strictEqual(h.matched, false);
  const tx = (await admin('/admin/pay/bank-tx')).data.items.find((t) => t.provider_ref === 'sepay:103');
  assert.ok((await admin(`/admin/pay/bank-tx/${tx.id}/assign`, { orderId: o3.id })).data.order.status === 'paid');
  assert.strictEqual((await other('/wallet')).data.xu, nho.xu);

  // Huỷ đơn chờ của mình
  const o4 = (await other('/pay/orders', { package: 'to' })).data.order;
  assert.strictEqual((await other(`/pay/orders/${o4.id}/cancel`, {})).data.order.status, 'cancelled');
  assert.strictEqual((await u(`/pay/orders/${o4.id}/cancel`, {})).status, 404, 'không huỷ đơn người khác');

  // Sổ cái & báo cáo
  const ledger = (await u('/me/ledger')).data.items;
  assert.deepStrictEqual(ledger.map((x) => x.delta), [-vua.xu, nho.xu, vua.xu]);
  assert.ok(ledger[0].reason.includes('Hoàn tiền'));
  const sm = (await admin('/admin/pay/summary')).data;
  assert.strictEqual(sm.vndTotal, 2 * nho.vnd, 'đơn đã hoàn không tính doanh thu');
  assert.ok(sm.unmatched >= 2 && sm.refunded === 1);
  // Admin chỉnh gói xu
  r = await admin('/admin/pay/settings', { packages: [{ id: 'nho', label: '25 xu', xu: 25, vnd: 20000, stars: 15 }, { id: 'to', label: '200 xu', xu: 200, vnd: 120000, stars: 100 }] });
  assert.ok(r.data.ok);
  assert.deepStrictEqual((await u('/pay/info')).data.packages.map((p) => p.xu), [25, 200]);
  assert.strictEqual((await admin('/admin/pay/settings', { packages: [{ id: 'x', xu: 10, vnd: 10 }] })).status, 400);
});

test('pháp lý & tài khoản: đồng ý điều khoản, mã khôi phục, tải dữ liệu, xác thực 2 bước cho quản trị', async () => {
  const totp = require('../server/totp');
  const a = client();
  // thiếu đồng ý -> bị từ chối
  let r = await a('/auth/register', { username: 'phaply_a', password: 'matkhau123' });
  assert.strictEqual(r.status, 400);
  r = await a('/auth/register', { username: 'phaply_a', password: 'matkhau123', consent: C });
  assert.strictEqual(r.status, 200);
  assert.match(r.data.recoveryCode, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
  const code1 = r.data.recoveryCode;
  r = await a('/auth/me');
  assert.strictEqual(r.data.needsConsent, false);
  assert.strictEqual(r.data.hasRecovery, true);
  // tải dữ liệu của tôi
  await a('/posts', { tableId: 'congviec', mood: 'met', content: 'Hôm nay mệt quá trời luôn', anonymous: true });
  r = await a('/me/export');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.account.username, 'phaply_a');
  assert.strictEqual(r.data.posts.length, 1);
  assert.ok(!('pass_hash' in r.data.account) && !('recovery_hash' in r.data.account));
  // quên mật khẩu: mã sai / mã đúng (viết thường, không gạch) / mã cũ hết hiệu lực
  const b = client();
  r = await b('/auth/recover', { username: 'phaply_a', code: 'AAAA-BBBB-CCCC-DDDD', newPassword: 'matkhaumoi1' });
  assert.strictEqual(r.status, 401);
  r = await b('/auth/recover', { username: 'phaply_a', code: code1.toLowerCase().replace(/-/g, ''), newPassword: 'matkhaumoi1' });
  assert.strictEqual(r.status, 200);
  assert.notStrictEqual(r.data.recoveryCode, code1);
  r = await b('/auth/recover', { username: 'phaply_a', code: code1, newPassword: 'matkhaumoi2' });
  assert.strictEqual(r.status, 401);
  r = await client()('/auth/login', { username: 'phaply_a', password: 'matkhaumoi1' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual((await a('/auth/me')).data.user, null, 'phiên cũ bị đăng xuất sau khi đổi mật khẩu');

  // thông tin pháp lý công khai + quản trị điền thông tin
  const ad = client();
  await ad('/auth/login', { username: 'quanly', password: 'matkhau123' });
  r = await ad('/admin/legal', { operator: 'Hộ kinh doanh Trà Đá', email: 'hotro@vidu.vn' });
  assert.strictEqual(r.status, 200);
  r = await client()('/site-info');
  assert.strictEqual(r.data.operator, 'Hộ kinh doanh Trà Đá');
  assert.strictEqual(r.data.minAge, 16);
  assert.strictEqual((await ad('/admin/legal', { email: 'khong-phai-email' })).status, 400);

  // bật xác thực 2 bước
  r = await ad('/admin/mfa/setup', {});
  assert.match(r.data.url, /^otpauth:\/\/totp\//);
  const secret = r.data.secret;
  const now = () => totp.codeAt(secret, Math.floor(Date.now() / 30000));
  assert.strictEqual((await ad('/admin/mfa/enable', { code: '000000' === now() ? '111111' : '000000' })).status, 400);
  assert.strictEqual((await ad('/admin/mfa/enable', { code: now() })).status, 200);
  assert.strictEqual((await ad('/admin/overview')).status, 200, 'phiên vừa bật vẫn dùng tiếp được');
  // đăng nhập lại: chưa nhập mã thì không vào được trang quản trị, cũng không còn quyền admin ở nơi khác
  const ad2 = client();
  await ad2('/auth/login', { username: 'quanly', password: 'matkhau123' });
  r = await ad2('/admin/overview');
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.data.mfa, true);
  r = await ad2('/auth/me');
  assert.strictEqual(r.data.user.isAdmin, false);
  assert.strictEqual(r.data.user.adminMfa, true);
  // mã đã dùng ở trên (cùng bước thời gian) không dùng lại được -> lấy mã của bước kế tiếp
  const next = totp.codeAt(secret, Math.floor(Date.now() / 30000) + 1);
  assert.strictEqual((await ad2('/auth/mfa/verify', { code: next })).status, 200);
  assert.strictEqual((await ad2('/admin/overview')).status, 200);
  assert.strictEqual((await ad2('/auth/me')).data.user.isAdmin, true);

  // sao lưu thủ công
  r = await ad2('/admin/backup', {});
  assert.strictEqual(r.status, 200);
  assert.match(r.data.last.file, /^xastress-.*\.db$/);
});
