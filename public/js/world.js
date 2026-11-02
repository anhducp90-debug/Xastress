// Bản đồ quán trà đá vỉa hè: phố, vỉa hè, bàn ghế, lòng đường.
import * as S from './sprites.js';

export const W = 640;
export const H = 416;
export const WALL_Y = 112;   // mép nhà phố
export const CURB_Y = 320;   // bó vỉa
export const ROAD_Y = 328;

export const TABLES = [
  { id: 'congviec', name: 'Công Việc', x: 112, y: 196, kind: 0, icon: '💼' },
  { id: 'giadinh', name: 'Gia Đình', x: 320, y: 200, kind: 2, icon: '🏠' },
  { id: 'tinhcam', name: 'Tình Cảm', x: 528, y: 196, kind: 1, icon: '💔' },
  { id: 'hochanh', name: 'Học Hành', x: 112, y: 272, kind: 1, icon: '📚' },
  { id: 'tienbac', name: 'Cơm Áo Gạo Tiền', x: 320, y: 276, kind: 0, icon: '💸' },
  { id: 'cuocsong', name: 'Chuyện Đời', x: 528, y: 272, kind: 2, icon: '🌧️' },
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

export const NPC_POS = { x: 320, y: 130 };
export const CART = { x: 320, y: 152 }; // tâm đáy quầy

// Vật cản: [x1, y1, x2, y2]
export const SOLIDS = [
  [0, 0, W, WALL_Y + 4],
  [280, WALL_Y, 360, 154],                 // quầy trà + cô chủ
  [36, 176, 48, 196], [596, 176, 608, 196], // thân cây
  [212, 296, 222, 304],                     // cột đèn
  [392, 292, 482, 318],                     // xe máy đỗ
  [236, 136, 260, 150],                     // biển hiệu
  [0, CURB_Y + 6, W, H],                   // không xuống lòng đường
  ...TABLES.map((t) => [t.x - 14, t.y - 5, t.x + 14, t.y + 8]),
];

export const PARKED = [
  { x: 408, y: 314, color: '#c0392b' },
  { x: 438, y: 316, color: '#2c3e50' },
  { x: 468, y: 314, color: '#f1c40f' },
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
  let t = cl(Math.floor(ty / CELL), GH) * GW + cl(Math.floor(tx / CELL), GW);
  // Nếu đích bị chặn, tìm ô trống gần nhất
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
      if (dx && dy && (grid[cy * GW + nx] || grid[ny * GW + cx])) continue; // không cắt góc
      prev[n] = c;
      queue.push(n);
    }
  }
  if (prev[t] === -1) return null;
  const path = [];
  for (let c = t; c !== s; c = prev[c]) path.push({ x: (c % GW) * CELL + CELL / 2, y: ((c / GW) | 0) * CELL + CELL / 2 });
  path.reverse();
  if (t === cl(Math.floor(ty / CELL), GH) * GW + cl(Math.floor(tx / CELL), GW) && !blocked(tx, ty)) {
    path.push({ x: tx, y: ty });
  }
  return path;
}

// --------- Nền tĩnh ---------
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

const HOUSES = [
  { x: 0, w: 96, wall: '#e9c46a', trim: '#b98b2f', shop: 'TAP HOA', shopCol: '#2a9d8f', shutter: false },
  { x: 96, w: 112, wall: '#a8d5ba', trim: '#5f9e78', shop: 'SUA XE', shopCol: '#264653', shutter: true },
  { x: 208, w: 224, wall: '#f4a7a3', trim: '#c76b66', shop: '', shopCol: '#7a2318', shutter: false, stall: true },
  { x: 432, w: 112, wall: '#9cc4e4', trim: '#4f7fa8', shop: 'PHO', shopCol: '#c0392b', shutter: false },
  { x: 544, w: 96, wall: '#f6e7c1', trim: '#c2a46b', shop: 'CAT TOC', shopCol: '#8e44ad', shutter: true },
];
export const WINDOWS = []; // để vẽ đèn ban đêm

