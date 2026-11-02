// Pixel-art vẽ hoàn toàn bằng code – không cần file ảnh.
export const PALETTE = {
  skin: ['#f7d6b5', '#e9b78d', '#c68b5c', '#8a5a3c'],
  hairColor: ['#1d1a1f', '#4a2c1a', '#7a4a24', '#c08a45', '#77777f', '#8e44ad'],
  shirt: ['#e74c3c', '#3b8fd6', '#3fbf6f', '#f3c623', '#9b59b6', '#f2efe6', '#e67e22', '#18a99a'],
  pants: ['#2d3a5a', '#5b4636', '#26262c', '#61733a'],
};
export const AVATAR_LABELS = {
  skin: 'Màu da', hairColor: 'Màu tóc', hairStyle: 'Kiểu tóc', shirt: 'Áo', pants: 'Quần', hat: 'Mũ',
};
export const AVATAR_OPTIONS = { skin: 4, hairColor: 6, hairStyle: 4, shirt: 8, pants: 4, hat: 3 };
export const HAIR_NAMES = ['Tóc ngắn', 'Tóc dài', 'Búi tóc', 'Đầu đinh'];
export const HAT_NAMES = ['Không', 'Nón lá', 'Mũ lưỡi trai'];

export const CHAR_W = 20;
export const CHAR_H = 30;
// Gốc vẽ (chân) nằm ở (10, 29) trên canvas nhân vật

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
export { shade };

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

// Thêm viền tối 1px quanh hình để nổi bật trên nền
function outlined(src, color = '#2a1d16') {
  const [c, ctx] = mk(src.width, src.height);
  const [m, mctx] = mk(src.width, src.height);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) mctx.drawImage(src, dx, dy);
  mctx.globalCompositeOperation = 'source-in';
  mctx.fillStyle = color;
  mctx.fillRect(0, 0, m.width, m.height);
  ctx.drawImage(m, 0, 0);
  ctx.drawImage(src, 0, 0);
  return c;
}

const charCache = new Map();

/**
 * Vẽ nhân vật. dir: up|down|left|right, frame: 0 đứng, 1/2 bước chân, sit: ngồi ghế nhựa
 */
