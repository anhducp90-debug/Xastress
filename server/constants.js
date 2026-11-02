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
const AVATAR = {
  skin: 4, hairColor: 6, hairStyle: 4, shirt: 8, pants: 4, hat: 3,
};
module.exports = { TABLES, MOODS, REACTIONS, AVATAR };
