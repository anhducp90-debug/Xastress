'use strict';
// Bộ lọc ngôn từ & phát hiện dấu hiệu khủng hoảng.
// Danh sách có chủ đích ngắn gọn; bổ sung dần theo thực tế cộng đồng.

const BAD_WORDS = [
  'đm', 'đmm', 'dm', 'dmm', 'đcm', 'dcm', 'vcl', 'vkl', 'vl', 'clgt', 'cc', 'cmm', 'cmn',
  'địt', 'đụ', 'đéo', 'lồn', 'cặc', 'buồi', 'đĩ', 'óc chó', 'con chó', 'thằng chó', 'súc vật', 'mẹ mày',
];
const CRISIS = [
  'tự tử', 'tự sát', 'muốn chết', 'không muốn sống', 'chẳng muốn sống', 'kết thúc cuộc đời',
  'kết liễu', 'chết quách', 'nhảy cầu', 'uống thuốc ngủ', 'rạch tay', 'cắt tay', 'không thiết sống',
  'chán sống', 'giải thoát bản thân', 'biến mất mãi mãi',
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Ranh giới từ hỗ trợ Unicode (tiếng Việt có dấu)
const badRe = new RegExp(`(?<![\\p{L}\\p{N}])(${BAD_WORDS.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
const crisisRe = new RegExp(CRISIS.map(esc).join('|'), 'iu');

function maskBadWords(text) {
  return text.replace(badRe, (w) => w[0] + '*'.repeat(Math.max(1, [...w].length - 1)));
}
function hasCrisisSignal(text) {
  return crisisRe.test(text.normalize('NFC').toLowerCase());
}
// Chuẩn hoá & làm sạch input văn bản
function clean(text, max) {
  if (typeof text !== 'string') return '';
  return text
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

// ---- Lời nhắn kèm ly nước: chỉ cho phép lời tử tế ----
// Cụm từ phán xét, chê bai, mỉa mai, xua đuổi thường gặp
const NEGATIVE = [
  'đáng đời', 'đáng kiếp', 'chết đi', 'đi chết', 'tự tử đi', 'biến đi', 'cút', 'xéo', 'im đi', 'im mồm',
  'vô dụng', 'yếu đuối', 'yếu đuối thế', 'hèn', 'thảm hại', 'thất bại', 'ăn hại', 'phế vật', 'đồ bỏ đi',
  'ngu', 'đần', 'ngốc', 'óc', 'não cá vàng', 'khùng', 'điên', 'thần kinh',
  'làm quá', 'làm lố', 'có thế thôi', 'có vậy thôi', 'có thế mà', 'chuyện nhỏ mà cũng', 'than vãn', 'than thở hoài', 'kêu ca',
  'tự làm tự chịu', 'tự chuốc', 'ai bảo', 'kệ bạn', 'kệ mày', 'mặc kệ', 'ai quan tâm', 'ai thèm', 'liên quan gì',
  'nhảm', 'xàm', 'vớ vẩn', 'câu like', 'câu view', 'giả tạo', 'drama', 'ảo tưởng', 'nực cười', 'buồn cười thật',
  'ghét', 'khinh', 'tởm', 'kinh tởm', 'hãm', 'mày', 'tao',
];
const NEGATORS = /(không|chẳng|chả|đâu có|đừng|ko|k|hông|chưa bao giờ|đâu phải|không phải|chẳng phải)\s+(\p{L}+\s+){0,2}$/iu;
const negRe = new RegExp(`(?<![\\p{L}\\p{N}])(${NEGATIVE.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'giu');

/**
 * Kiểm tra lời nhắn kèm ly nước.
 * Trả về { ok, hard, hits }:
 *  - hard=true: có từ thô tục -> chặn luôn
 *  - hits: các cụm tiêu cực KHÔNG bị phủ định (vd "bạn không vô dụng đâu" là lời tốt)
 */
function screenKindMessage(text) {
  const t = text.normalize('NFC');
  if (maskBadWords(t) !== t) return { ok: false, hard: true, hits: ['ngôn từ thô tục'] };
  const hits = [];
  for (const m of t.matchAll(negRe)) {
    const before = t.slice(Math.max(0, m.index - 24), m.index);
    if (!NEGATORS.test(before)) hits.push(m[0]);
  }
  return { ok: hits.length === 0, hard: false, hits };
}

module.exports = { maskBadWords, hasCrisisSignal, clean, screenKindMessage };