export function getCharSprite(av, dir = 'down', frame = 0, sit = false) {
  const key = `${av.skin}${av.hairColor}${av.hairStyle}${av.shirt}${av.pants}${av.hat}|${dir}|${frame}|${sit}`;
  let s = charCache.get(key);
  if (s) return s;
  const [c, g] = mk(CHAR_W, CHAR_H);
  const P = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const skin = PALETTE.skin[av.skin] || PALETTE.skin[0];
  const hair = PALETTE.hairColor[av.hairColor] || PALETTE.hairColor[0];
  const shirt = PALETTE.shirt[av.shirt] || PALETTE.shirt[0];
  const pants = PALETTE.pants[av.pants] || PALETTE.pants[0];
  const shoe = '#3a2a22';
  const ox = 4; // lề trái
  const sy = sit ? 3 : 0; // ngồi thì hạ thân xuống
  const top = 6 + sy; // đỉnh đầu

  // Chân
  if (sit) {
    if (dir === 'down') {
      P(pants, ox + 2, 22, 3, 3); P(pants, ox + 7, 22, 3, 3);
      P(shoe, ox + 2, 25, 3, 2); P(shoe, ox + 7, 25, 3, 2);
    } else if (dir === 'up') {
      P(pants, ox + 2, 23, 8, 2);
    } else {
      const fx = dir === 'left' ? ox : ox + 6;
      P(pants, ox + 3, 22, 6, 3); P(pants, fx, 23, 6, 2); P(shoe, dir === 'left' ? ox - 1 : ox + 10, 24, 3, 2);
    }
  } else {
    const l = frame === 1 ? -1 : 0, r = frame === 2 ? -1 : 0;
    if (dir === 'left' || dir === 'right') {
      const a = frame === 0 ? 0 : 2;
      P(pants, ox + 4 - a, 23, 3, 5); P(pants, ox + 5 + a, 23, 3, 5);
      P(shoe, ox + 4 - a, 28, 3, 1); P(shoe, ox + 5 + a, 28, 3, 1);
    } else {
      P(pants, ox + 2, 23 + l, 3, 5); P(pants, ox + 7, 23 + r, 3, 5);
      P(shoe, ox + 2, 28 + l, 3, 1); P(shoe, ox + 7, 28 + r, 3, 1);
    }
  }
  // Thân áo
  P(shirt, ox + 1, top + 9, 10, 8);
  P(shade(shirt, -0.12), ox + 1, top + 15, 10, 2);
  if (dir === 'down') P(shade(shirt, -0.18), ox + 5, top + 9, 2, 2); // cổ áo
  // Tay
  const swing = !sit && frame ? (frame === 1 ? 1 : -1) : 0;
  if (dir === 'left' || dir === 'right') {
    const ax = dir === 'left' ? ox + 4 + swing : ox + 6 - swing;
    P(shade(shirt, -0.08), ax, top + 10, 2, 4); P(skin, ax, top + 14, 2, 2);
  } else {
    P(shade(shirt, -0.08), ox, top + 10, 1, 4); P(shade(shirt, -0.08), ox + 11, top + 10, 1, 4);
    P(skin, ox, top + 14 + swing, 1, 2); P(skin, ox + 11, top + 14 - swing, 1, 2);
  }
  // Đầu
  P(skin, ox + 1, top, 10, 9);
  P(shade(skin, -0.08), ox + 1, top + 8, 10, 1);
  // Mặt
  const eye = '#2b1d1a';
  if (dir === 'down') {
    P(eye, ox + 3, top + 4, 1, 2); P(eye, ox + 8, top + 4, 1, 2);
    P('#f19aa0', ox + 2, top + 6, 1, 1); P('#f19aa0', ox + 9, top + 6, 1, 1);
    P(shade(skin, -0.25), ox + 5, top + 7, 2, 1);
  } else if (dir === 'left') {
    P(eye, ox + 2, top + 4, 1, 2); P('#f19aa0', ox + 2, top + 6, 1, 1);
  } else if (dir === 'right') {
    P(eye, ox + 9, top + 4, 1, 2); P('#f19aa0', ox + 9, top + 6, 1, 1);
  }
  // Tóc
  const hs = av.hairStyle | 0;
  const hd = shade(hair, -0.1);
  if (hs === 3) {
    P(hair, ox + 1, top, 10, 2);
    if (dir === 'up') P(hair, ox + 1, top, 10, 5);
  } else {
    P(hair, ox, top - 1, 12, 3);
    if (dir === 'down') { P(hair, ox, top + 2, 2, 3); P(hair, ox + 10, top + 2, 2, 3); P(hd, ox + 3, top + 2, 3, 1); }
    if (dir === 'left') { P(hair, ox + 5, top + 2, 7, 4); P(hair, ox + 10, top + 6, 2, 1); }
    if (dir === 'right') { P(hair, ox, top + 2, 7, 4); P(hair, ox, top + 6, 2, 1); }
    if (dir === 'up') P(hair, ox, top + 2, 12, 7);
    if (hs === 1) { // tóc dài
      if (dir === 'down') { P(hair, ox, top + 5, 2, 7); P(hair, ox + 10, top + 5, 2, 7); }
      if (dir === 'up') P(hair, ox + 1, top + 9, 10, 4);
      if (dir === 'left') P(hair, ox + 7, top + 6, 5, 6);
      if (dir === 'right') P(hair, ox, top + 6, 5, 6);
    }
    if (hs === 2) { // búi tóc
      P(hair, ox + 4, top - 4, 4, 3); P(hd, ox + 4, top - 2, 4, 1);
    }
  }
  // Mũ
  if (av.hat === 1) { // nón lá
    const ny = top - 1;
    const rows = [[8, 2], [7, 4], [6, 6], [5, 8], [4, 10], [2, 14], [1, 16]];
    rows.forEach(([x, w], i) => P(i % 2 ? '#e8d49a' : '#f1e1ac', x, ny - 6 + i, w, 1));
    P('#b9a066', 1, ny + 1, 16, 1);
    if (dir === 'down') { P('#9c6b3c', ox + 1, top + 8, 1, 3); P('#9c6b3c', ox + 10, top + 8, 1, 3); }
  } else if (av.hat === 2) { // mũ lưỡi trai
    P('#d0392b', ox, top - 2, 12, 4); P('#f2efe6', ox + 5, top - 1, 2, 1);
    if (dir === 'down') P('#a02d22', ox, top + 2, 12, 1);
    if (dir === 'left') P('#a02d22', ox - 3, top + 1, 5, 1);
    if (dir === 'right') P('#a02d22', ox + 10, top + 1, 5, 1);
  }
  s = outlined(c);
  charCache.set(key, s);
  return s;
}

// ------- Đồ vật -------
const objCache = new Map();
function cached(key, w, h, draw) {
  let c = objCache.get(key);
  if (c) return c;
  const [cv, ctx] = mk(w, h);
  draw(ctx, (col, x, y, ww = 1, hh = 1) => { ctx.fillStyle = col; ctx.fillRect(x, y, ww, hh); });
  c = outlined(cv, 'rgba(40,25,18,0.85)');
  objCache.set(key, c);
  return c;
}

