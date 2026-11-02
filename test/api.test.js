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
const { server } = require('../server/index.js');
const { maskBadWords, hasCrisisSignal } = require('../server/moderation');

let base;
before(() => new Promise((r) => server.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); setTimeout(() => process.exit(0), 50); });

function client() {
  let cookie = '';
  return async (p, body, method) => {
    const res = await fetch(base + '/api' + p, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { 'X-Requested-With': 'xastress', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return { status: res.status, data: await res.json() };
  };
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

test('mời nước: 101 ly trà đá, lời đáp hài hước, bộ đếm theo món, thông báo kèm lời nhắn, tặng xu', async () => {
  const a = client();
  await a('/auth/register', { username: 'moi_a', password: 'matkhau123' });
  const { data } = await a('/posts', { tableId: 'congviec', content: 'Hôm nay bị mắng oan, buồn ghê', anonymous: true });
  const id = data.post.id;
  const xu0 = (await a('/wallet')).data.xu;

  const givers = [];
  for (let i = 0; i < 6; i++) {
    const g = client();
    await g('/auth/register', { username: `moi_g${i}`, password: 'matkhau123', nickname: `Khách Mời ${i}` });
    givers.push(g);
  }
  assert.strictEqual((await givers[0](`/posts/${id}/treat`, { drink: 'bia' })).status, 400);
  assert.strictEqual((await a(`/posts/${id}/treat`, { drink: 'trada' })).status, 400, 'không tự mời');
  let last;
  for (let i = 0; i < 5; i++) {
    for (let k = 0; k < 2; k++) {
      last = await givers[i](`/posts/${id}/treat`, { drink: 'trada', qty: 10, message: k ? '' : 'Cố lên bạn ơi, mình hiểu mà' });
      assert.strictEqual(last.status, 200);
    }
  }
  assert.strictEqual((await givers[0](`/posts/${id}/treat`, { drink: 'trada', qty: 1 })).status, 429, 'tối đa 20 ly/người/ngày cho một tâm sự');
  last = await givers[5](`/posts/${id}/treat`, { drink: 'trada', qty: 1, message: 'Bạn không vô dụng đâu, nghỉ chút nhé' });
  assert.strictEqual(last.status, 200, 'lời tử tế có chữ phủ định vẫn được gửi');
  assert.strictEqual(last.data.count, 101);
  assert.match(last.data.reply, /101 ly trà đá/);
  assert.match(last.data.reply, /uống hết/);
  await givers[5](`/posts/${id}/treat`, { drink: 'tragung', qty: 3 });

  const post = (await a(`/posts/${id}`)).data.post;
  assert.deepStrictEqual(post.treats.counts, { trada: 101, tragung: 3 });
  assert.strictEqual(post.treats.total, 104);
  assert.ok(post.treatNotes.some((t) => t.message === 'Bạn không vô dụng đâu, nghỉ chút nhé'));

  const notifs = (await a('/notifications')).data.items;
  assert.ok(notifs.some((n) => n.kind === 'treat:trada' && n.qty === 10 && n.message === 'Cố lên bạn ơi, mình hiểu mà'));
  const mine = (await a('/me/treats')).data;
  assert.strictEqual(mine.treats.counts.trada, 101);
  assert.strictEqual((await a('/wallet')).data.xu, xu0 + 20, 'người được mời nhận xu, tối đa 20 xu/ngày');
});

test('chặn lời nhắn tiêu cực kèm ly nước', async () => {
  const a = client(), b = client();
  await a('/auth/register', { username: 'neg_a', password: 'matkhau123' });
  await b('/auth/register', { username: 'neg_b', password: 'matkhau123' });
  const { data } = await a('/posts', { tableId: 'giadinh', content: 'Cãi nhau với bố mẹ, mệt mỏi quá' });
  for (const m of ['Đáng đời, ai bảo không nghe lời', 'Có thế thôi mà cũng than', 'đm cố lên', 'Mày yếu đuối quá']) {
    const r = await b(`/posts/${data.post.id}/treat`, { drink: 'trachanh', message: m });
    assert.strictEqual(r.status, 422, m);
    assert.ok(r.data.blocked && r.data.suggestions.length);
  }
  const ok = await b(`/posts/${data.post.id}/treat`, { drink: 'trachanh', message: 'Đừng nghĩ mình thất bại nhé, thương bạn' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual((await a('/notifications')).data.items.filter((n) => n.kind.startsWith('treat')).length, 1, 'lời nhắn bị chặn không tạo thông báo');
});

test('ví xu & gói Cô Tư AI', async () => {
  const a = client();
  const r = await a('/auth/register', { username: 'vi_a', password: 'matkhau123' });
  assert.strictEqual(r.status, 200);
  const w = (await a('/wallet')).data;
  assert.strictEqual(w.xu, 30);
  assert.strictEqual(w.dailyAvailable, true);
  assert.strictEqual((await a('/wallet/daily', {})).data.xu, 40);
  assert.strictEqual((await a('/wallet/daily', {})).status, 409);
  const st = (await a('/ai/status')).data;
  assert.strictEqual(st.prices.trada, 3);
  // Môi trường test không có khoá API -> AI tắt, không trừ xu
  if (!st.enabled) {
    assert.strictEqual((await a('/ai/packs', { drink: 'tragung' })).status, 503);
    assert.strictEqual((await a('/wallet')).data.xu, 40);
  }
});
