'use strict';
// Kiểm tra lời nhắn tử tế (kèm ly nước, lời động viên): từ khoá + Claude phân loại nếu có AI.
const { screenKindMessage } = require('./moderation');
const ai = require('./ai');

const KIND_SUGGEST = [
  'Mình hiểu cảm giác này, bạn không một mình đâu.', 'Bạn đã cố gắng nhiều lắm rồi.',
  'Nghỉ ngơi chút đi, mọi chuyện rồi sẽ ổn.', 'Uống ly nước cho mát, rồi mình tính tiếp nha.',
];

async function checkKind(message) {
  const local = screenKindMessage(message);
  if (local.hard) return { ok: false, reason: 'Lời nhắn có từ ngữ thô tục.' };
  if (ai.isEnabled()) {
    try {
      const r = await ai.classifyKindMessage(message);
      return { ok: r.verdict === 'ok', reason: r.reason };
    } catch (err) {
      console.warn('Phân loại lời nhắn bằng AI lỗi, dùng bộ lọc từ khoá:', err.status || err.name);
    }
  }
  return { ok: local.ok, reason: local.ok ? '' : `Có cụm từ dễ làm người nhận buồn lòng: "${local.hits.join('", "')}".` };
}

module.exports = { checkKind, KIND_SUGGEST };
