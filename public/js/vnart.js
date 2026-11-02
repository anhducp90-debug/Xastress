// Đồ vật đặc trưng phố phường Việt Nam – vẽ pixel bằng code.
import { cached, shade } from './sprites.js';

// Tô hình elip đặc
function blob(P, cx, cy, rx, ry, col) {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    if (w > 0) P(col, Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}
// Nhiễu đốm lá để tán cây có kết cấu
function speckle(P, cx, cy, rx, ry, col, n, seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    P(col, Math.round(cx + Math.cos(a) * rx * d), Math.round(cy + Math.sin(a) * ry * d), 2, 1);
  }
}

// Gốc cây quét vôi trắng – hình ảnh quen thuộc trên phố Việt
function trunk(P, x, top, bottom, w) {
  P('#6b4a2e', x, top, w, bottom - top);
  P('#86603d', x + 1, top, 2, bottom - top);
  P('#4f3520', x + w - 2, top, 2, bottom - top);
  for (let y = top + 6; y < bottom - 18; y += 7) P('#5a3d24', x + 2, y, w - 4, 1);
  P('#f4f1e8', x, bottom - 16, w, 16);
  P('#dcd8cc', x + w - 3, bottom - 16, 3, 16);
  P('#ffffff', x + 1, bottom - 16, 2, 16);
  P('#c9c4b6', x - 1, bottom - 1, w + 2, 1);
}

// Cây bàng: tán xoè thành nhiều tầng nằm ngang, mép lá lởm chởm, vài lá đỏ
export function treeBang() {
  return cached('bang', 120, 120, (g, P) => {
    trunk(P, 54, 52, 118, 12);
    P('#6b4a2e', 30, 64, 26, 3); P('#6b4a2e', 64, 54, 28, 3); P('#6b4a2e', 42, 40, 14, 2); P('#6b4a2e', 64, 30, 12, 2);
    let s = 17;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const tiers = [[60, 66, 54, 8], [60, 48, 46, 8], [60, 31, 34, 7], [60, 16, 20, 6]];
    for (const [cx, cy, rx, ry] of tiers) {
      const clumps = Math.round(rx / 6);
      for (let i = 0; i < clumps; i++) {
        const x = cx - rx + 8 + (i / (clumps - 1 || 1)) * (rx * 2 - 16) + (r() - 0.5) * 6;
        const y = cy + (r() - 0.5) * 4;
        const w = 9 + r() * 6, h = ry - 1 + r() * 2;
        blob(P, x, y + 3, w, h, '#24502a');
      }
      for (let i = 0; i < clumps; i++) {
        const x = cx - rx + 8 + (i / (clumps - 1 || 1)) * (rx * 2 - 16) + (r() - 0.5) * 6;
        const y = cy + (r() - 0.5) * 4;
        blob(P, x, y, 8 + r() * 5, ry - 2, '#3a7a37');
        blob(P, x - 2, y - 2, 5 + r() * 3, ry - 5, '#4f9a45');
      }
      speckle(P, cx, cy - 2, rx - 6, ry - 3, '#73b95a', rx * 1.3, cx * cy + 3);
    }
    for (let i = 0; i < 12; i++) {
      const t = tiers[(r() * 4) | 0];
      const x = Math.round(t[0] + (r() - 0.5) * t[2] * 1.7), y = Math.round(t[1] + (r() - 0.3) * t[3]);
      P('#b93a22', x, y, 4, 3); P('#e2682d', x + 1, y, 2, 1);
    }
  });
}

// Cây phượng vĩ: tán dù rộng, hoa đỏ rực
export function treePhuong() {
  return cached('phuong', 120, 120, (g, P) => {
    trunk(P, 54, 50, 118, 12);
    P('#6b4a2e', 36, 50, 20, 3); P('#6b4a2e', 64, 44, 22, 3);
    blob(P, 60, 40, 56, 26, '#2d5e2a');
    blob(P, 60, 35, 52, 22, '#447f35');
    blob(P, 54, 28, 38, 15, '#5c9a42');
    speckle(P, 60, 34, 50, 20, '#7cb85a', 120, 7);
    const flowers = ['#d7261e', '#f04a24', '#ff7a3a', '#b8171a'];
    let s = 99;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 55; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const x = Math.round(60 + Math.cos(a) * 50 * d), y = Math.round(34 + Math.sin(a) * 22 * d);
      const c = flowers[(r() * 4) | 0];
      P(c, x, y, 4, 3); P(shade(c, 0.2), x + 1, y, 2, 1);
    }
  });
}

