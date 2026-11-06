'use strict';
// Tạo mã VietQR (chuẩn EMVCo / NAPAS 247) để chuyển khoản đúng số tiền + nội dung.
// Mọi app ngân hàng Việt Nam quét được. Tạo ngay trên máy chủ, không gọi dịch vụ ngoài.
const QRCode = require('qrcode');

// Một số ngân hàng phổ biến (mã BIN NAPAS). Ngân hàng khác: nhập mã BIN 6 số trên trang quản trị.
const BANKS = [
  { bin: '970436', name: 'Vietcombank' }, { bin: '970415', name: 'VietinBank' }, { bin: '970418', name: 'BIDV' },
  { bin: '970405', name: 'Agribank' }, { bin: '970407', name: 'Techcombank' }, { bin: '970422', name: 'MB Bank' },
  { bin: '970416', name: 'ACB' }, { bin: '970432', name: 'VPBank' }, { bin: '970423', name: 'TPBank' },
  { bin: '970403', name: 'Sacombank' }, { bin: '970441', name: 'VIB' }, { bin: '970443', name: 'SHB' },
  { bin: '970437', name: 'HDBank' }, { bin: '970448', name: 'OCB' }, { bin: '970426', name: 'MSB' },
  { bin: '970440', name: 'SeABank' }, { bin: '970431', name: 'Eximbank' }, { bin: '970449', name: 'LPBank' },
];

const tlv = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

// CRC16-CCITT (khởi tạo 0xFFFF, đa thức 0x1021) theo chuẩn EMVCo
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** bin: mã BIN ngân hàng (6 số), account: số tài khoản, amount: số tiền VND, memo: nội dung (chữ/số không dấu) */
function payload({ bin, account, amount, memo }) {
  if (!/^\d{6}$/.test(bin)) throw new Error('Mã BIN ngân hàng phải gồm 6 chữ số.');
  if (!/^[0-9A-Za-z]{4,19}$/.test(account)) throw new Error('Số tài khoản không hợp lệ.');
  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', account)) + tlv('02', 'QRIBFTTA');
  let s = tlv('00', '01') + tlv('01', amount ? '12' : '11') + tlv('38', merchant) + tlv('53', '704');
  if (amount) s += tlv('54', String(Math.round(amount)));
  s += tlv('58', 'VN');
  if (memo) s += tlv('62', tlv('08', memo.replace(/[^0-9A-Za-z ]/g, '').slice(0, 25)));
  s += '6304';
  return s + crc16(s);
}

async function dataUrl(opts) {
  return QRCode.toDataURL(payload(opts), { margin: 1, width: 320, errorCorrectionLevel: 'M' });
}

module.exports = { BANKS, payload, dataUrl, crc16 };
