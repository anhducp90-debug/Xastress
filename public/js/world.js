// Bản đồ: một góc phố Việt Nam – dãy nhà ống, vỉa hè lát gạch đỏ, quán trà đá, lòng đường xe máy.
import * as S from './sprites.js';
import * as V from './vnart.js';

export const W = 640;
export const H = 448;
export const WALL_Y = 144;   // chân tường nhà phố
export const CURB_Y = 352;   // bó vỉa
export const ROAD_Y = 360;
export const LANES = [{ y: 398, dir: 1 }, { y: 440, dir: -1 }];

export const TABLES = [
  { id: 'congviec', name: 'Công Việc', x: 128, y: 228, kind: 0, icon: '💼' },
  { id: 'giadinh', name: 'Gia Đình', x: 320, y: 236, kind: 2, icon: '🏠' },
  { id: 'tinhcam', name: 'Tình Cảm', x: 512, y: 228, kind: 1, icon: '💔' },
  { id: 'hochanh', name: 'Học Hành', x: 128, y: 304, kind: 1, icon: '📚' },
  { id: 'tienbac', name: 'Cơm Áo Gạo Tiền', x: 320, y: 308, kind: 0, icon: '💸' },
  { id: 'cuocsong', name: 'Chuyện Đời', x: 512, y: 304, kind: 2, icon: '🌧️' },
];
export const tableById = Object.fromEntries(TABLES.map((t) => [t.id, t]));

export function stoolsOf(t) {
  return [
    { x: t.x - 22, y: t.y + 4, dir: 'right' },
    { x: t.x + 22, y: t.y + 4, dir: 'left' },
    { x: t.x - 6, y: t.y - 10, dir: 'down' },
    { x: t.x + 8, y: t.y - 10, dir: 'down' },
    { x: t.x - 6, y: t.y + 18, dir: 'up' },
    { x: t.x + 8, y: t.y + 18, dir: 'up' },
  ];
}

export const NPC_POS = { x: 342, y: 178 };   // Cô Tư ngồi sau quầy
export const CART = { x: 346, y: 190 };      // tâm đáy quầy trà
export const XEOM = { x: 563, y: 350 };
export const TREES = [{ x: 36, y: 296, kind: 'bang' }, { x: 604, y: 296, kind: 'phuong' }];
export const POLE = { x: 216, y: 350 };
export const PHO_STEAM = { x: 502, y: 138 };

// Vật cản: [x1, y1, x2, y2]
export const SOLIDS = [
  [0, 0, W, WALL_Y + 6],
  [288, 140, 404, 192],      // quầy trà + cô chủ
  [272, 178, 302, 192],      // biển các-tông
  ...TREES.map((t) => [t.x - 7, t.y - 14, t.x + 7, t.y + 2]), // gốc cây
  [210, 338, 224, 352],      // cột điện
  [384, 330, 496, 352],      // hàng xe máy đỗ
  [540, 332, 588, 352],      // xe ôm
  [8, 150, 40, 168], [52, 148, 82, 168],   // bao gạo, két nước
  [96, 150, 124, 172], [156, 150, 184, 172], // lốp xe, chai xăng
  [232, 156, 248, 170],      // thùng rác
  [422, 150, 476, 180],      // xe bánh mì
  [484, 150, 518, 172],      // nồi phở
  [0, CURB_Y + 6, W, H],     // không xuống lòng đường
  ...TABLES.map((t) => [t.x - 14, t.y - 5, t.x + 14, t.y + 8]),
];

// --------- Va chạm & tìm đường ---------
const FOOT = { w: 8, h: 4 };
export function blocked(x, y) {
  if (x < 4 || x > W - 4 || y < WALL_Y + 6 || y > CURB_Y + 6) return true;
  const l = x - FOOT.w / 2, r = x + FOOT.w / 2, t = y - FOOT.h, b = y;
  for (const s of SOLIDS) if (r > s[0] && l < s[2] && b > s[1] && t < s[3]) return true;
  return false;
}

