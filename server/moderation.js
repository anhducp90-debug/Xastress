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

module.exports = { maskBadWords, hasCrisisSignal, clean };