// Cột điện bê tông, dây chằng chịt, biến áp, đèn cao áp, tờ rơi dán cột
export const POLE_W = 44, POLE_H = 236;
export function powerPole() {
  return cached('pole', POLE_W, POLE_H, (g, P) => {
    const x = 18;
    P('#9b9a94', x, 8, 7, POLE_H - 8);
    P('#b8b7b0', x + 1, 8, 2, POLE_H - 8);
    P('#7d7c76', x + 5, 8, 2, POLE_H - 8);
    for (let y = 20; y < POLE_H; y += 24) P('#8a8983', x, y, 7, 1);
    // xà ngang & sứ cách điện
    P('#5d5c58', 4, 12, 36, 3); P('#5d5c58', 8, 24, 28, 3);
    for (const ix of [5, 13, 30, 37]) { P('#e8e4da', ix, 9, 2, 3); }
    for (const ix of [9, 34]) { P('#e8e4da', ix, 21, 2, 3); }
    // biến áp
    P('#6f7a72', 26, 40, 12, 18); P('#89958c', 27, 41, 3, 16); P('#4c5550', 26, 57, 12, 2);
    P('#3a3a3a', 28, 37, 2, 3); P('#3a3a3a', 34, 37, 2, 3);
    // cuộn dây cáp thừa
    for (let i = 0; i < 3; i++) { // cuộn cáp thừa quấn vòng
      const cy = 76 + i * 3;
      for (let t = 0; t < 24; t++) { const an = (t / 24) * Math.PI * 2; P('#1d1d20', Math.round(12 + Math.cos(an) * 8), Math.round(cy + Math.sin(an) * 4), 1, 1); }
    }
    P('#1d1d20', 18, 66, 1, 12);
    // hộp công tơ
    P('#c9c4b6', 26, 92, 9, 12); P('#3d5a6c', 28, 95, 5, 4);
    // tờ rơi "khoan cắt bê tông", "cho thuê phòng"
    for (const [yy, bg, fg] of [[150, '#f5f0d8', '#d63c2f'], [160, '#fff59a', '#333'], [170, '#ffffff', '#2c6fbb'], [184, '#f5f0d8', '#d63c2f'], [196, '#ffd0d0', '#333']]) {
      P(bg, x, yy, 7, 7); P(fg, x + 1, yy + 1, 5, 1); P('#555', x + 1, yy + 3, 4, 1); P('#555', x + 1, yy + 5, 3, 1);
    }
    // đế cột
    P('#6f6e69', x - 2, POLE_H - 4, 11, 4);
  });
}

// Ô che nắng to (vẽ ở lớp trên cùng)
export function umbrella() {
  return cached('umbrella', 128, 40, (g, P) => {
    const cols = ['#c8372d', '#f3e2b3'];
    for (let y = 0; y < 26; y++) {
      const half = Math.round(10 + (y / 26) * 52);
      for (let x = -half; x < half; x++) {
        const seg = Math.floor(((x / half) + 1) * 4);
        P(cols[seg % 2], 64 + x, 4 + y, 1, 1);
      }
    }
    // mép viền lượn sóng
    for (let x = 2; x < 126; x += 8) { blob(P, x + 4, 31, 4, 3, shade('#c8372d', -0.1)); }
    P('#7a2318', 2, 29, 124, 1);
    P('#e8d9a8', 62, 0, 4, 6); P('#7d7c76', 63, 30, 2, 10);
    // đường gân nan ô
    for (let i = -3; i <= 3; i++) {
      for (let y = 0; y < 26; y++) P('rgba(0,0,0,0.12)', Math.round(64 + i * (10 + (y / 26) * 52) / 4), 4 + y, 1, 1);
    }
  });
}

