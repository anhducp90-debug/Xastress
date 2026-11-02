'use strict';
// Mỗi bàn trong quán là một chủ đề tâm sự
const TABLES = {
  congviec: 'Bàn Công Việc',
  giadinh: 'Bàn Gia Đình',
  tinhcam: 'Bàn Tình Cảm',
  hochanh: 'Bàn Học Hành',
  tienbac: 'Bàn Cơm Áo Gạo Tiền',
  cuocsong: 'Bàn Chuyện Đời',
};
const MOODS = ['met', 'buon', 'tuc', 'lo', 'chan', 'ap_luc'];
const REACTIONS = ['dongcam', 'coLen', 'om'];
// Menu nước quán Cô Tư (khớp public/js/menu.js). price: giá gói AI tính bằng xu
const DRINK_INFO = {
  trada: { name: 'trà đá', price: 3 },
  tragung: { name: 'trà gừng', price: 10 },
  nuocsau: { name: 'nước sấu', price: 12 },
  caphe: { name: 'cà phê đen', price: 15 },
  daunanh: { name: 'sữa đậu nành', price: 8 },
  nuocdua: { name: 'nước dừa', price: 20 },
  trachanh: { name: 'trà chanh', price: 10 },
  nuocmia: { name: 'nước mía', price: 5 },
};
const DRINKS = Object.keys(DRINK_INFO);
const ECONOMY = {
  packTurns: 12, packHours: 24, // một ly = gói 12 lượt tâm sự với Cô Tư AI trong 24 giờ
  welcomeSelf: 1, welcomeGift: 1, // khách mới: 1 ly miễn phí cho mình + 1 ly để tặng
};
// Gói xu bán qua bot Telegram, thanh toán bằng Telegram Stars (XTR)
const XU_PACKAGES = [
  { id: 'nho', xu: 20, stars: 15, label: '20 xu' },
  { id: 'vua', xu: 60, stars: 40, label: '60 xu (+20%)' },
  { id: 'to', xu: 150, stars: 90, label: '150 xu (+40%)' },
];
const AVATAR = {
  skin: 4, hairColor: 6, hairStyle: 4, shirt: 8, pants: 4, hat: 3,
};
module.exports = { TABLES, MOODS, REACTIONS, DRINKS, DRINK_INFO, ECONOMY, XU_PACKAGES, AVATAR };