const CELL = 8;
const GW = W / CELL, GH = Math.ceil(H / CELL);
let grid = null;
function buildGrid() {
  grid = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    grid[gy * GW + gx] = blocked(gx * CELL + CELL / 2, gy * CELL + CELL / 2) ? 1 : 0;
  }
}
export function findPath(sx, sy, tx, ty) {
  if (!grid) buildGrid();
  const cl = (v, m) => Math.max(0, Math.min(m - 1, v));
  const s = cl(Math.floor(sy / CELL), GH) * GW + cl(Math.floor(sx / CELL), GW);
  const want = cl(Math.floor(ty / CELL), GH) * GW + cl(Math.floor(tx / CELL), GW);
  let t = want;
  if (grid[t]) {
    let best = -1, bd = Infinity;
    const tgx = t % GW, tgy = (t / GW) | 0;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const gx = tgx + dx, gy = tgy + dy;
      if (gx < 0 || gy < 0 || gx >= GW || gy >= GH || grid[gy * GW + gx]) continue;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = gy * GW + gx; }
    }
    if (best < 0) return null;
    t = best;
  }
  const prev = new Int32Array(GW * GH).fill(-1);
  prev[s] = s;
  const queue = [s];
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    if (c === t) break;
    const cx = c % GW, cy = (c / GW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const n = ny * GW + nx;
      if (prev[n] !== -1 || grid[n]) continue;
      if (dx && dy && (grid[cy * GW + nx] || grid[ny * GW + cx])) continue;
      prev[n] = c;
      queue.push(n);
    }
  }
  if (prev[t] === -1) return null;
  const path = [];
  for (let c = t; c !== s; c = prev[c]) path.push({ x: (c % GW) * CELL + CELL / 2, y: ((c / GW) | 0) * CELL + CELL / 2 });
  path.reverse();
  if (t === want && !blocked(tx, ty)) path.push({ x: tx, y: ty });
  return path;
}

// --------- Dãy nhà ống ---------
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

const HOUSES = [
  { x: 0, w: 88, top: 6, wall: '#e8c15a', shutter: '#3f7a4a', shop: 'taphoa', flag: true, ac: true },
  { x: 88, w: 104, top: 26, wall: '#bcd6dc', shutter: '#7a4a24', shop: 'suaxe', tiles: true, clothes: true },
  { x: 192, w: 120, top: 12, wall: '#f0b7ae', shutter: '#2f6b9a', shop: 'cattoc', flowers: true, ac: true },
  { x: 312, w: 136, top: 0, wall: '#ece4cf', shutter: '#3f7a4a', shop: 'quan', roof: true, flowers: true, old: true },
  { x: 448, w: 104, top: 18, wall: '#a8d39a', shutter: '#7a4a24', shop: 'pho', clothes: true, ac: true },
  { x: 552, w: 88, top: 8, wall: '#f0cfa0', shutter: '#6d4526', shop: 'com', flowers: true, flag: true },
];