export function renderBackground() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const P = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const r = rng(42);
  WINDOWS.length = 0;

  // Nhà ống
  for (const h of HOUSES) {
    P(h.wall, h.x, 0, h.w, WALL_Y);
    P(S.shade(h.wall, -0.06), h.x, 0, 3, WALL_Y);
    P(S.shade(h.wall, -0.12), h.x + h.w - 2, 0, 2, WALL_Y);
    P(h.trim, h.x, 0, h.w, 4);
    // 2 tầng cửa sổ + ban công
    for (const wy of [10, 42]) {
      const n = Math.max(1, Math.floor(h.w / 48));
      for (let i = 0; i < n; i++) {
        const ww = 26, wx = h.x + Math.floor((h.w / n) * i + (h.w / n - ww) / 2);
        P('#3d5a6c', wx, wy, ww, 20); P('#5b7f95', wx + 2, wy + 2, ww - 4, 16);
        P('#8fb3c7', wx + 3, wy + 3, 4, 6);
        P(h.trim, wx - 2, wy - 2, ww + 4, 2);
        P(h.trim, wx + ww / 2 - 1, wy, 2, 20);
        WINDOWS.push({ x: wx + 2, y: wy + 2, w: ww - 4, h: 16, lit: r() > 0.35 });
        // ban công sắt
        P('#3a3a40', wx - 4, wy + 22, ww + 8, 2);
        for (let k = wx - 3; k < wx + ww + 4; k += 3) P('#3a3a40', k, wy + 24, 1, 5);
        P('#3a3a40', wx - 4, wy + 28, ww + 8, 1);
        if (r() > 0.4) { // chậu cây ban công
          P('#b5532d', wx + 2, wy + 18, 6, 4); P('#3f8a3e', wx + 1, wy + 14, 8, 4); P('#e74c3c', wx + 4, wy + 13, 2, 2);
        }
      }
    }
    // Tầng trệt
    const gy = 74;
    P(S.shade(h.wall, -0.2), h.x, gy, h.w, WALL_Y - gy);
    if (h.stall) {
      // Nhà có quán trà – cửa mở, có mái bạt sọc
      P('#5a3a28', h.x + 12, gy + 8, h.w - 24, WALL_Y - gy - 8);
      P('#7a5038', h.x + 16, gy + 12, 40, 26); P('#7a5038', h.x + h.w - 56, gy + 12, 40, 26);
      for (let x = h.x + 4; x < h.x + h.w - 4; x += 12) {
        P('#e63946', x, gy - 6, 6, 12); P('#f1faee', x + 6, gy - 6, 6, 12);
      }
      for (let x = h.x + 4; x < h.x + h.w - 4; x += 6) P(x % 12 < 6 ? '#e63946' : '#f1faee', x, gy + 6, 6, 3);
    } else if (h.shutter) {
      P('#9aa0a6', h.x + 8, gy + 4, h.w - 16, WALL_Y - gy - 4);
      for (let y = gy + 6; y < WALL_Y; y += 3) P('#7d848b', h.x + 8, y, h.w - 16, 1);
    } else {
      P('#2b2b30', h.x + 8, gy + 10, h.w - 16, WALL_Y - gy - 10);
      P('#f6d365', h.x + 12, gy + 14, h.w - 24, 3);
      // kệ hàng
      for (let y = gy + 20; y < WALL_Y - 4; y += 7) {
        P('#6d4526', h.x + 12, y + 4, h.w - 24, 1);
        for (let x = h.x + 14; x < h.x + h.w - 14; x += 4) P(['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#ecf0f1'][Math.floor(r() * 5)], x, y, 3, 4);
      }
    }
    if (h.shop) {
      P(h.shopCol, h.x + 10, gy - 4, h.w - 20, 12);
      P(S.shade(h.shopCol, 0.15), h.x + 10, gy - 4, h.w - 20, 2);
      g.fillStyle = '#fff8e7';
      g.font = 'bold 8px monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(h.shop, h.x + h.w / 2, gy + 2);
    }
    // Dây điện
    P('#2a2a2e', h.x, 6, h.w, 1);
  }
  // Bậc thềm
  P('#b9b2a4', 0, WALL_Y, W, 4);
  P('#8f887b', 0, WALL_Y + 4, W, 1);

  // Vỉa hè lát gạch
  for (let y = WALL_Y + 5; y < CURB_Y; y += 12) {
    const off = ((y / 12) | 0) % 2 ? 0 : 12;
    for (let x = -12 + off; x < W; x += 24) {
      const base = r() > 0.5 ? '#c96f4a' : '#bf6643';
      P(base, x, y, 23, 11);
      P(S.shade(base, 0.08), x, y, 23, 1);
      if (r() > 0.85) P(S.shade(base, -0.12), x + 4 + ((r() * 12) | 0), y + 4, 4, 3);
    }
    P('#9b4d33', 0, y + 11, W, 1);
  }
  // Lá bàng rụng & vết bẩn
  for (let i = 0; i < 90; i++) {
    const x = (r() * W) | 0, y = WALL_Y + 8 + ((r() * (CURB_Y - WALL_Y - 12)) | 0);
    const col = ['#c4472b', '#e0702f', '#a8a032', '#7a4a24'][(r() * 4) | 0];
    P(col, x, y, 3, 2);
  }
  // Bóng cây
  g.fillStyle = 'rgba(30,40,20,0.22)';
  for (const tx of [42, 602]) { g.beginPath(); g.ellipse(tx, 190, 44, 14, 0, 0, Math.PI * 2); g.fill(); }

  // Ghế nhựa
  let si = 0;
  for (const t of TABLES) {
    for (const s of stoolsOf(t)) {
      const img = S.stool((si++ * 7 + t.kind) % 4);
      g.drawImage(img, Math.round(s.x - 6), Math.round(s.y - 8));
    }
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath(); g.ellipse(t.x, t.y + 9, 16, 4, 0, 0, Math.PI * 2); g.fill();
  }
  // Ghế quanh quầy cho cô chủ
  g.drawImage(S.stool(1), NPC_POS.x - 6, NPC_POS.y - 6);

  // Bó vỉa sơn trắng đỏ
  for (let x = 0; x < W; x += 16) { P(((x / 16) | 0) % 2 ? '#e8e4da' : '#c0392b', x, CURB_Y, 16, 6); }
  P('#7f7a70', 0, CURB_Y + 6, W, 2);
  // Lòng đường
  P('#4a4b50', 0, ROAD_Y, W, H - ROAD_Y);
  for (let i = 0; i < 400; i++) P(r() > 0.5 ? '#525359' : '#434449', (r() * W) | 0, ROAD_Y + ((r() * (H - ROAD_Y)) | 0), 2, 1);
  for (let x = 6; x < W; x += 40) P('#e8e4da', x, 371, 20, 2);
  P('#f1c40f', 0, H - 4, W, 1);
  return c;
}