export function lantern() {
  return cached('lantern', 8, 14, (g, P) => {
    P('#3a2a22', 3, 0, 2, 2);
    P('#d6281f', 1, 2, 6, 8); P('#f04a3a', 2, 3, 2, 6); P('#9a1a14', 1, 9, 6, 1);
    P('#f3c623', 1, 2, 6, 1); P('#f3c623', 1, 10, 6, 1);
    P('#f3c623', 3, 11, 2, 3);
  });
}

// Quầy trà đá: kệ gỗ, bình trà đá nhựa đỏ, ấm tích ủ giỏ, thùng xốp đá, khay kẹo lạc, điếu cày
export function teaStall() {
  return cached('stall', 100, 56, (g, P) => {
    // kệ gỗ thấp
    P('#8a5a32', 6, 30, 88, 6); P('#a8723f', 6, 30, 88, 2); P('#6d4526', 6, 36, 88, 3);
    P('#5a381f', 9, 39, 4, 15); P('#5a381f', 87, 39, 4, 15); P('#5a381f', 48, 39, 4, 15);
    P('#4a2d18', 9, 46, 82, 2);
    // thùng xốp đá dưới gầm
    P('#f4f4ef', 16, 40, 26, 14); P('#dedfd8', 16, 40, 26, 3); P('#c9cac3', 40, 40, 2, 14);
    P('#9ccbe8', 18, 41, 4, 1);
    // bình trà đá nhựa đỏ 20 lít có vòi
    P('#c0392b', 8, 6, 16, 24); P('#e05a46', 10, 8, 4, 20); P('#8e2a20', 22, 6, 2, 24);
    P('#f2efe6', 9, 3, 14, 4); P('#cfcabd', 9, 6, 14, 1);
    P('#f2efe6', 13, 24, 3, 3); P('#6b6b6b', 14, 27, 1, 2);
    // ấm tích trong giỏ ủ
    blob(P, 34, 20, 9, 9, '#a87436');
    for (let y = 12; y < 29; y += 3) P('#7d5222', 26, y, 17, 1);
    blob(P, 34, 13, 6, 3, '#e9e2cf');
    P('#ffffff', 31, 11, 3, 1); P('#3b6ea5', 33, 13, 3, 1);
    P('#e9e2cf', 42, 13, 5, 2); P('#e9e2cf', 46, 11, 2, 2); // vòi
    P('#7d5222', 30, 8, 9, 2);
    // khay nhôm: lọ kẹo lạc, hướng dương, bao thuốc
    P('#b9c2c9', 50, 26, 30, 4); P('#dfe6ea', 50, 26, 30, 1);
    P('rgba(225,240,255,0.95)', 52, 16, 8, 10); P('#d9a75a', 53, 19, 6, 6); P('#b8833d', 54, 21, 2, 1); P('#2f7fd1', 52, 14, 8, 2);
    P('rgba(225,240,255,0.95)', 62, 17, 7, 9); P('#3a3a32', 63, 20, 5, 5); P('#8a8a76', 64, 21, 1, 1); P('#d13b2f', 62, 15, 7, 2);
    P('#f2efe6', 71, 21, 5, 5); P('#d13b2f', 71, 21, 5, 2);
    P('#f3c623', 77, 22, 3, 4);
    // chồng cốc thủy tinh
    for (let i = 0; i < 3; i++) { P('rgba(220,240,255,0.95)', 82, 16 + i * 4, 7, 4); P('#bcd4e3', 82, 19 + i * 4, 7, 1); }
    // điếu cày dựng cạnh quầy
    P('#c9a25a', 93, 2, 4, 52); P('#e3c27c', 94, 2, 1, 52);
    for (let y = 8; y < 52; y += 10) P('#8a6a32', 93, y, 4, 1);
    P('#7a6a5a', 90, 34, 4, 2); P('#4a3a2a', 89, 32, 2, 3); // nõ điếu
  });
}