// Biển hiệu – chữ tiếng Việt vẽ ở độ phân giải màn hình cho sắc nét
export const SIGNS = [
  { x: 6, y: 106, w: 76, h: 12, text: 'TẠP HOÁ HẰNG NGA', bg: '#1f5fa8', fg: '#fff', sub: 'Bia · Nước ngọt · Thuốc lá' },
  { x: 94, y: 106, w: 92, h: 12, text: 'SỬA XE – VÁ XE', bg: '#f3c623', fg: '#c0261c', sub: 'Thay dầu · Bơm lốp' },
  { x: 198, y: 106, w: 88, h: 12, text: 'CẮT TÓC GỘI ĐẦU', bg: '#f7f3ea', fg: '#1f5fa8', sub: 'Nam – Nữ · Ráy tai' },
  { x: 454, y: 106, w: 92, h: 12, text: 'PHỞ BÒ GIA TRUYỀN', bg: '#c0261c', fg: '#ffe066', sub: 'Tái · Chín · Nạm · Gầu' },
  { x: 558, y: 106, w: 76, h: 12, text: 'CƠM BÌNH DÂN', bg: '#2e7d32', fg: '#fff', sub: 'Cơm văn phòng 35k' },
];
// Chữ nhỏ dán tường / biển số nhà / bìa các-tông
export const LABELS = [
  { x: 432, y: 74, text: 'Cho thuê phòng', color: '#1f5fa8', size: 5.5, rot: 0.02 },
  { x: 288, y: 167, text: 'TRÀ ĐÁ', color: '#3a2216', size: 7.5, hand: true, rot: -0.06 },
  { x: 288, y: 174, text: '3k', color: '#c0261c', size: 6.5, hand: true, rot: -0.06 },
  { x: 449, y: 140, text: 'BÁNH MÌ', color: '#ffe066', size: 6.5, bold: true },
  { x: 170, y: 149, text: 'XĂNG', color: '#c0261c', size: 5.5, bold: true },
];
export const WINDOWS = [];