export const STOOL_COLORS = ['#2f7fd1', '#d13b2f', '#2fae5b', '#e3a21a'];
export function stool(color = 0) {
  return cached(`stool${color}`, 12, 10, (g, P) => {
    const c = STOOL_COLORS[color % STOOL_COLORS.length];
    P(shade(c, 0.15), 1, 1, 10, 3);
    P(c, 1, 4, 10, 1);
    P(shade(c, -0.15), 2, 5, 2, 4); P(shade(c, -0.15), 8, 5, 2, 4);
    P(shade(c, -0.25), 4, 5, 4, 1);
    P(shade(c, 0.35), 3, 2, 6, 1);
  });
}

// Bàn nhựa thấp – ly trà vẽ động phía trên
export function table(kind = 0) {
  const tops = ['#2f7fd1', '#d13b2f', '#c99a5b'];
  return cached(`table${kind}`, 30, 18, (g, P) => {
    const c = tops[kind % tops.length];
    P(shade(c, 0.12), 1, 1, 28, 9);
    P(shade(c, 0.28), 2, 2, 26, 1);
    P(shade(c, -0.15), 1, 10, 28, 2);
    P(shade(c, -0.3), 3, 12, 3, 5); P(shade(c, -0.3), 24, 12, 3, 5);
    P(shade(c, -0.38), 6, 12, 18, 1);
  });
}

export function teaGlass(full = 1) {
  return cached(`glass${full}`, 6, 8, (g, P) => {
    P('rgba(220,240,255,0.9)', 0, 0, 6, 8);
    P(full ? '#c7862a' : '#e9d3a5', 1, 2, 4, 5);
    P(full ? '#e0a64a' : '#f3e5c4', 1, 2, 4, 1);
    P('#ffffff', 1, 3, 2, 2); // đá viên
    P('#ffffff', 3, 5, 1, 1);
    P('rgba(255,255,255,0.8)', 0, 0, 1, 8);
  });
}

export function tree() {
  return cached('tree', 84, 100, (g, P) => {
    // thân cây bàng
    P('#6b4a2e', 37, 52, 10, 46); P('#82593a', 39, 52, 3, 46); P('#523822', 45, 60, 2, 30);
    P('#6b4a2e', 31, 94, 22, 5);
    // tán lá nhiều tầng
    const blob = (cx, cy, r, col) => {
      for (let y = -r; y <= r; y++) {
        const w = Math.round(Math.sqrt(r * r - y * y));
        P(col, cx - w, cy + y, w * 2, 1);
      }
    };
    blob(42, 40, 32, '#2f6b33');
    blob(24, 44, 18, '#2f6b33'); blob(62, 44, 18, '#2f6b33');
    blob(42, 32, 26, '#3f8a3e'); blob(26, 38, 13, '#3f8a3e'); blob(60, 38, 13, '#3f8a3e');
    blob(38, 24, 15, '#56a74b'); blob(56, 30, 8, '#56a74b'); blob(24, 32, 7, '#56a74b');
    blob(34, 18, 6, '#7cc35f');
    // vài lá bàng đỏ
    for (const [x, y] of [[18, 46], [64, 50], [50, 18], [30, 58], [70, 36]]) { P('#c4472b', x, y, 3, 2); P('#e0702f', x + 1, y, 1, 1); }
  });
}

export function cart() {
  return cached('cart', 74, 40, (g, P) => {
    // Bàn gỗ quầy trà
    P('#8a5a32', 2, 18, 70, 6); P('#a8723f', 2, 18, 70, 2);
    P('#6d4526', 2, 24, 70, 13);
    for (let x = 6; x < 70; x += 8) P('#5a381f', x, 25, 1, 12);
    P('#4a2d18', 2, 37, 70, 2);
    // Ấm nhôm to
    P('#b9c2c9', 8, 6, 14, 12); P('#dfe6ea', 10, 7, 4, 9); P('#8d979f', 8, 16, 14, 2);
    P('#8d979f', 12, 3, 6, 3); P('#5a5f63', 14, 1, 2, 2);
    P('#8d979f', 22, 8, 4, 2); P('#8d979f', 25, 6, 2, 3); // vòi ấm
    P('#5a5f63', 4, 8, 4, 1); P('#5a5f63', 4, 8, 1, 6); // quai
    // Phích đỏ
    P('#c0392b', 30, 4, 7, 14); P('#e8664f', 31, 5, 2, 12); P('#f1c40f', 30, 9, 7, 1); P('#7a2318', 31, 2, 5, 2);
    // Lọ kẹo lạc / hướng dương
    P('rgba(230,245,255,0.9)', 41, 8, 9, 10); P('#d9a75a', 42, 11, 7, 6); P('#b8833d', 43, 13, 2, 1); P('#3b8fd6', 41, 6, 9, 2);
    P('rgba(230,245,255,0.9)', 52, 9, 8, 9); P('#3a3a32', 53, 12, 6, 5); P('#77776a', 54, 13, 1, 1); P('#e74c3c', 52, 7, 8, 2);
    // Chồng ly
    P('rgba(225,240,255,0.95)', 63, 8, 6, 10); P('#c9dce8', 63, 11, 6, 1); P('#c9dce8', 63, 14, 6, 1);
  });
}