// Biển bìa các-tông viết tay (chữ vẽ ở lớp overlay)
export function cardboardSign() {
  return cached('carton', 30, 30, (g, P) => {
    P('#c9a36b', 2, 2, 26, 18); P('#dbb985', 2, 2, 26, 2); P('#a9844f', 26, 2, 2, 18);
    P('#a9844f', 4, 19, 2, 10); P('#a9844f', 22, 19, 2, 10);
    P('#8a6a3c', 6, 19, 18, 2);
  });
}

export function breadCart() {
  return cached('banhmi', 50, 46, (g, P) => {
    P('#c0392b', 4, 2, 42, 8); P('#e05a46', 4, 2, 42, 2); // bảng hiệu
    P('#b9c2c9', 4, 10, 2, 18); P('#b9c2c9', 44, 10, 2, 18);
    P('rgba(225,240,255,0.55)', 6, 10, 38, 18);
    for (let i = 0; i < 5; i++) { P('#d99a44', 8 + i * 7, 20 - (i % 2) * 3, 6, 3); P('#f0c070', 9 + i * 7, 20 - (i % 2) * 3, 4, 1); }
    P('#2fae5b', 9, 25, 4, 2); P('#e74c3c', 30, 25, 4, 2);
    P('#8d979f', 2, 28, 46, 3); P('#dfe6ea', 2, 28, 46, 1);
    P('#4a5157', 4, 31, 42, 7);
    P('#2f7fd1', 8, 32, 6, 6); // bình gas
    P('#1d1d22', 6, 38, 8, 7); P('#55555c', 8, 40, 4, 3);
    P('#1d1d22', 36, 38, 8, 7); P('#55555c', 38, 40, 4, 3);
    P('#7d848b', 46, 20, 3, 2); P('#7d848b', 48, 20, 1, 12);
  });
}

// Nồi nước dùng phở trên bếp than tổ ong
export function phoPot() {
  return cached('pho', 30, 34, (g, P) => {
    P('#3a3a3a', 8, 22, 14, 11); P('#5a5a5a', 9, 23, 12, 2);
    for (const [x, y] of [[10, 27], [14, 27], [18, 27], [12, 30], [16, 30]]) P('#ff7a2a', x, y, 2, 1);
    P('#b9c2c9', 3, 6, 24, 16); P('#dfe6ea', 5, 7, 5, 14); P('#8d979f', 3, 20, 24, 2);
    P('#8d979f', 1, 8, 2, 4); P('#8d979f', 27, 8, 2, 4);
    P('#9aa3aa', 3, 4, 24, 3); P('#c8833a', 5, 5, 20, 1);
  });
}

export function tireStack() {
  return cached('tires', 24, 30, (g, P) => {
    for (let i = 0; i < 4; i++) {
      const y = 22 - i * 6;
      P('#1f1f22', 2, y, 20, 6); P('#3a3a40', 3, y + 1, 18, 1); P('#111', 8, y + 2, 8, 2);
    }
    P('#c0392b', 1, 24, 3, 4);
  });
}

// Kệ chai xăng lẻ – "cây xăng" vỉa hè
export function fuelShelf() {
  return cached('xang', 26, 32, (g, P) => {
    P('#8a5a32', 2, 14, 22, 3); P('#8a5a32', 2, 26, 22, 3);
    P('#6d4526', 3, 14, 2, 17); P('#6d4526', 21, 14, 2, 17);
    for (let i = 0; i < 4; i++) {
      for (const y of [4, 16]) {
        const x = 4 + i * 5;
        P('rgba(255,240,200,0.6)', x, y, 4, 10); P(i % 2 ? '#f0a020' : '#e8c040', x, y + 3, 4, 7); P('#d13b2f', x + 1, y - 1, 2, 2);
      }
    }
  });
}

export function crates() {
  return cached('crates', 26, 26, (g, P) => {
    const box = (x, y, c) => {
      P(c, x, y, 12, 9); P(shade(c, 0.15), x, y, 12, 1); P(shade(c, -0.2), x + 2, y + 3, 8, 2);
      for (let i = 0; i < 4; i++) P('#5a7a3a', x + 1 + i * 3, y - 3, 2, 3);
    };
    box(1, 16, '#d13b2f'); box(13, 16, '#f3c623'); box(7, 6, '#2f7fd1');
  });
}