export function renderBackground() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const P = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const r = rng(2024);
  WINDOWS.length = 0;

  // Bầu trời & mây
  const sky = g.createLinearGradient(0, 0, 0, 40);
  sky.addColorStop(0, '#8fc9ef'); sky.addColorStop(1, '#cfe9f7');
  g.fillStyle = sky; g.fillRect(0, 0, W, 44);
  for (const [cx, cy] of [[70, 8], [260, 4], [520, 10]]) {
    for (const [dx, dy, rw] of [[0, 0, 14], [10, -3, 10], [-10, 1, 9], [20, 1, 8]]) {
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx + dx, cy + dy, rw, rw * 0.45, 0, 0, Math.PI * 2); g.fill();
    }
  }

  for (const h of HOUSES) drawHouse(g, P, h, r);

  // Dây điện chạy dọc mặt tiền
  g.strokeStyle = '#1d1d20'; g.lineWidth = 1;
  for (const [y0, sag] of [[98, 5], [101, 7], [96, 3]]) {
    g.beginPath(); g.moveTo(0, y0);
    for (let x = 0; x <= W; x += 80) g.quadraticCurveTo(x + 40, y0 + sag, x + 80, y0);
    g.stroke();
  }

  // Bậc thềm đá mài
  P('#b9b2a4', 0, WALL_Y, W, 5); P('#d2ccbf', 0, WALL_Y, W, 1); P('#8f887b', 0, WALL_Y + 5, W, 1);

  // Vỉa hè gạch đỏ ô vuông (kiểu gạch block Hà Nội)
  for (let y = WALL_Y + 6; y < CURB_Y; y += 16) {
    for (let x = 0; x < W; x += 16) {
      const base = ['#c4683f', '#bd6039', '#c97249'][(r() * 3) | 0];
      P(base, x, y, 15, 15);
      P(S.shade(base, 0.07), x, y, 15, 1);
      P(S.shade(base, -0.1), x + 7, y + 1, 1, 14); P(S.shade(base, -0.1), x + 1, y + 7, 14, 1);
      P('#8e4a2e', x + 15, y, 1, 16); P('#8e4a2e', x, y + 15, 16, 1);
      const k = r();
      if (k > 0.985) { P('#9b968c', x, y, 16, 16); P('#8a857b', x + 3, y + 5, 6, 1); } // ô vá xi măng
      else if (k > 0.92) { P(S.shade(base, -0.2), x + 3, y + 4, 1, 6); P(S.shade(base, -0.2), x + 4, y + 9, 5, 1); } // nứt
      else if (k > 0.89) P('#5d7a3a', x + 15, y + 2 + ((r() * 10) | 0), 1, 3); // rêu
    }
  }
  // Hố trồng cây có viền gạch
  for (const t of TREES) {
    P('#7b7468', t.x - 16, t.y - 8, 32, 14); P('#5b4330', t.x - 14, t.y - 6, 28, 10);
    for (let i = 0; i < 18; i++) P(r() > 0.5 ? '#4f8a3a' : '#3f6f2e', t.x - 13 + ((r() * 26) | 0), t.y - 5 + ((r() * 8) | 0), 1, 2);
  }
  // Lá bàng khô, cánh phượng, vỏ hướng dương, giấy vụn
  for (let i = 0; i < 120; i++) {
    const x = (r() * W) | 0, y = WALL_Y + 8 + ((r() * (CURB_Y - WALL_Y - 12)) | 0);
    const right = x > W * 0.6;
    const col = right && r() > 0.4 ? ['#e53922', '#ff6a2a'][(r() * 2) | 0] : ['#b9452a', '#d0742f', '#a89a3a', '#7a4a24', '#efe9da'][(r() * 5) | 0];
    P(col, x, y, r() > 0.5 ? 3 : 2, 2);
  }
  // Bóng cây đổ
  g.fillStyle = 'rgba(25,35,15,0.25)';
  for (const t of TREES) { g.beginPath(); g.ellipse(t.x + 6, t.y - 26, 52, 16, 0, 0, Math.PI * 2); g.fill(); }
  // Bóng ô che quầy
  g.fillStyle = 'rgba(25,20,10,0.2)';
  g.beginPath(); g.ellipse(352, 200, 66, 12, 0, 0, Math.PI * 2); g.fill();

  // Ghế nhựa quanh các bàn
  let si = 0;
  for (const t of TABLES) {
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.beginPath(); g.ellipse(t.x, t.y + 9, 16, 4, 0, 0, Math.PI * 2); g.fill();
    for (const s of stoolsOf(t)) {
      const img = S.stool((si++ * 5 + t.kind) % 2); // ghế nhựa xanh/đỏ
      g.drawImage(img, Math.round(s.x - 6), Math.round(s.y - 8));
    }
  }
  g.drawImage(S.stool(0), NPC_POS.x - 6, NPC_POS.y - 6);

  // Bó vỉa sơn đỏ trắng + rãnh thoát nước
  for (let x = 0; x < W; x += 16) P(((x / 16) | 0) % 2 ? '#ece8de' : '#c8372d', x, CURB_Y, 16, 6);
  P('#7f7a70', 0, CURB_Y + 6, W, 2);
  // Lòng đường nhựa
  P('#4b4c52', 0, ROAD_Y, W, H - ROAD_Y);
  for (let i = 0; i < 700; i++) P(r() > 0.5 ? '#55565c' : '#424348', (r() * W) | 0, ROAD_Y + ((r() * (H - ROAD_Y)) | 0), 2, 1);
  for (const [x, y, w, h] of [[120, 372, 34, 12], [470, 420, 40, 14], [300, 432, 22, 9]]) { P('#3d3e43', x, y, w, h); P('#45464b', x + 2, y + 2, w - 4, h - 4); } // vá đường
  for (const x of [60, 340, 600]) { P('#2e2f33', x, ROAD_Y + 2, 16, 5); for (let k = 0; k < 16; k += 3) P('#1d1e22', x + k, ROAD_Y + 2, 1, 5); } // song chắn rác
  blob(g, 230, 412, 8, 4, '#3a3b40'); blob(g, 230, 412, 6, 3, '#55565c'); // nắp cống
  for (let x = 6; x < W; x += 40) P('#e8e4da', x, 414, 22, 2);
  P('#e8e4da', 0, ROAD_Y + 9, W, 1);
  return c;
}

function blob(g, cx, cy, rx, ry, col) {
  g.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    g.fillRect(cx - w, cy + y, w * 2, 1);
  }
}

