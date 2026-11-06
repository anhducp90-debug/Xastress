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
process.env.SEAT_GATE = '0'; // test riêng bên dưới bật lại luật "gọi ly mới vào quán"
process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.TELEGRAM_BOT_USERNAME = 'xastress_bot';
const { server } = require('../server/index.js');
const { maskBadWords, hasCrisisSignal } = require('../server/moderation');

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
  let r = await a('/auth/register', { username: 'nguoi_a', password: 'matkhau123', nickname: 'Trà Chanh' });
  assert.strictEqual(r.status, 200);
  assert.ok(!('username' in r.data.user), 'không lộ tên đăng nhập');
  r = await b('/auth/register', { username: 'nguoi_b', password: 'matkhau123' });
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
  await author('/auth/register', { username: 'tacgia', password: 'matkhau123' });
  const { data } = await author('/posts', { tableId: 'cuocsong', content: 'Nội dung bị báo cáo thử nghiệm' });
  for (let i = 0; i < 3; i++) {
    const c = client();
    await c('/auth/register', { username: `rp${i}`, password: 'matkhau123' });
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
  await c('/auth/register', { username: 'xoatoi', password: 'matkhau123' });
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
  await a('/auth/register', { username: 'luat_a', password: 'matkhau123', nickname: 'Người A' });
  await b('/auth/register', { username: 'luat_b', password: 'matkhau123' });
  await x('/auth/register', { username: 'luat_x', password: 'matkhau123' });
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
  for (let i = 0; i < 10; i++) { const g = client(); await g('/auth/register', { username: `luat_g${i}`, password: 'matkhau123' }); givers.push(g); }
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
  await a('/auth/register', { username: 'moi_a', password: 'matkhau123' });
  const id = (await a('/posts', { tableId: 'congviec', content: 'Hôm nay bị mắng oan, buồn ghê', anonymous: true })).data.post.id;
  let last;
  for (let i = 0; i < 11; i++) {
    const g = client();
    await g('/auth/register', { username: `moi_g${i}`, password: 'matkhau123' });
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
  await a('/auth/register', { username: 'neg_a', password: 'matkhau123' });
  await b('/auth/register', { username: 'neg_b', password: 'matkhau123' });
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
  await a('/auth/register', { username: 'vi_a', password: 'matkhau123' });
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
  await a('/auth/register', { username: 'pay_a', password: 'matkhau123', nickname: 'Người A' });
  await c('/auth/register', { username: 'pay_c', password: 'matkhau123', nickname: 'Người C' });
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
  await a('/auth/register', { username: 'sock_a', password: 'matkhau123', nickname: 'Khách A' });
  await b('/auth/register', { username: 'sock_b', password: 'matkhau123', nickname: 'Khách B' });
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