export function riceSacks() {
  return cached('sacks', 26, 18, (g, P) => {
    blob(P, 8, 11, 7, 6, '#ece6d4'); blob(P, 19, 11, 7, 6, '#e2dbc5'); blob(P, 13, 6, 7, 5, '#f4efe0');
    P('#2c6fbb', 10, 5, 6, 2); P('#c0392b', 16, 11, 5, 1);
  });
}

// Xe máy kiểu Việt: xe số, có giỏ, có thể chở đồ
export function bikeVN(body = '#8e2a20', opt = {}) {
  const k = `bk${body}${JSON.stringify(opt)}`;
  return cached(k, 46, 40, (g, P) => {
    const oy = 10;
    // bánh
    blob(P, 9, oy + 24, 6, 5, '#1d1d22'); blob(P, 9, oy + 24, 3, 2, '#7a7a80');
    blob(P, 35, oy + 24, 6, 5, '#1d1d22'); blob(P, 35, oy + 24, 3, 2, '#7a7a80');
    // khung & yếm
    P('#4a4a50', 9, oy + 20, 26, 2);
    P(body, 24, oy + 12, 10, 9); P(shade(body, 0.2), 25, oy + 13, 3, 6);
    P(body, 8, oy + 14, 14, 6); P(shade(body, 0.15), 8, oy + 14, 14, 1);
    P('#9aa3aa', 4, oy + 21, 10, 2); // ống xả
    P('#26262c', 9, oy + 11, 16, 3); // yên dài
    P('#b9c2c9', 34, oy + 4, 2, 16); P('#4a4a50', 30, oy + 3, 9, 2); // ghi đông
    P('#f6e58d', 38, oy + 8, 4, 3); P('#d0d0c0', 37, oy + 7, 1, 5);
    P('#3a3a40', 36, oy + 1, 1, 3); P('#b9c2c9', 35, oy, 3, 2); // gương
    if (opt.basket) { P('#7d848b', 36, oy + 9, 8, 6); P('#9aa3aa', 37, oy + 10, 6, 1); }
    if (opt.helmet) { blob(P, 36, oy - 1, 3, 2, opt.helmet); } // mũ treo gương
    if (opt.cargo === 'box') { P('#f4f4ef', 2, oy + 1, 14, 10); P('#dedfd8', 2, oy + 1, 14, 2); P('#8d979f', 8, oy + 1, 1, 10); }
    if (opt.cargo === 'water') { P('#3a86d6', 3, oy, 10, 12); P('#7ab6f0', 4, oy + 1, 3, 10); P('#2c6fbb', 5, oy - 2, 6, 2); }
    if (opt.cargo === 'flower') { for (let i = 0; i < 9; i++) P(['#f06292', '#ffd54f', '#e53935', '#ffffff'][i % 4], 1 + (i % 3) * 4, oy - 2 + ((i / 3) | 0) * 4, 4, 4); P('#3f8a3e', 4, oy + 9, 8, 3); }
    if (opt.rider) {
      const sh = opt.rider;
      P('#26262c', 17, oy + 6, 9, 6); P('#26262c', 24, oy + 10, 3, 8); P('#3a2a22', 24, oy + 17, 4, 2);
      P(sh, 16, oy - 6, 10, 12); P(shade(sh, -0.15), 16, oy + 2, 10, 3);
      P(shade(sh, -0.1), 24, oy - 4, 9, 3); P('#e9b78d', 32, oy - 4, 2, 3); // tay cầm lái
      P('#e9b78d', 21, oy - 11, 6, 5);
      blob(P, 21, oy - 12, 6, 4, opt.riderHelmet || '#2c6fbb'); P('#2b1d1a', 25, oy - 11, 2, 1);
      P(shade(opt.riderHelmet || '#2c6fbb', 0.25), 18, oy - 15, 4, 1);
      if (opt.mask) P('#4a6a8a', 25, oy - 9, 3, 3); // khẩu trang
      if (opt.passenger) {
        const p2 = opt.passenger;
        P(p2, 8, oy - 4, 9, 11); P('#e9b78d', 10, oy - 9, 5, 5);
        blob(P, 12, oy - 10, 5, 3, '#f3c623'); P('#26262c', 9, oy + 7, 7, 4);
      }
    }
  });
}