function drawHouse(g, P, h, r) {
  const { x, w, top } = h;
  // Tường
  P(h.wall, x, top, w, WALL_Y - top);
  if (h.tiles) for (let yy = top + 4; yy < WALL_Y - 40; yy += 6) for (let xx = x; xx < x + w; xx += 8) P(S.shade(h.wall, -0.05), xx + ((yy / 6) % 2) * 4, yy, 7, 5);
  if (h.old) for (let i = 0; i < 40; i++) P(S.shade(h.wall, -0.08 - r() * 0.06), x + r() * w, top + r() * 100, 2 + r() * 6, 1 + r() * 3); // tường cũ ố
  P(S.shade(h.wall, 0.08), x + 2, top, 2, WALL_Y - top);
  P(S.shade(h.wall, -0.18), x + w - 3, top, 3, WALL_Y - top);

  // Mái
  if (h.roof) {
    for (let i = 0; i < 8; i++) P(i % 2 ? '#a8432a' : '#bf5333', x - 2, top + i, w + 4, 1);
    for (let xx = x; xx < x + w; xx += 4) P('#8a3520', xx, top, 1, 8);
    P('#6d2a18', x - 2, top + 8, w + 4, 2);
  } else {
    P(S.shade(h.wall, -0.1), x, top, w, 4); P(S.shade(h.wall, 0.12), x, top, w, 1);
    // bồn nước inox + chân sắt
    const tx = x + w - 34;
    if (top >= 6) {
      P('#3a3a40', tx + 2, top - 3, 2, 3); P('#3a3a40', tx + 22, top - 3, 2, 3);
      P('#c9d1d6', tx, top - 12, 26, 9); P('#eef3f5', tx + 2, top - 11, 22, 2); P('#9aa3aa', tx, top - 4, 26, 1);
      P('#9aa3aa', tx + 6, top - 12, 1, 9); P('#9aa3aa', tx + 19, top - 12, 1, 9);
    }
    if (top >= 4) { P('#555', x + 10, top - 14, 1, 14); P('#555', x + 6, top - 12, 9, 1); P('#555', x + 7, top - 9, 7, 1); } // ăng-ten
  }

  // Các tầng trên: cửa sổ cửa chớp + ban công
  for (let fy = WALL_Y - 80; fy + 40 > top + 10; fy -= 40) {
    const n = Math.max(1, Math.round(w / 52));
    for (let i = 0; i < n; i++) {
      const cw = w / n, wx = Math.round(x + cw * i + cw / 2 - 8), wy = fy + 6;
      if (wy < top + 6) continue;
      // khung cửa & kính
      P(S.shade(h.wall, -0.25), wx - 2, wy - 2, 20, 26);
      P('#2f4250', wx, wy, 16, 24);
      const lit = r() > 0.4;
      WINDOWS.push({ x: wx, y: wy, w: 16, h: 24, lit });
      // hoa sắt cửa sổ
      for (let k = 0; k < 16; k += 4) P('#4b4b52', wx + k + 1, wy, 1, 24);
      P('#4b4b52', wx, wy + 11, 16, 1);
      P('#6b8aa0', wx + 2, wy + 2, 3, 6);
      // cửa chớp mở hai bên
      for (const sx of [wx - 9, wx + 17]) {
        P(h.shutter, sx, wy, 8, 24);
        for (let k = 1; k < 24; k += 2) P(S.shade(h.shutter, -0.18), sx + 1, wy + k, 6, 1);
        P(S.shade(h.shutter, 0.15), sx, wy, 1, 24);
      }
      // ô thoáng trang trí phía trên
      P(S.shade(h.wall, -0.12), wx, wy - 6, 16, 3);
      // ban công sắt
      const by = wy + 26;
      P(S.shade(h.wall, -0.3), wx - 12, by, 40, 2);
      for (let k = wx - 11; k < wx + 28; k += 3) P('#2e2e34', k, by - 8, 1, 8);
      P('#2e2e34', wx - 12, by - 9, 40, 1);
      // chậu cây / hoa giấy rủ
      if (h.flowers && r() > 0.3) {
        for (let k = 0; k < 26; k++) {
          const fx = wx - 12 + r() * 40, fyy = by - 12 + r() * 16;
          P(r() > 0.3 ? '#e2407a' : '#f27aa6', fx, fyy, 2, 2);
        }
        for (let k = 0; k < 8; k++) P('#3f7a3a', wx - 12 + r() * 40, by - 10 + r() * 14, 2, 1);
      } else if (r() > 0.4) {
        P('#a8502d', wx - 9, by - 6, 6, 5); P('#3f8a3e', wx - 10, by - 11, 8, 5); P('#5aa24a', wx - 8, by - 13, 3, 3);
      }
      // quần áo phơi
      if (h.clothes && r() > 0.3) {
        P('#d6d2c4', wx - 12, by - 20, 40, 1);
        const cl = ['#e74c3c', '#3b8fd6', '#f2efe6', '#f3c623', '#9b59b6', '#2c3e50'];
        for (let k = 0; k < 4; k++) { const cx = wx - 9 + k * 9; P(cl[(r() * 6) | 0], cx, by - 19, 6, 8 + ((r() * 4) | 0)); }
      }
      // cục nóng điều hoà
      if (h.ac && i === n - 1 && r() > 0.3) {
        const ax = Math.min(x + w - 18, wx + 28);
        P('#e9e7e0', ax, wy + 4, 14, 10); P('#c4c2ba', ax, wy + 13, 14, 1);
        blob(g, ax + 9, wy + 9, 3, 3, '#8d8b84'); P('#6d6b64', ax + 8, wy + 8, 2, 2);
        P('#9a9890', ax + 2, wy + 6, 3, 1); P('#9a9890', ax + 2, wy + 9, 3, 1);
      }
    }
  }
  // Cờ đỏ sao vàng treo ban công tầng 2
  if (h.flag) h.flagPos = { x: x + w - 18, y: WALL_Y - 80 };

  // Tầng trệt
  const gy = WALL_Y - 40;
  P(S.shade(h.wall, -0.15), x, gy, w, 40);
  P(S.shade(h.wall, -0.3), x, gy, w, 2);
  const ix = x + 6, iw = w - 12, iy = gy + 16, ih = WALL_Y - iy;
  switch (h.shop) {
    case 'taphoa': {
      P('#2b2620', ix, iy, iw, ih);
      for (let yy = iy + 2; yy < WALL_Y - 3; yy += 6) {
        P('#6d4526', ix + 2, yy + 4, iw - 22, 1);
        for (let xx = ix + 3; xx < ix + iw - 22; xx += 3) P(['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#ecf0f1', '#e67e22'][(r() * 6) | 0], xx, yy, 2, 4);
      }
      // tủ mát nước ngọt
      P('#d8dde0', ix + iw - 18, iy + 1, 16, ih - 1); P('#9cc4e4', ix + iw - 16, iy + 3, 12, ih - 6);
      for (let k = 0; k < 4; k++) P(['#c0261c', '#f3c623', '#2e7d32', '#1f5fa8'][k], ix + iw - 15 + k * 3, iy + 6, 2, 6);
      // dây treo snack
      for (let k = 0; k < 6; k++) P(['#f39c12', '#e74c3c', '#27ae60'][k % 3], ix + 4 + k * 6, iy - 2, 4, 6);
      break;
    }
    case 'suaxe': {
      P('#1f1f22', ix, iy, iw, ih);
      // cửa xếp sắt kéo một nửa
      for (let xx = ix + iw / 2; xx < ix + iw; xx += 4) { P('#7d848b', xx, iy, 1, ih); P('#5d646b', xx + 2, iy, 1, ih); }
      for (let yy = iy + 2; yy < WALL_Y; yy += 6) for (let xx = ix + iw / 2; xx < ix + iw; xx += 4) P('#9aa3aa', xx, yy, 3, 1);
      P('#c0392b', ix + 6, iy + 10, 10, 12); P('#e05a46', ix + 7, iy + 11, 3, 10); // máy bơm hơi
      P('#555', ix + 20, iy + 4, 14, 2); for (let k = 0; k < 5; k++) P('#888', ix + 21 + k * 3, iy + 6, 1, 5); // treo cờ lê
      break;
    }
    case 'cattoc': {
      P('#3a4a55', ix, iy, iw, ih);
      P('#a8c8d8', ix + 6, iy + 3, iw - 40, ih - 6); P('#d8ecf4', ix + 8, iy + 4, 6, ih - 8); // gương lớn
      P('#2a2a30', ix + 20, iy + 12, 12, 12); P('#8d2a20', ix + 22, iy + 10, 8, 6); // ghế cắt tóc
      // cột xoay sọc
      const px = x + w - 16;
      P('#ddd', px, iy - 4, 6, 2);
      for (let k = 0; k < 18; k++) P(['#d0261c', '#fff', '#1f5fa8', '#fff'][((k + 0) >> 1) % 4], px, iy - 2 + k, 6, 1);
      P('#ddd', px, iy + 16, 6, 2);
      break;
    }
    case 'quan': {
      // nhà cũ: cửa gỗ pano mở, bên trong bàn thờ đỏ, cửa xếp sắt
      P('#3a2418', ix, iy - 4, iw, ih + 4);
      P('#7a2318', ix + iw / 2 - 14, iy + 2, 28, 10); P('#f3c623', ix + iw / 2 - 2, iy + 4, 4, 4); // bàn thờ
      P('#e85a3a', ix + iw / 2 - 10, iy + 3, 2, 2); P('#e85a3a', ix + iw / 2 + 8, iy + 3, 2, 2);
      for (const sx of [ix, ix + iw - 22]) {
        P('#7a4a24', sx, iy - 4, 22, ih + 4);
        for (let k = 0; k < 3; k++) P('#5f3818', sx + 3, iy + k * 9, 16, 7);
      }
      for (let xx = ix + 22; xx < ix + 44; xx += 4) { P('#7d848b', xx, iy - 4, 1, ih + 4); }
      // biển số nhà (chữ ở overlay)
      
      break;
    }
    case 'pho': {
      P('#2b2620', ix, iy, iw, ih);
      P('#d8dde0', ix + 4, iy + 2, 30, ih - 2); P('#f2efe6', ix + 6, iy + 4, 26, 8); // tủ kính bánh phở
      P('#8d2a20', ix + 8, iy + 6, 6, 3); P('#8d2a20', ix + 18, iy + 6, 6, 3); // thịt bò
      for (let k = 0; k < 3; k++) { P('#c99a5b', ix + 42 + k * 16, iy + 14, 12, 3); P('#5a381f', ix + 44 + k * 16, iy + 17, 2, 6); }
      P('#4b6a3a', ix + iw - 6, iy - 2, 4, 6); // rau thơm
      break;
    }
    case 'com': {
      P('#2b2620', ix, iy, iw, ih);
      P('#d8dde0', ix + 4, iy + 4, iw - 8, ih - 4); P('#b8d8e8', ix + 5, iy + 5, iw - 10, 8);
      const food = ['#f3c623', '#c0392b', '#3f8a3e', '#8d5a2b', '#f2efe6', '#e67e22'];
      for (let k = 0; k < 6; k++) { P('#9aa3aa', ix + 6 + k * 11, iy + 14, 10, 6); P(food[k], ix + 7 + k * 11, iy + 15, 8, 3); }
      break;
    }
    default: break;
  }
  // Bảng hiệu (khung)
  const sg = SIGNS.find((s) => s.x >= x && s.x < x + w);
  if (sg) {
    P(S.shade(sg.bg, -0.35), sg.x - 1, sg.y - 1, sg.w + 2, sg.h + 6);
    P(sg.bg, sg.x, sg.y, sg.w, sg.h + 4);
    P(S.shade(sg.bg, 0.2), sg.x, sg.y, sg.w, 1);
  }
}

