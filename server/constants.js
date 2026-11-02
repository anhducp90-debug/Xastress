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
  welcomeXu: 30, dailyXu: 10, xuPerTreatReceived: 1, xuFromTreatsPerDay: 20,
  packTurns: 12, packHours: 24,
};
const AVATAR = {
  skin: 4, hairColor: 6, hairStyle: 4, shirt: 8, pants: 4, hat: 3,
};
module.exports = { TABLES, MOODS, REACTIONS, DRINKS, DRINK_INFO, ECONOMY, AVATAR };