// Xe đạp chở hoa – cô bán hoa đội nón lá
export function flowerBike(frame = 0) {
  return cached(`fbike${frame}`, 48, 44, (g, P) => {
    const oy = 12;
    const wheel = (cx) => { for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2; P('#2a2a2e', Math.round(cx + Math.cos(t) * 6), Math.round(oy + 24 + Math.sin(t) * 6), 1, 1); } P('#7a7a80', cx, oy + 24, 1, 1); };
    wheel(10); wheel(36);
    P('#2f6b9a', 10, oy + 23, 14, 1); P('#2f6b9a', 22, oy + 14, 1, 10); P('#2f6b9a', 22, oy + 14, 14, 1); P('#2f6b9a', 35, oy + 12, 1, 12);
    P('#2a2a2e', 18, oy + 13, 7, 2);
    // giỏ hoa phía sau & trước
    P('#a87436', 0, oy + 8, 18, 8); for (let x = 1; x < 18; x += 3) P('#7d5222', x, oy + 8, 1, 8);
    const fl = ['#f06292', '#ffd54f', '#e53935', '#ffffff', '#ba68c8'];
    for (let i = 0; i < 16; i++) P(fl[i % 5], (i % 6) * 3, oy - 2 + ((i / 6) | 0) * 4, 3, 3);
    for (let i = 0; i < 6; i++) P('#3f8a3e', 1 + i * 3, oy + 7, 1, 2);
    P('#a87436', 35, oy + 8, 9, 5); for (let i = 0; i < 4; i++) P(fl[(i + 2) % 5], 35 + i * 2, oy + 5, 2, 3);
    // người đạp xe
    const leg = frame ? 2 : 0;
    P('#2d3a5a', 21, oy + 8, 4, 8 - leg); P('#2d3a5a', 25, oy + 10 + leg, 3, 8 - leg);
    P('#f2efe6', 19, oy - 4, 9, 13); P('#dcd8cc', 19, oy + 5, 9, 2); // áo bà ba trắng
    P('#e9b78d', 27, oy - 1, 7, 2);
    P('#e9b78d', 22, oy - 9, 5, 5); P('#1d1a1f', 21, oy - 9, 2, 6);
    // nón lá
    const rows = [[23, 2], [22, 4], [21, 6], [19, 10], [17, 14]];
    rows.forEach(([x, w], i) => P(i % 2 ? '#e8d49a' : '#f1e1ac', x, oy - 14 + i, w, 1));
  });
}

// Gánh hàng rong: nón lá, áo bà ba, đòn gánh hai quang
export function vendor(frame = 0, goods = 0) {
  return cached(`vendor${frame}${goods}`, 52, 40, (g, P) => {
    const cx = 26;
    const leg = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    P('#2a2a30', cx - 3 + leg, 30, 3, 8); P('#2a2a30', cx + 1 - leg, 30, 3, 8);
    P('#3a2a22', cx - 3 + leg, 37, 3, 1); P('#3a2a22', cx + 1 - leg, 37, 3, 1);
    P('#c85a54', cx - 5, 17, 10, 14); P('#a8443e', cx - 5, 27, 10, 3); // áo bà ba nâu đỏ
    P('#e9b78d', cx - 2, 10, 6, 7); P('#1d1a1f', cx - 3, 10, 2, 7);
    const rows = [[cx - 1, 2], [cx - 2, 4], [cx - 4, 8], [cx - 6, 12], [cx - 8, 16]];
    rows.forEach(([x, w], i) => P(i % 2 ? '#e8d49a' : '#f1e1ac', x, 4 + i, w, 1));
    P('#b9a066', cx - 8, 9, 16, 1);
    // đòn gánh tre
    const bob = frame ? 1 : 0;
    P('#c9a25a', 2, 17 + bob, 48, 2); P('#e3c27c', 2, 17 + bob, 48, 1);
    P('#e9b78d', cx + 4, 17, 3, 3);
    for (const bx of [6, 46]) {
      P('#7d5222', bx - 4, 19 + bob, 1, 10); P('#7d5222', bx + 3, 19 + bob, 1, 10);
      P('#a87436', bx - 6, 28 + bob, 13, 8); for (let x = bx - 5; x < bx + 7; x += 3) P('#7d5222', x, 28 + bob, 1, 8);
      const fruits = goods === 0 ? ['#e53935', '#ffb300', '#7cb342'] : ['#f5deb3', '#e8c070', '#ffffff'];
      for (let i = 0; i < 5; i++) P(fruits[i % 3], bx - 5 + Math.round(i * 2.5), 25 + bob - (i % 2), 3, 3);
    }
  });
}

