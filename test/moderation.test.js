'use strict';
const test = require('node:test');
const assert = require('node:assert');
const m = require('../server/moderation');

test('ẩn số điện thoại, link, email, @tài khoản nhưng giữ số tiền, ngày tháng, đường dây hỗ trợ', () => {
  const H = '[🔒 đã ẩn liên hệ]';
  assert.strictEqual(m.sanitize('liên hệ zalo 0912 345 678'), `liên hệ zalo ${H}`);
  assert.strictEqual(m.sanitize('+84 912345678'), H);
  assert.strictEqual(m.sanitize('vào abc.com/km nhé'), `vào ${H} nhé`);
  assert.strictEqual(m.sanitize('https://x.vn/a'), H);
  assert.strictEqual(m.sanitize('mail a.b@gmail.com'), `mail ${H}`);
  assert.strictEqual(m.sanitize('ib @shopgiare99'), `ib ${H}`);
  for (const ok of ['nợ 100.000.000', 'ngày 12.11.2024 lúc 21h', 'Ngày Mai 096 306 1414', 'làm ở Q.1']) assert.strictEqual(m.sanitize(ok), ok);
  assert.strictEqual(m.screenKindMessage('cố lên, add zalo 0987654321').hard, true);
  assert.strictEqual(m.screenKindMessage('cố lên nha bạn').ok, true);
});