// --------- Vật thể sắp theo trục y ---------
export function staticSprites() {
  const list = [];
  const add = (img, x, y, base, flip = false) => list.push({ img, x, y, base, flip });
  for (const t of TREES) {
    const img = t.kind === 'bang' ? V.treeBang() : V.treePhuong();
    add(img, t.x - 60, t.y - 118, t.y);
  }
  add(V.teaStall(), CART.x - 50, CART.y - 54, CART.y);
  add(V.cardboardSign(), 274, 162, 191);
  add(V.powerPole(), POLE.x - 21, POLE.y - V.POLE_H, POLE.y);
  add(V.riceSacks(), 10, 150, 168);
  add(V.crates(), 54, 142, 168);
  add(V.tireStack(), 98, 142, 172);
  add(V.fuelShelf(), 157, 140, 172);
  add(V.trashBin(), 233, 150, 170);
  add(V.breadCart(), 424, 134, 180);
  add(V.phoPot(), 486, 138, 172);
  add(S.plantPot(), 186, 140, 156);
  add(S.plantPot(), 532, 140, 156);
  const parked = [
    ['#8e2a20', { basket: true, helmet: '#f3c623' }], ['#2c3e50', { helmet: '#e74c3c' }],
    ['#e8e4da', { basket: true }], ['#1f5fa8', { helmet: '#ffffff' }],
  ];
  parked.forEach(([c, o], i) => add(V.bikeVN(c, o), 380 + i * 26, 312 + (i % 2) * 2, 348 + (i % 2) * 2, i % 2 === 1));
  return list;
}