// Bác xe ôm ngồi chờ khách
export function xeOm(frame = 0) {
  return cached(`xeom${frame}`, 46, 46, (g, P) => {
    const oy = 16;
    blob(P, 9, oy + 24, 6, 5, '#1d1d22'); blob(P, 9, oy + 24, 3, 2, '#7a7a80');
    blob(P, 35, oy + 24, 6, 5, '#1d1d22'); blob(P, 35, oy + 24, 3, 2, '#7a7a80');
    P('#4a4a50', 9, oy + 20, 26, 2);
    P('#2c3e50', 24, oy + 12, 10, 9); P('#2c3e50', 8, oy + 14, 14, 6);
    P('#26262c', 9, oy + 11, 16, 3);
    P('#b9c2c9', 34, oy + 4, 2, 16); P('#4a4a50', 30, oy + 3, 9, 2);
    P('#f6e58d', 38, oy + 8, 4, 3);
    // người ngồi ngang yên, áo xanh, mũ cối
    P('#4a5a3a', 12, oy + 6, 8, 6); P('#4a5a3a', 18, oy + 10, 3, 8); P('#3a2a22', 18, oy + 17, 4, 2);
    P('#5f7f4a', 10, oy - 7, 10, 13); P('#4a6a3a', 10, oy + 2, 10, 3);
    P('#c68b5c', 18, oy - 2, 5, 2);
    P('#c68b5c', 12, oy - 12, 6, 5); P('#2b1d1a', 16, oy - 11, 1, 1);
    blob(P, 15, oy - 13, 6, 3, '#6b8a4a'); P('#5a7a3a', 9, oy - 11, 12, 1); // mũ cối
    if (frame) { P('#ffffff', 22, oy - 9, 3, 1); P('rgba(220,220,220,0.7)', 25, oy - 12 - frame, 2, 2); } // điếu thuốc
  });
}

// Cờ đỏ sao vàng
export function flag(frame = 0) {
  return cached(`flag${frame}`, 24, 34, (g, P) => {
    P('#8d979f', 1, 0, 2, 34);
    for (let x = 0; x < 20; x++) {
      const dy = Math.round(Math.sin(x / 3 + frame * 1.6) * 1.2);
      P('#da251d', 3 + x, 2 + dy, 1, 13);
      P(shade('#da251d', -0.12), 3 + x, 14 + dy, 1, 1);
    }
    // ngôi sao vàng
    const sx = 12, sy = 8;
    P('#ffde00', sx, sy - 3, 1, 2); P('#ffde00', sx - 1, sy - 1, 3, 1); P('#ffde00', sx - 3, sy - 1, 7, 1);
    P('#ffde00', sx - 2, sy, 5, 1); P('#ffde00', sx - 1, sy + 1, 3, 1); P('#ffde00', sx - 2, sy + 2, 2, 1); P('#ffde00', sx + 1, sy + 2, 2, 1);
  });
}

export function trashBin() {
  return cached('bin', 14, 20, (g, P) => {
    P('#2e7d32', 1, 3, 12, 16); P('#43a047', 2, 4, 3, 14); P('#1b5e20', 0, 1, 14, 3);
    P('#f2efe6', 4, 9, 6, 3);
  });
}