export function motorbike(color = '#c0392b', rider = null) {
  const k = `bike${color}${rider ? 'r' + rider : ''}`;
  return cached(k, 36, 28, (g, P) => {
    // bánh xe
    P('#1d1d22', 2, 20, 9, 7); P('#55555c', 4, 22, 5, 3);
    P('#1d1d22', 25, 20, 9, 7); P('#55555c', 27, 22, 5, 3);
    // thân xe
    P(color, 7, 15, 22, 6); P(shade(color, 0.2), 9, 15, 10, 2);
    P('#2a2a30', 11, 12, 13, 3); // yên
    P('#9aa3aa', 28, 8, 2, 9); P('#5a5f63', 26, 7, 6, 2); // cổ lái
    P('#f6e58d', 31, 13, 3, 3); // đèn
    P('#7f8c8d', 3, 19, 8, 2); // ống xả
    if (rider) {
      const sh = rider;
      P(sh, 13, 2, 9, 11); P(shade(sh, -0.15), 13, 10, 9, 3);
      P('#26262c', 14, 13, 8, 4); P('#26262c', 21, 15, 3, 4);
      P('#f7d6b5', 22, 5, 5, 2); // tay
      P('#2c3e50', 13, -2 + 2, 9, 3); // mũ bảo hiểm
      P('#e74c3c', 12, 0, 11, 4); P('#f7d6b5', 16, 4, 5, 3);
    }
  });
}

export function lampPost() {
  return cached('lamp', 18, 80, (g, P) => {
    P('#4b5157', 8, 8, 3, 70); P('#6c757d', 8, 8, 1, 70);
    P('#4b5157', 5, 76, 9, 3);
    P('#4b5157', 9, 6, 8, 2); P('#e8e2c8', 12, 8, 5, 2);
  });
}

export function cat(frame = 0, sleeping = false) {
  return cached(`cat${frame}${sleeping}`, 14, 10, (g, P) => {
    const o = '#e08a3c', d = '#b8692a';
    if (sleeping) {
      P(o, 2, 4, 10, 5); P(d, 4, 5, 2, 1); P(d, 8, 5, 2, 1); P(o, 1, 3, 4, 4); P(o, 1, 2, 1, 1); P(o, 4, 2, 1, 1);
      P(o, 11, 7, 3, 2);
      return;
    }
    P(o, 3, 4, 8, 4); P(d, 5, 4, 1, 4); P(d, 8, 4, 1, 4);
    P(o, 9, 1, 4, 4); P(o, 9, 0, 1, 1); P(o, 12, 0, 1, 1); P('#2b1d1a', 11, 2, 1, 1);
    P(o, 1, 2 + frame, 2, 3);
    P(o, 3, 8, 1, 2 - frame); P(o, 9, 8, 1, 1 + frame); P(o, 5, 8, 1, 1 + frame); P(o, 7, 8, 1, 2 - frame);
  });
}

export function signBoard() {
  return cached('sign', 26, 30, (g, P) => {
    P('#f3c623', 1, 1, 24, 18); P('#d35400', 2, 2, 22, 16);
    P('#fff4d6', 4, 5, 18, 2); P('#fff4d6', 4, 9, 14, 2); P('#fff4d6', 4, 13, 16, 2);
    P('#6d4526', 4, 19, 2, 10); P('#6d4526', 20, 19, 2, 10);
  });
}

export function plantPot() {
  return cached('plant', 14, 18, (g, P) => {
    P('#b5532d', 2, 10, 10, 7); P('#d06b3f', 2, 10, 10, 2);
    P('#2f6b33', 3, 3, 8, 7); P('#56a74b', 5, 1, 4, 5); P('#56a74b', 1, 5, 3, 3); P('#56a74b', 10, 5, 3, 3);
  });
}

// Mini sprite cho xem trước avatar
export function drawAvatarPreview(canvas, av, dir = 'down') {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = getCharSprite(av, dir, 0, false);
  const scale = Math.floor(Math.min(canvas.width / CHAR_W, canvas.height / CHAR_H));
  const x = Math.floor((canvas.width - CHAR_W * scale) / 2);
  const y = Math.floor((canvas.height - CHAR_H * scale) / 2);
  ctx.drawImage(s, x, y, CHAR_W * scale, CHAR_H * scale);
}