// Ô che, đèn lồng: vẽ trên cùng
export const UMBRELLA = { x: 352 - 64, y: 92 };
export const LANTERNS = [296, 330, 374, 410].map((x, i) => ({ x, y: 124 + (i % 2) * 2 }));

// Dây điện chằng chịt từ cột ra các nhà
const PT = { x: POLE.x, y: POLE.y - V.POLE_H };
export const WIRES = [
  [PT.x - 13, PT.y + 10, -10, 52, 12], [PT.x - 13, PT.y + 10, 88, 40, 14], [PT.x - 9, PT.y + 22, 40, 92, 10],
  [PT.x - 9, PT.y + 22, 150, 88, 8], [PT.x + 14, PT.y + 10, 312, 36, 14], [PT.x + 21, PT.y + 10, 448, 46, 18],
  [PT.x + 18, PT.y + 22, 300, 84, 6], [PT.x + 21, PT.y + 10, 650, 56, 26], [PT.x + 18, PT.y + 22, 552, 88, 16],
  [PT.x - 13, PT.y + 10, -10, 96, 14],
];
export const LAMP = { x: POLE.x + 22, y: PT.y + 36 };

// Dây bóng đèn tròn: từ cây bàng tới cột điện, từ cây phượng tới ô quán
function stringOf(a, b, n, sag) {
  return Array.from({ length: n }, (_, i) => {
    const k = i / (n - 1);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * sag };
  });
}
export const BULB_STRINGS = [
  stringOf({ x: 62, y: 236 }, { x: POLE.x - 4, y: PT.y + 96 }, 7, 14),
  stringOf({ x: 578, y: 232 }, { x: 414, y: 124 }, 8, 20),
];
export const BULBS = BULB_STRINGS.flat();

export const LIGHTS = [
  { x: LAMP.x + 4, y: LAMP.y + 70, r: 90, col: '255,214,140' },  // đèn cao áp
  { x: 350, y: 150, r: 92, col: '255,170,90' },                   // đèn lồng quán
  { x: 500, y: 132, r: 48, col: '255,210,140' },                  // quán phở
  { x: 449, y: 150, r: 40, col: '255,230,160' },                  // xe bánh mì
  { x: 596, y: 128, r: 40, col: '255,230,170' },                  // cơm bình dân
  { x: 44, y: 128, r: 40, col: '220,240,255' },                   // tạp hoá đèn tuýp
];
export const HOUSE_FLAGS = () => HOUSES.filter((h) => h.flagPos).map((h) => h.flagPos);