// Các vật thể sắp xếp theo trục y (để nhân vật đi trước/sau đúng)
export function staticSprites() {
  const list = [
    { img: S.tree(), x: 42 - 42, y: 196 - 98, base: 196 },
    { img: S.tree(), x: 602 - 42, y: 196 - 98, base: 196 },
    { img: S.cart(), x: CART.x - 37, y: CART.y - 38, base: CART.y },
    { img: S.lampPost(), x: 217 - 9, y: 304 - 78, base: 304 },
    { img: S.signBoard(), x: 235, y: 122, base: 150 },
    { img: S.plantPot(), x: 186, y: 112, base: 128 },
    { img: S.plantPot(), x: 440, y: 112, base: 128 },
  ];
  for (const b of PARKED) list.push({ img: S.motorbike(b.color), x: b.x - 18, y: b.y - 26, base: b.y, flip: true });
  return list;
}

export const LIGHTS = [
  { x: 217, y: 232, r: 70, col: '255,220,150' },  // đèn đường
  { x: 320, y: 120, r: 80, col: '255,190,110' },  // đèn quầy
];
// Dây bóng đèn tròn giăng ngang quán
export const BULBS = Array.from({ length: 13 }, (_, i) => {
  const x = 60 + i * 43;
  const sag = Math.sin((i / 12) * Math.PI) * 14;
  return { x, y: 140 + sag };
});
