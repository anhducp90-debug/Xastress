// Dựng góc phố Việt Nam 3D: nhà ống, vỉa hè, quán trà đá, cây, cột điện, xe cộ.
import { THREE, mat, geo, mesh, makeCharacter, poseCharacter } from './char3d.js';
import * as Wd from './world.js';

export const X = (px) => px / 16 - 20;
export const Z = (py) => py / 16 - 14;

const SURFACE = 0; // mặt vỉa hè
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
const R = rng(77);
const shade = (hex, amt) => {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return `#${c.getHexString()}`;
};

// ---------- Kết cấu ----------
function brickTex() {
  return canvasTex(512, 512, (g) => {
    const r = rng(5);
    for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) {
      const x = tx * 64, y = ty * 64;
      const base = ['#c4683f', '#bb5f38', '#c97249', '#b85a36'][(r() * 4) | 0];
      g.fillStyle = base; g.fillRect(x, y, 64, 64);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 31, y + 3, 2, 58); g.fillRect(x + 3, y + 31, 58, 2);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, y, 64, 3);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(x + r() * 64, y + r() * 64, 3, 3); }
      if (r() > 0.975) { g.fillStyle = '#9b968c'; g.fillRect(x, y, 64, 64); g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(x + 10, y + 20, 30, 3); }
      g.fillStyle = '#7e3f26'; g.fillRect(x + 62, y, 2, 64); g.fillRect(x, y + 62, 64, 2);
    }
  }, [60 / 8, 13 / 8]);
}
function asphaltTex() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#4a4b50'; g.fillRect(0, 0, 256, 256);
    const r = rng(9);
    for (let i = 0; i < 2500; i++) { g.fillStyle = r() > 0.5 ? '#55565c' : '#3f4045'; g.fillRect(r() * 256, r() * 256, 2, 2); }
  }, [16, 4]);
}
function stripeTex(a, b, n = 2) {
  return canvasTex(64, 8, (g) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * 64) / n, 0, 64 / n, 8); } });
}
function railingTex() {
  const t = canvasTex(128, 64, (g) => {
    g.clearRect(0, 0, 128, 64);
    g.fillStyle = '#26262c';
    g.fillRect(0, 0, 128, 6); g.fillRect(0, 58, 128, 6);
    for (let x = 2; x < 128; x += 10) g.fillRect(x, 0, 3, 64);
    g.strokeStyle = '#26262c'; g.lineWidth = 3;
    for (let x = 0; x < 128; x += 32) { g.beginPath(); g.arc(x + 16, 32, 10, 0, Math.PI * 2); g.stroke(); }
  });
  return t;
}
function signTex(text, sub, bg, fg) {
  return canvasTex(768, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = shade(bg, -0.2); g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 64;
    g.font = `900 ${size}px Arial, sans-serif`;
    while (g.measureText(text).width > w - 50 && size > 20) { size -= 2; g.font = `900 ${size}px Arial, sans-serif`; }
    g.fillText(text, w / 2, sub ? 50 : h / 2 + 2);
    if (sub) { g.font = '600 26px Arial, sans-serif'; g.globalAlpha = 0.9; g.fillText(sub, w / 2, 100); }
  });
}
function textBoard(lines, bg, fg, w = 256, h = 128, font = '900 54px "Comic Sans MS", "Segoe Print", cursive') {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font;
    lines.forEach((l, i) => g.fillText(l, w / 2, (h / (lines.length + 1)) * (i + 1)));
  });
}
function shopInterior(kind) {
  return canvasTex(256, 128, (g) => {
    const r = rng(kind.length * 31);
    g.fillStyle = '#2a2420'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = 'rgba(255,240,200,0.08)'; g.fillRect(0, 0, 256, 128);
    const cols = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#ecf0f1', '#e67e22', '#9b59b6'];
    if (kind === 'taphoa') {
      for (let y = 14; y < 118; y += 22) {
        g.fillStyle = '#6d4526'; g.fillRect(8, y + 16, 180, 4);
        for (let x = 10; x < 186; x += 9) { g.fillStyle = cols[(r() * 7) | 0]; g.fillRect(x, y, 7, 16); }
      }
      g.fillStyle = '#dfe4e6'; g.fillRect(196, 8, 54, 116); g.fillStyle = '#9cc4e4'; g.fillRect(202, 16, 42, 100);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = cols[(i + j) % 4]; g.fillRect(206 + i * 10, 22 + j * 24, 7, 18); }
    } else if (kind === 'suaxe') {
      g.fillStyle = '#c0392b'; g.fillRect(20, 60, 36, 60);
      g.fillStyle = '#555'; g.fillRect(70, 20, 120, 6);
      for (let i = 0; i < 10; i++) { g.fillStyle = '#999'; g.fillRect(76 + i * 11, 26, 4, 30); }
      g.fillStyle = '#1d1d22'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(210, 40 + i * 30, 16, 0, Math.PI * 2); g.fill(); }
    } else if (kind === 'cattoc') {
      g.fillStyle = '#a8c8d8'; g.fillRect(20, 14, 140, 80); g.fillStyle = '#d8ecf4'; g.fillRect(28, 20, 24, 68);
      g.fillStyle = '#8d2a20'; g.fillRect(70, 70, 50, 40); g.fillStyle = '#2a2a30'; g.fillRect(80, 104, 30, 22);
      g.fillStyle = '#f5f5f5'; g.fillRect(180, 20, 60, 90);
    } else if (kind === 'pho') {
      g.fillStyle = '#e8e4da'; g.fillRect(10, 30, 100, 90); g.fillStyle = '#f7f3ea'; g.fillRect(16, 36, 88, 30);
      g.fillStyle = '#8d2a20'; g.fillRect(24, 44, 22, 12); g.fillRect(56, 44, 22, 12);
      for (let i = 0; i < 3; i++) { g.fillStyle = '#c99a5b'; g.fillRect(124 + i * 44, 76, 36, 8); g.fillStyle = '#5a381f'; g.fillRect(140 + i * 44, 84, 4, 40); }
    } else if (kind === 'com') {
      g.fillStyle = '#d8dde0'; g.fillRect(10, 40, 236, 84); g.fillStyle = '#b8d8e8'; g.fillRect(16, 46, 224, 30);
      const f = ['#f3c623', '#c0392b', '#3f8a3e', '#8d5a2b', '#f2efe6', '#e67e22'];
      for (let i = 0; i < 6; i++) { g.fillStyle = '#9aa3aa'; g.fillRect(18 + i * 38, 84, 32, 24); g.fillStyle = f[i]; g.fillRect(22 + i * 38, 88, 24, 12); }
    } else if (kind === 'quan') {
      g.fillStyle = '#4a2c1c'; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#8a2a1c'; g.fillRect(90, 30, 76, 40); g.fillStyle = '#f3c623'; g.fillRect(118, 38, 20, 22);
      g.fillStyle = '#ff7a3a'; g.fillRect(100, 34, 6, 8); g.fillRect(150, 34, 6, 8);
      g.fillStyle = '#7a4a24'; g.fillRect(0, 0, 70, 128); g.fillRect(186, 0, 70, 128);
      g.fillStyle = '#5f3818'; for (let i = 0; i < 3; i++) { g.fillRect(10, 10 + i * 40, 50, 32); g.fillRect(196, 10 + i * 40, 50, 32); }
    } else {
      g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#7d848b'; for (let y = 0; y < 128; y += 8) g.fillRect(0, y, 256, 2);
    }
  });
}
function shutterTex(color) {
  return canvasTex(32, 64, (g) => {
    g.fillStyle = color; g.fillRect(0, 0, 32, 64);
    g.fillStyle = shade(color, -0.12); for (let y = 4; y < 62; y += 5) g.fillRect(3, y, 26, 2);
    g.strokeStyle = shade(color, -0.2); g.lineWidth = 3; g.strokeRect(1, 1, 30, 62);
  });
}
function glassTex() {
  return canvasTex(64, 96, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 96);
    g.fillStyle = '#4b4b52';
    for (let x = 0; x < 64; x += 16) g.fillRect(x + 7, 0, 3, 96);
    g.fillRect(0, 46, 64, 4);
  });
}
function flagTex() {
  return canvasTex(96, 64, (g) => {
    g.fillStyle = '#da251d'; g.fillRect(0, 0, 96, 64);
    g.fillStyle = '#ffde00'; g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 9 : 22, a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(48 + Math.cos(a) * r, 33 + Math.sin(a) * r);
    }
    g.fill();
  });
}
function softDot(color = '255,255,255') {
  return canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${color},0.9)`); gr.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
}

// ---------- Nhà ống ----------
const HOUSES = [
  { x: -32, w: 6, H: 10.5, wall: '#d9c7a0', shutter: '#6d4526', shop: 'closed' },
  { x: -26, w: 6, H: 12, wall: '#c9d9b8', shutter: '#3f7a4a', shop: 'closed', clothes: true },
  { x: 0, w: 88, H: 12, wall: '#e8c15a', shutter: '#3f7a4a', shop: 'taphoa', flag: true, ac: true },
  { x: 88, w: 104, H: 9.6, wall: '#bcd6dc', shutter: '#7a4a24', shop: 'suaxe', clothes: true },
  { x: 192, w: 120, H: 11, wall: '#f0b7ae', shutter: '#2f6b9a', shop: 'cattoc', flowers: true, ac: true },
  { x: 312, w: 136, H: 11.6, wall: '#ece4cf', shutter: '#3f7a4a', shop: 'quan', roof: true, flowers: true },
  { x: 448, w: 104, H: 10.2, wall: '#a8d39a', shutter: '#7a4a24', shop: 'pho', clothes: true, ac: true },
  { x: 552, w: 88, H: 11.4, wall: '#f0cfa0', shutter: '#6d4526', shop: 'com', flowers: true, flag: true },
  { x: 20, w: 6, H: 12.5, wall: '#f4a7a3', shutter: '#2f6b9a', shop: 'closed', flowers: true },
  { x: 26, w: 6, H: 10, wall: '#9cc4e4', shutter: '#7a4a24', shop: 'closed' },
].map((h) => (h.w > 20 ? { ...h, x: X(h.x), w: h.w / 16 } : h));
const SIGN_INFO = {
  taphoa: Wd.SIGNS[0], suaxe: Wd.SIGNS[1], cattoc: Wd.SIGNS[2], pho: Wd.SIGNS[3], com: Wd.SIGNS[4],
};
const FRONT = Z(Wd.WALL_Y); // mặt tiền

function buildHouse(scene, h, ctx) {
  const g = new THREE.Group();
  const cx = h.x + h.w / 2;
  const wallM = mat(h.wall, { r: 0.9 });
  const body = mesh(geo('box', h.w - 0.04, h.H, 8), wallM, cx, h.H / 2, FRONT - 4);
  g.add(body);
  // gờ tầng & mái
  g.add(mesh(geo('box', h.w, 0.18, 0.3), mat(shade(h.wall, -0.12)), cx, 3.5, FRONT + 0.1));
  if (h.roof) {
    const roof = mesh(geo('box', h.w + 0.3, 0.25, 4.8), mat('#b04a2c', { r: 0.85 }), cx, h.H + 1.0, FRONT - 2.0);
    roof.rotation.x = -0.5; g.add(roof);
    const roof2 = mesh(geo('box', h.w + 0.3, 0.25, 4.8), mat('#9a3f25', { r: 0.85 }), cx, h.H + 1.0, FRONT - 6.0);
    roof2.rotation.x = 0.5; g.add(roof2);
    for (let i = 0; i < h.w; i += 0.5) g.add(mesh(geo('box', 0.06, 0.06, 4.6), mat('#7a2e1a'), h.x + i + 0.2, h.H + 1.16, FRONT - 2.05).rotateX(-0.5));
  } else {
    g.add(mesh(geo('box', h.w, 0.5, 0.25), mat(shade(h.wall, -0.08)), cx, h.H + 0.25, FRONT - 0.12));
    // bồn nước inox & ăng-ten
    const tank = mesh(geo('cyl', 0.5, 0.5, 1.6, 18), mat('#d9e0e4', { r: 0.25, m: 0.8 }), cx + h.w / 4, h.H + 1.0, FRONT - 2);
    tank.rotation.z = Math.PI / 2; g.add(tank);
    g.add(mesh(geo('box', 1.2, 0.5, 0.6), mat('#555c62', { m: 0.5 }), cx + h.w / 4, h.H + 0.25, FRONT - 2));
    g.add(mesh(geo('cyl', 0.02, 0.02, 1.8, 4), mat('#555'), cx - h.w / 4, h.H + 0.9, FRONT - 1.5));
    for (const y of [1.4, 1.1]) g.add(mesh(geo('box', 0.9, 0.03, 0.03), mat('#555'), cx - h.w / 4, h.H + y, FRONT - 1.5));
  }
  // Tầng trên
  const shutterM = new THREE.MeshStandardMaterial({ map: shutterTex(h.shutter), roughness: 0.8 });
  const railM = ctx.railM;
  const n = Math.max(1, Math.round(h.w / 3.4));
  for (let fy = 3.6; fy + 2.6 < h.H; fy += 2.9) {
    for (let i = 0; i < n; i++) {
      const wx = h.x + (h.w / n) * (i + 0.5);
      const wy = fy + 1.45;
      g.add(mesh(geo('box', 1.25, 1.85, 0.12), mat(shade(h.wall, -0.18)), wx, wy, FRONT + 0.02));
      const lit = R() > 0.35;
      const glass = new THREE.Mesh(geo('plane', 1.0, 1.6), lit ? ctx.winLit : ctx.winDark);
      glass.position.set(wx, wy, FRONT + 0.09);
      g.add(glass);
      for (const s of [-1, 1]) {
        const sh = mesh(geo('box', 0.52, 1.6, 0.05), shutterM, wx + s * 0.8, wy, FRONT + 0.2);
        sh.rotation.y = s * -0.45; g.add(sh);
      }
      // ban công
      g.add(mesh(geo('box', 2.3, 0.12, 0.75), mat(shade(h.wall, -0.06)), wx, fy + 0.45, FRONT + 0.38));
      const rail = new THREE.Mesh(geo('plane', 2.3, 0.75), railM);
      rail.position.set(wx, fy + 0.85, FRONT + 0.75); g.add(rail);
      for (const s of [-1, 1]) {
        const rs = new THREE.Mesh(geo('plane', 0.75, 0.75), railM);
        rs.position.set(wx + s * 1.15, fy + 0.85, FRONT + 0.38); rs.rotation.y = Math.PI / 2; g.add(rs);
      }
      // hoa giấy rủ / chậu cây
      if (h.flowers && R() > 0.25) {
        for (let k = 0; k < 16; k++) {
          const b = mesh(geo('ico', 0.09 + R() * 0.07, 0), mat(['#d81b60', '#e2407a', '#f27aa6'][(R() * 3) | 0], { flat: true }), wx - 1.1 + R() * 2.2, fy + 0.95 - R() * 1.1, FRONT + 0.78 + R() * 0.1, false);
          g.add(b);
        }
        for (let k = 0; k < 6; k++) g.add(mesh(geo('ico', 0.1, 0), mat('#3f7a3a', { flat: true }), wx - 1.1 + R() * 2.2, fy + 0.95 - R() * 0.8, FRONT + 0.76, false));
        g.add(mesh(geo('ico', 0.3, 1), mat('#3f7a3a', { flat: true }), wx + 0.9, fy + 0.85, FRONT + 0.6));
      } else if (R() > 0.4) {
        g.add(mesh(geo('cyl', 0.16, 0.12, 0.3, 8), mat('#a8502d'), wx - 0.8, fy + 0.66, FRONT + 0.5));
        g.add(mesh(geo('ico', 0.25, 1), mat('#3f8a3e', { flat: true }), wx - 0.8, fy + 0.95, FRONT + 0.5));
      }
      if (h.clothes && R() > 0.3) {
        g.add(mesh(geo('cyl', 0.01, 0.01, 2.2, 3), mat('#ccc'), wx, fy + 2.1, FRONT + 0.6).rotateZ(Math.PI / 2));
        const cl = ['#e74c3c', '#3b8fd6', '#f2efe6', '#f3c623', '#9b59b6'];
        for (let k = 0; k < 4; k++) {
          const c = new THREE.Mesh(geo('plane', 0.35, 0.5), mat(cl[(R() * 5) | 0], { side: 2 }));
          c.position.set(wx - 0.75 + k * 0.5, fy + 1.82, FRONT + 0.6); g.add(c);
        }
      }
      if (h.ac && i === n - 1 && R() > 0.3) {
        const ax = Math.min(h.x + h.w - 0.6, wx + 1.4);
        g.add(mesh(geo('box', 0.8, 0.55, 0.35), mat('#eceae4', { r: 0.5 }), ax, wy + 0.4, FRONT + 0.2));
        g.add(mesh(geo('cyl', 0.18, 0.18, 0.02, 14), mat('#8d8b84'), ax + 0.12, wy + 0.4, FRONT + 0.38).rotateX(Math.PI / 2));
      }
    }
  }
  if (h.flag) {
    const fx = h.x + h.w - 0.6, fy = 3.6 + 2.9 + 0.8;
    const pole = mesh(geo('cyl', 0.03, 0.03, 1.9, 6), mat('#9aa3aa', { m: 0.6 }), fx, fy + 0.5, FRONT + 0.9);
    pole.rotation.x = 0.45; g.add(pole);
    const fg = new THREE.PlaneGeometry(1.2, 0.8, 12, 2);
    const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: ctx.flagT, side: THREE.DoubleSide, roughness: 0.9 }));
    flag.position.set(fx + 0.62, fy + 1.05, FRONT + 1.25);
    flag.castShadow = true;
    g.add(flag);
    ctx.flags.push({ mesh: flag, base: Float32Array.from(fg.attributes.position.array) });
  }
  // Tầng trệt
  const iw = h.w - 0.6;
  const interior = new THREE.Mesh(geo('plane', iw, 2.6), new THREE.MeshStandardMaterial({ map: shopInterior(h.shop), roughness: 1 }));
  interior.position.set(cx, 1.3, FRONT - 0.35);
  g.add(interior);
  g.add(mesh(geo('box', iw, 0.02, 0.4), mat('#8f887b'), cx, 0.01, FRONT - 0.15, false));
  for (const s of [-1, 1]) g.add(mesh(geo('box', 0.3, 3.5, 0.5), mat(shade(h.wall, -0.1)), cx + s * (h.w / 2 - 0.15), 1.75, FRONT - 0.2));
  g.add(mesh(geo('box', h.w, 0.3, 0.5), mat(shade(h.wall, -0.1)), cx, 3.3, FRONT - 0.2));
  if (h.shop === 'suaxe') {
    // cửa xếp kéo một nửa
    for (let k = 0; k < 14; k++) g.add(mesh(geo('box', 0.04, 2.6, 0.04), mat('#8d969d', { m: 0.6, r: 0.4 }), cx + k * 0.2, 1.3, FRONT - 0.1));
  }
  const si = SIGN_INFO[h.shop];
  if (si) {
    const tex = signTex(si.text, si.sub, si.bg, si.fg);
    const sm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(h.w - 0.5, 0.9, 0.12), [mat(shade(si.bg, -0.25)), mat(shade(si.bg, -0.25)), mat(shade(si.bg, -0.25)), mat(shade(si.bg, -0.25)), sm, mat(shade(si.bg, -0.25))]);
    sign.position.set(cx, 3.05, FRONT + 0.15);
    g.add(sign);
    ctx.glow.push({ m: sm, max: 0.7 });
  }
  if (h.shop === 'cattoc') {
    // cột xoay sọc cắt tóc
    const t = canvasTex(32, 64, (gg) => { for (let i = -64; i < 128; i += 12) { gg.fillStyle = ['#d0261c', '#fff', '#1f5fa8', '#fff'][((i + 64) / 12) % 4]; gg.beginPath(); gg.moveTo(0, i); gg.lineTo(32, i + 16); gg.lineTo(32, i + 28); gg.lineTo(0, i + 12); gg.fill(); } });
    const bp = mesh(geo('cyl', 0.12, 0.12, 0.8, 14), new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 }), h.x + h.w - 0.45, 2.0, FRONT + 0.35);
    g.add(bp);
    ctx.spin.push(bp);
  }
  if (h.shop === 'quan' || h.shop === 'pho') {
    // mái bạt sọc
    const aw = new THREE.Mesh(geo('plane', h.w - 0.4, 1.3), new THREE.MeshStandardMaterial({ map: (() => { const t = stripeTex(h.shop === 'pho' ? '#c0392b' : '#2f7fd1', '#f6f1e3', 2); t.wrapS = THREE.RepeatWrapping; t.repeat.set(Math.round(h.w * 1.2), 1); return t; })(), side: THREE.DoubleSide, roughness: 0.9 }));
    aw.position.set(cx, 3.65, FRONT + 0.55); aw.rotation.x = -1.05; aw.castShadow = true;
    if (h.shop === 'pho') g.add(aw);
  }
  scene.add(g);
}

// ---------- Đồ vật ----------
function stool(color) {
  const g = new THREE.Group();
  const m = mat(color, { r: 0.45 });
  g.add(mesh(geo('box', 0.4, 0.05, 0.4), m, 0, 0.3, 0));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = mesh(geo('box', 0.06, 0.3, 0.06), m, sx * 0.15, 0.15, sz * 0.15);
    l.rotation.z = sx * 0.12; l.rotation.x = -sz * 0.12; g.add(l);
  }
  g.add(mesh(geo('box', 0.36, 0.04, 0.04), m, 0, 0.12, 0.17));
  g.add(mesh(geo('box', 0.36, 0.04, 0.04), m, 0, 0.12, -0.17));
  return g;
}
function lowTable(kind) {
  const g = new THREE.Group();
  const top = ['#2f7fd1', '#c4372d', '#c99a5b'][kind];
  const m = mat(top, { r: kind === 2 ? 0.75 : 0.4 });
  g.add(mesh(geo('box', 1.55, 0.06, 0.95), m, 0, 0.42, 0));
  g.add(mesh(geo('box', 1.45, 0.04, 0.85), mat(shade(top, 0.08)), 0, 0.455, 0, false));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(mesh(geo('box', 0.07, 0.42, 0.07), mat(shade(top, -0.15)), sx * 0.66, 0.21, sz * 0.38));
  return g;
}
function teaGlass() {
  const g = new THREE.Group();
  g.add(mesh(geo('cyl', 0.065, 0.055, 0.17, 12), mat('#d2ecff', { o: 0.45, r: 0.05 }), 0, 0.085, 0, false));
  g.add(mesh(geo('cyl', 0.056, 0.048, 0.12, 12), mat('#c8862a', { o: 0.85, r: 0.2 }), 0, 0.065, 0, false));
  g.add(mesh(geo('box', 0.045, 0.045, 0.045), mat('#ffffff', { o: 0.8, r: 0.1 }), 0.01, 0.12, 0, false));
  return g;
}

export function makeBike(body, o = {}) {
  const g = new THREE.Group();
  const tire = mat('#1b1b1f', { r: 0.9 });
  const chrome = mat('#c7ced3', { m: 0.8, r: 0.3 });
  const wheels = [];
  for (const wx of [-0.68, 0.7]) {
    const w = new THREE.Group(); w.position.set(wx, 0.3, 0);
    w.add(mesh(geo('torus', 0.24, 0.08, 8, 18), tire));
    w.add(mesh(geo('cyl', 0.13, 0.13, 0.1, 12), chrome).rotateX(Math.PI / 2));
    g.add(w); wheels.push(w);
  }
  const bm = mat(body, { r: 0.35, m: 0.2 });
  g.add(mesh(geo('box', 0.9, 0.32, 0.34), bm, -0.15, 0.55, 0));
  const front = mesh(geo('box', 0.32, 0.6, 0.36), bm, 0.48, 0.66, 0); front.rotation.z = -0.25; g.add(front);
  g.add(mesh(geo('box', 0.95, 0.12, 0.3), mat('#222226', { r: 0.6 }), -0.2, 0.78, 0)); // yên
  g.add(mesh(geo('cyl', 0.03, 0.03, 0.8, 6), chrome, 0.62, 0.6, 0).rotateZ(-0.35));
  g.add(mesh(geo('box', 0.06, 0.06, 0.62), mat('#333'), 0.75, 1.0, 0)); // ghi đông
  const lamp = mesh(geo('box', 0.12, 0.14, 0.18), mat('#fff6c2', { e: '#fff1a8', ei: 0.6 }), 0.84, 0.92, 0);
  g.add(lamp);
  g.add(mesh(geo('cyl', 0.04, 0.05, 0.5, 8), chrome, -0.45, 0.32, 0.18).rotateZ(Math.PI / 2 - 0.1)); // ống xả
  if (o.basket) g.add(mesh(geo('box', 0.26, 0.2, 0.32), mat('#7d848b', { m: 0.5 }), 0.92, 0.9, 0));
  if (o.helmet) g.add(mesh(geo('sphere', 0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(o.helmet, { r: 0.3 }), 0.72, 1.06, 0.3));
  if (o.cargo === 'box') g.add(mesh(geo('box', 0.6, 0.45, 0.5), mat('#f4f4ef', { r: 0.9 }), -0.62, 1.05, 0));
  if (o.cargo === 'water') g.add(mesh(geo('cyl', 0.2, 0.2, 0.55, 12), mat('#3a86d6', { o: 0.85, r: 0.2 }), -0.62, 1.1, 0));
  if (o.cargo === 'flower') {
    for (let i = 0; i < 9; i++) g.add(mesh(geo('ico', 0.12, 0), mat(['#f06292', '#ffd54f', '#e53935', '#ffffff'][i % 4], { flat: true }), -0.7 + (i % 3) * 0.15, 1.05 + ((i / 3) | 0) * 0.12, -0.15 + (i % 2) * 0.3));
  }
  if (o.rider) {
    const ch = makeCharacter({ skin: (Math.random() * 3) | 0, hairColor: 0, hairStyle: (Math.random() * 3) | 0, shirt: 0, pants: 2, hat: 0 }, { hat: 'helmet', hatColor: o.helmetColor, shirt: o.rider });
    ch.rotation.y = Math.PI / 2;
    ch.position.set(-0.12, 0.38, 0);
    poseCharacter(ch, 0, { ride: true });
    g.add(ch);
    if (o.passenger) {
      const p2 = makeCharacter({ skin: 1, hairColor: 1, hairStyle: 1, shirt: 0, pants: 0, hat: 0 }, { hat: 'helmet', hatColor: '#f3c623', shirt: o.passenger });
      p2.rotation.y = Math.PI / 2; p2.position.set(-0.6, 0.42, 0);
      poseCharacter(p2, 0, { ride: true });
      g.add(p2);
    }
  }
  g.userData.wheels = wheels;
  return g;
}

function flowerBike() {
  const g = new THREE.Group();
  const frame = mat('#2f6b9a', { r: 0.4, m: 0.3 });
  const wheels = [];
  for (const wx of [-0.62, 0.62]) {
    const w = new THREE.Group(); w.position.set(wx, 0.34, 0);
    w.add(mesh(geo('torus', 0.32, 0.025, 6, 22), mat('#222')));
    g.add(w); wheels.push(w);
  }
  g.add(mesh(geo('cyl', 0.025, 0.025, 1.2, 6), frame, 0, 0.6, 0).rotateZ(Math.PI / 2 - 0.1));
  g.add(mesh(geo('cyl', 0.025, 0.025, 0.6, 6), frame, -0.1, 0.55, 0).rotateZ(0.4));
  g.add(mesh(geo('cyl', 0.025, 0.025, 0.7, 6), frame, 0.55, 0.65, 0).rotateZ(-0.3));
  const fl = ['#f06292', '#ffd54f', '#e53935', '#ffffff', '#ba68c8'];
  g.add(mesh(geo('box', 0.7, 0.3, 0.7), mat('#a87436', { r: 0.9 }), -0.75, 0.85, 0));
  for (let i = 0; i < 22; i++) g.add(mesh(geo('ico', 0.11, 0), mat(fl[i % 5], { flat: true }), -1.05 + (i % 5) * 0.15, 1.05 + Math.random() * 0.3, -0.3 + ((i * 7) % 5) * 0.15));
  g.add(mesh(geo('box', 0.35, 0.2, 0.4), mat('#a87436'), 0.85, 0.95, 0));
  for (let i = 0; i < 5; i++) g.add(mesh(geo('ico', 0.09, 0), mat(fl[(i + 2) % 5], { flat: true }), 0.78 + (i % 3) * 0.08, 1.12, -0.12 + i * 0.06));
  const ch = makeCharacter({ skin: 1, hairColor: 0, hairStyle: 1, shirt: 5, pants: 0, hat: 1 }, { hat: 'nonla', shirt: '#f2efe6' });
  ch.rotation.y = Math.PI / 2; ch.position.set(-0.05, 0.42, 0);
  poseCharacter(ch, 0, { ride: true });
  g.add(ch);
  g.userData.wheels = wheels;
  return g;
}

function vendorModel() {
  const g = new THREE.Group();
  const ch = makeCharacter({ skin: 1, hairColor: 0, hairStyle: 2, shirt: 0, pants: 2, hat: 1 }, { hat: 'nonla', shirt: '#c85a54' });
  g.add(ch);
  const pole = mesh(geo('cyl', 0.035, 0.035, 2.4, 6), mat('#c9a25a'), 0.2, 1.2, 0);
  pole.rotation.x = Math.PI / 2; g.add(pole);
  const baskets = [];
  for (const z of [-1.1, 1.1]) {
    const b = new THREE.Group(); b.position.set(0.2, 1.2, z);
    for (const [dx, dz] of [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]]) {
      const s = mesh(geo('cyl', 0.008, 0.008, 0.7, 3), mat('#5a3d24'), dx / 2, -0.35, dz / 2, false);
      s.rotation.z = dx * 0.6; s.rotation.x = -dz * 0.6; b.add(s);
    }
    b.add(mesh(geo('cyl', 0.36, 0.28, 0.26, 14), mat('#a87436', { r: 0.95 }), 0, -0.75, 0));
    const fruit = ['#e53935', '#ffb300', '#7cb342'];
    for (let i = 0; i < 7; i++) b.add(mesh(geo('sphere', 0.1, 8, 6), mat(fruit[i % 3], { r: 0.5 }), Math.cos(i) * 0.18, -0.58 + (i % 2) * 0.06, Math.sin(i) * 0.18));
    g.add(b); baskets.push(b);
  }
  g.userData.char = ch;
  g.userData.baskets = baskets;
  return g;
}

function catModel() {
  const g = new THREE.Group();
  const o = mat('#e08a3c', { r: 0.9 });
  g.add(mesh(geo('capsule', 0.11, 0.3, 4, 8), o, 0, 0.18, 0).rotateX(Math.PI / 2));
  const head = mesh(geo('sphere', 0.13, 12, 10), o, 0, 0.28, 0.25); g.add(head);
  for (const s of [-1, 1]) g.add(mesh(geo('cone', 0.05, 0.1, 4), o, s * 0.07, 0.42, 0.25));
  for (const s of [-1, 1]) g.add(mesh(geo('sphere', 0.02, 6, 4), mat('#1e1614'), s * 0.05, 0.3, 0.37, false));
  const tail = mesh(geo('capsule', 0.035, 0.28, 3, 6), o, 0, 0.32, -0.3); tail.rotation.x = -0.6; g.add(tail);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(mesh(geo('cyl', 0.035, 0.035, 0.12, 6), o, sx * 0.07, 0.06, sz * 0.13));
  g.userData.tail = tail;
  return g;
}

function catenary(a, b, sag, m) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const k = i / 16;
    pts.push(new THREE.Vector3(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * sag, a.z + (b.z - a.z) * k));
  }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.02, 4), m);
}

function treeBang() {
  const g = new THREE.Group();
  g.add(mesh(geo('cyl', 0.2, 0.28, 3.4, 10), mat('#6b4a2e', { r: 1 }), 0, 1.7, 0));
  g.add(mesh(geo('cyl', 0.3, 0.31, 1.0, 10), mat('#f4f1e8', { r: 1 }), 0, 0.5, 0)); // gốc quét vôi
  const tiers = [[2.9, 2.3], [3.6, 1.9], [4.25, 1.45], [4.8, 0.95]];
  const greens = ['#2f6b33', '#3f8a3e', '#4f9a45', '#5aa64b'];
  tiers.forEach(([y, r], ti) => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + ti;
      const c = mesh(geo('ico', 0.75, 1), mat(greens[(i + ti) % 4], { flat: true }), Math.cos(a) * r * 0.6, y, Math.sin(a) * r * 0.6);
      c.scale.set(1.2, 0.38, 1.2); g.add(c);
    }
    const c = mesh(geo('ico', r * 0.8, 1), mat(greens[ti % 4], { flat: true }), 0, y, 0);
    c.scale.y = 0.3; g.add(c);
    // cành ngang
    for (let i = 0; i < 3; i++) {
      const br = mesh(geo('cyl', 0.05, 0.07, r, 5), mat('#6b4a2e'), Math.cos(i * 2 + ti) * r * 0.45, y - 0.15, Math.sin(i * 2 + ti) * r * 0.45);
      br.rotation.z = Math.PI / 2; br.rotation.y = i * 2 + ti; g.add(br);
    }
  });
  for (let i = 0; i < 14; i++) {
    const t = tiers[(R() * 4) | 0];
    const a = R() * Math.PI * 2;
    g.add(mesh(geo('box', 0.22, 0.04, 0.16), mat(R() > 0.5 ? '#c4472b' : '#e0702f'), Math.cos(a) * t[1], t[0] + 0.12, Math.sin(a) * t[1]));
  }
  return g;
}
function treePhuong() {
  const g = new THREE.Group();
  g.add(mesh(geo('cyl', 0.2, 0.3, 3.2, 10), mat('#5d4128', { r: 1 }), 0, 1.6, 0));
  g.add(mesh(geo('cyl', 0.31, 0.32, 1.0, 10), mat('#f4f1e8', { r: 1 }), 0, 0.5, 0));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const c = mesh(geo('ico', 1.0, 1), mat(['#2d5e2a', '#447f35', '#5c9a42'][i % 3], { flat: true }), Math.cos(a) * 1.5, 3.5 + (i % 2) * 0.3, Math.sin(a) * 1.5);
    c.scale.set(1.3, 0.55, 1.3); g.add(c);
  }
  const top = mesh(geo('ico', 1.6, 1), mat('#447f35', { flat: true }), 0, 3.95, 0); top.scale.y = 0.5; g.add(top);
  const fl = ['#d7261e', '#f04a24', '#ff7a3a', '#c41a1a'];
  const inst = new THREE.InstancedMesh(geo('ico', 0.17, 0), mat('#ffffff', { flat: true }), 90);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 90; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 2.4;
    m4.makeTranslation(Math.cos(a) * d, 3.9 + (1 - d / 2.4) * 0.6 + R() * 0.3, Math.sin(a) * d);
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, new THREE.Color(fl[(R() * 4) | 0]));
  }
  inst.castShadow = true;
  g.add(inst);
  return g;
}

// =========================================================
export function buildWorld(scene) {
  const ctx = {
    glow: [], flags: [], spin: [], tables: {}, interactive: [], anchors: {},
    railM: new THREE.MeshStandardMaterial({ map: railingTex(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 }),
    winLit: new THREE.MeshStandardMaterial({ color: '#33505f', roughness: 0.2, metalness: 0.3, map: glassTex(), emissive: new THREE.Color('#ffb85a'), emissiveIntensity: 0 }),
    winDark: new THREE.MeshStandardMaterial({ color: '#2a3c48', roughness: 0.2, metalness: 0.3, map: glassTex() }),
    flagT: flagTex(),
  };
  ctx.glow.push({ m: ctx.winLit, max: 0.9 });

  // Mặt đất
  const side = new THREE.Mesh(new THREE.PlaneGeometry(64, Z(Wd.CURB_Y) - FRONT), new THREE.MeshStandardMaterial({ map: brickTex(), roughness: 0.95 }));
  side.rotation.x = -Math.PI / 2;
  side.position.set(0, SURFACE, (FRONT + Z(Wd.CURB_Y)) / 2);
  side.receiveShadow = true;
  scene.add(side);
  scene.add(mesh(geo('box', 64, 0.12, 0.35), mat('#c9c2b4', { r: 0.9 }), 0, 0.06, FRONT + 0.17));
  const curbT = stripeTex('#ece8de', '#c8372d'); curbT.wrapS = THREE.RepeatWrapping; curbT.repeat.set(64, 1);
  const curb = mesh(geo('box', 64, 0.22, 0.45), new THREE.MeshStandardMaterial({ map: curbT, roughness: 0.8 }), 0, -0.02, Z(Wd.CURB_Y) + 0.22);
  scene.add(curb);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(64, 8), new THREE.MeshStandardMaterial({ map: asphaltTex(), roughness: 0.95 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, -0.12, Z(Wd.CURB_Y) + 4.4); road.receiveShadow = true;
  scene.add(road);
  for (let x = -31; x < 32; x += 2.6) {
    const d = mesh(geo('box', 1.4, 0.01, 0.12), mat('#ece8de', { r: 0.7 }), x, -0.11, Z(414), false);
    d.receiveShadow = true; scene.add(d);
  }
  for (const x of [-16, 1, 17]) scene.add(mesh(geo('box', 1.0, 0.02, 0.32), mat('#2b2c30', { m: 0.5 }), x, -0.11, Z(Wd.CURB_Y) + 0.7, false));
  // vỉa hè bên kia đường
  scene.add(mesh(geo('box', 64, 0.3, 5), mat('#b9b2a4', { r: 0.95 }), 0, 0, Z(Wd.CURB_Y) + 10.9));
  scene.add(mesh(geo('box', 64, 0.24, 0.4), new THREE.MeshStandardMaterial({ map: curbT, roughness: 0.8 }), 0, 0.03, Z(Wd.CURB_Y) + 8.5));
  for (let x = -30; x < 31; x += 6) {
    scene.add(mesh(geo('cyl', 0.15, 0.2, 2.2, 8), mat('#6b4a2e'), x, 1.1, Z(Wd.CURB_Y) + 10.5));
    const c = mesh(geo('ico', 1.2, 1), mat('#3f7a3a', { flat: true }), x, 2.7, Z(Wd.CURB_Y) + 10.5); c.scale.y = 0.7; scene.add(c);
  }

  for (const h of HOUSES) buildHouse(scene, h, ctx);

  // Hố cây & cây
  for (const t of Wd.TREES) {
    const tx = X(t.x), tz = Z(t.y) - 0.4;
    scene.add(mesh(geo('box', 1.8, 0.1, 1.2), mat('#7b7468'), tx, 0.05, tz));
    scene.add(mesh(geo('box', 1.55, 0.11, 0.95), mat('#5b4330', { r: 1 }), tx, 0.06, tz, false));
    const tr = t.kind === 'bang' ? treeBang() : treePhuong();
    tr.position.set(tx, 0, tz);
    tr.rotation.y = t.kind === 'bang' ? 0.3 : 1.1;
    scene.add(tr);
  }

  // Bàn & ghế nhựa
  let si = 0;
  for (const t of Wd.TABLES) {
    const g = lowTable(t.kind);
    g.position.set(X(t.x), 0, Z(t.y));
    g.userData = { type: 'table', id: t.id };
    const glasses = [];
    for (let i = 0; i < 8; i++) {
      const gl = teaGlass();
      gl.position.set(-0.5 + (i % 4) * 0.33, 0.475, -0.18 + Math.floor(i / 4) * 0.34);
      gl.visible = false;
      g.add(gl); glasses.push(gl);
    }
    scene.add(g);
    ctx.tables[t.id] = { group: g, glasses };
    ctx.interactive.push(g);
    for (const s of Wd.stoolsOf(t)) {
      const st = stool(si++ % 2 ? '#2f7fd1' : '#d13b2f');
      st.position.set(X(s.x), 0, Z(s.y));
      st.rotation.y = R() * 0.4 - 0.2;
      scene.add(st);
    }
  }

  // ----- Quán trà đá -----
  const stall = new THREE.Group();
  const cx = X(Wd.CART.x), cz = Z(Wd.CART.y) - 0.7;
  stall.position.set(cx, 0, cz);
  const wood = mat('#8a5a32', { r: 0.85 });
  stall.add(mesh(geo('box', 4.6, 0.1, 1.1), wood, 0, 0.75, 0));
  for (const [sx, sz] of [[-2.2, -0.45], [2.2, -0.45], [-2.2, 0.45], [2.2, 0.45], [0, 0.45]]) stall.add(mesh(geo('box', 0.1, 0.75, 0.1), mat('#5a381f'), sx, 0.375, sz));
  stall.add(mesh(geo('box', 4.4, 0.05, 0.9), mat('#6d4526'), 0, 0.25, 0));
  stall.add(mesh(geo('box', 1.1, 0.55, 0.7), mat('#f6f6f1', { r: 1 }), -1.1, 0.55, 0)); // thùng xốp đá
  stall.add(mesh(geo('box', 1.12, 0.06, 0.72), mat('#e4e4dc', { r: 1 }), -1.1, 0.85, 0));
  // bình trà đá nhựa đỏ
  stall.add(mesh(geo('cyl', 0.34, 0.34, 0.8, 18), mat('#c0392b', { r: 0.35 }), -1.75, 1.2, -0.05));
  stall.add(mesh(geo('cyl', 0.24, 0.3, 0.12, 16), mat('#f2efe6', { r: 0.4 }), -1.75, 1.66, -0.05));
  stall.add(mesh(geo('cyl', 0.04, 0.04, 0.16, 6), mat('#f2efe6'), -1.75, 0.98, 0.33).rotateX(Math.PI / 2));
  // ấm tích trong giỏ ủ
  stall.add(mesh(geo('cyl', 0.36, 0.32, 0.5, 18), mat('#a87436', { r: 1 }), -0.75, 1.05, -0.05));
  stall.add(mesh(geo('sphere', 0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f2ece0', { r: 0.3 }), -0.75, 1.3, -0.05));
  stall.add(mesh(geo('cyl', 0.03, 0.05, 0.3, 6), mat('#f2ece0', { r: 0.3 }), -0.47, 1.38, -0.05).rotateZ(-0.9));
  stall.add(mesh(geo('torus', 0.18, 0.025, 6, 12, Math.PI), mat('#7d5222'), -0.75, 1.55, -0.05));
  // khay kẹo lạc, hướng dương, cốc
  stall.add(mesh(geo('box', 1.4, 0.04, 0.6), mat('#c7ced3', { m: 0.7, r: 0.3 }), 0.4, 0.82, 0));
  const jar = (x, c, lid) => {
    stall.add(mesh(geo('cyl', 0.13, 0.13, 0.32, 12), mat('#e6f3ff', { o: 0.45, r: 0.05 }), x, 1.0, 0));
    stall.add(mesh(geo('cyl', 0.11, 0.11, 0.22, 12), mat(c), x, 0.96, 0, false));
    stall.add(mesh(geo('cyl', 0.135, 0.135, 0.05, 12), mat(lid), x, 1.18, 0));
  };
  jar(-0.05, '#d9a75a', '#2f7fd1'); jar(0.28, '#3a3a32', '#d13b2f'); jar(0.6, '#f0d080', '#f3c623');
  for (let i = 0; i < 4; i++) { const gl = teaGlass(); gl.position.set(1.2 + (i % 2) * 0.16, 0.8, -0.1 + (i >> 1) * 0.16); stall.add(gl); }
  // điếu cày
  const dc = mesh(geo('cyl', 0.06, 0.07, 1.3, 10), mat('#c9a25a', { r: 0.6 }), 2.1, 1.35, 0.1);
  dc.rotation.z = 0.12; stall.add(dc);
  stall.add(mesh(geo('cyl', 0.025, 0.025, 0.25, 6), mat('#7a6a5a'), 2.0, 1.15, 0.22).rotateX(0.9));
  stall.userData = { type: 'npc' };
  scene.add(stall);
  ctx.interactive.push(stall);
  // Cô Tư
  const coTu = makeCharacter({ skin: 1, hairColor: 0, hairStyle: 2, shirt: 7, pants: 2, hat: 1 }, { hat: 'nonla', shirt: '#4f8f8a' });
  coTu.position.set(X(Wd.NPC_POS.x), 0, cz - 1.0);
  const coStool = stool('#2f7fd1'); coStool.position.copy(coTu.position); scene.add(coStool);
  coTu.userData.type = 'npc';
  scene.add(coTu);
  ctx.interactive.push(coTu);
  ctx.anchors.coTu = new THREE.Vector3(coTu.position.x, 2.2, coTu.position.z);
  // Ô che
  const umT = canvasTex(256, 32, (gg) => { for (let i = 0; i < 8; i++) { gg.fillStyle = i % 2 ? '#f3e2b3' : '#c8372d'; gg.fillRect(i * 32, 0, 32, 32); } });
  const umb = new THREE.Group();
  umb.position.set(X(352), 0, cz - 0.2);
  const cone = mesh(geo('cone', 3.4, 0.95, 16, 1, true), new THREE.MeshStandardMaterial({ map: umT, side: THREE.DoubleSide, roughness: 0.85 }), 0, 3.2, 0);
  umb.add(cone);
  umb.add(mesh(geo('cyl', 0.05, 0.05, 3.7, 8), mat('#9aa3aa', { m: 0.6 }), 0, 1.85, 0));
  umb.add(mesh(geo('sphere', 0.1, 8, 6), mat('#e8d9a8'), 0, 3.72, 0));
  const banner = new THREE.Mesh(geo('plane', 3.0, 0.55), new THREE.MeshStandardMaterial({ map: textBoard(['☕ TRÀ ĐÁ XẢ STRESS'], '#7a2318', '#fff4d6', 768, 128, '900 76px Arial, sans-serif'), side: THREE.DoubleSide, roughness: 0.8 }));
  banner.position.set(0, 2.42, 2.95); banner.rotation.x = -0.1; umb.add(banner);
  const lanternGlow = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const lg = new THREE.Group(); lg.position.set(Math.cos(a) * 3.0, 2.55, Math.sin(a) * 3.0);
    const lm = new THREE.MeshStandardMaterial({ color: '#d6281f', emissive: new THREE.Color('#ff5a2a'), emissiveIntensity: 0.15, roughness: 0.6 });
    const body = mesh(geo('sphere', 0.2, 12, 8), lm, 0, -0.25, 0); body.scale.y = 1.3; lg.add(body);
    lg.add(mesh(geo('cyl', 0.12, 0.12, 0.05, 10), mat('#f3c623', { m: 0.4 }), 0, -0.01, 0));
    lg.add(mesh(geo('cyl', 0.12, 0.12, 0.05, 10), mat('#f3c623', { m: 0.4 }), 0, -0.5, 0));
    lg.add(mesh(geo('cyl', 0.01, 0.01, 0.25, 3), mat('#f3c623'), 0, -0.64, 0));
    umb.add(lg); lanternGlow.push(lg);
    ctx.glow.push({ m: lm, max: 1.6, min: 0.15 });
  }
  scene.add(umb);
  ctx.lanterns = lanternGlow;
  // Bìa các-tông "TRÀ ĐÁ 3k"
  const carton = new THREE.Group();
  carton.position.set(X(288), 0, Z(186));
  const ct = textBoard(['TRÀ ĐÁ', '3k'], '#c9a36b', '#3a2216');
  carton.add(mesh(geo('box', 0.9, 0.65, 0.04), [mat('#a9844f'), mat('#a9844f'), mat('#a9844f'), mat('#a9844f'), new THREE.MeshStandardMaterial({ map: ct, roughness: 1 }), mat('#a9844f')], 0, 0.75, 0));
  for (const s of [-0.3, 0.3]) carton.add(mesh(geo('box', 0.05, 0.6, 0.05), mat('#8a6a3c'), s, 0.3, -0.03));
  carton.rotation.y = 0.25; carton.rotation.z = 0.04;
  scene.add(carton);

  // ----- Đồ vật vỉa hè -----
  const P = (px, py) => [X(px), Z(py)];
  { // bao gạo
    const [x, z] = P(24, 162);
    for (const [dx, dz, s] of [[-0.3, 0, 1], [0.35, 0.05, 0.95], [0, 0, 0.9]]) {
      const b = mesh(geo('capsule', 0.28, 0.35, 4, 10), mat('#ece6d4', { r: 1 }), x + dx, 0.32 + (s < 0.92 ? 0.4 : 0), z + dz); b.rotation.z = Math.PI / 2; b.scale.setScalar(s); scene.add(b);
    }
  }
  { // két nước
    const [x, z] = P(67, 160);
    [['#d13b2f', -0.3, 0], ['#f3c623', 0.35, 0], ['#2f7fd1', 0, 0.45]].forEach(([c, dx, y]) => {
      scene.add(mesh(geo('box', 0.6, 0.38, 0.45), mat(c, { r: 0.5 }), x + dx, 0.19 + y, z));
      for (let i = 0; i < 4; i++) scene.add(mesh(geo('cyl', 0.04, 0.04, 0.2, 6), mat('#4a7a2a', { o: 0.85 }), x + dx - 0.18 + i * 0.12, 0.45 + y, z));
    });
  }
  { // lốp xe
    const [x, z] = P(110, 162);
    for (let i = 0; i < 4; i++) scene.add(mesh(geo('torus', 0.3, 0.13, 8, 18), mat('#1f1f22', { r: 0.9 }), x, 0.13 + i * 0.24, z).rotateX(Math.PI / 2));
  }
  { // kệ chai xăng lẻ
    const [x, z] = P(170, 162);
    for (const y of [0.35, 0.8]) scene.add(mesh(geo('box', 1.0, 0.05, 0.35), wood, x, y, z));
    for (const sx of [-0.45, 0.45]) scene.add(mesh(geo('box', 0.05, 1.0, 0.05), mat('#5a381f'), x + sx, 0.5, z));
    for (const y of [0.37, 0.82]) for (let i = 0; i < 4; i++) {
      scene.add(mesh(geo('cyl', 0.07, 0.08, 0.32, 8), mat(i % 2 ? '#f0a020' : '#e8c040', { o: 0.85, r: 0.2 }), x - 0.33 + i * 0.22, y + 0.18, z));
      scene.add(mesh(geo('cyl', 0.03, 0.03, 0.06, 6), mat('#d13b2f'), x - 0.33 + i * 0.22, y + 0.37, z));
    }
    const xs = new THREE.Mesh(geo('plane', 0.6, 0.25), new THREE.MeshStandardMaterial({ map: textBoard(['XĂNG'], '#ffffff', '#c0261c', 256, 96, '900 64px Arial'), roughness: 1 }));
    xs.position.set(x, 1.15, z + 0.05); scene.add(xs);
  }
  { // thùng rác
    const [x, z] = P(240, 164);
    scene.add(mesh(geo('cyl', 0.25, 0.22, 0.75, 12), mat('#2e7d32', { r: 0.5 }), x, 0.38, z));
    scene.add(mesh(geo('cyl', 0.27, 0.27, 0.06, 12), mat('#1b5e20'), x, 0.78, z));
  }
  for (const [px, py] of [[186, 152], [532, 152]]) {
    const [x, z] = P(px, py);
    scene.add(mesh(geo('cyl', 0.25, 0.18, 0.4, 10), mat('#b5532d'), x, 0.2, z));
    scene.add(mesh(geo('ico', 0.38, 1), mat('#3f8a3e', { flat: true }), x, 0.65, z));
  }
  { // xe bánh mì
    const [x, z] = P(449, 166);
    const g = new THREE.Group(); g.position.set(x, 0, z);
    g.add(mesh(geo('box', 2.6, 0.08, 1.0), mat('#c7ced3', { m: 0.6, r: 0.3 }), 0, 0.9, 0));
    g.add(mesh(geo('box', 2.4, 0.5, 0.9), mat('#4a5157', { m: 0.3 }), 0, 0.62, 0));
    g.add(mesh(geo('box', 2.5, 0.8, 0.95), mat('#e6f6ff', { o: 0.3, r: 0.05 }), 0, 1.34, 0, false));
    for (let i = 0; i < 6; i++) { const b = mesh(geo('capsule', 0.07, 0.4, 4, 8), mat('#d99a44', { r: 0.7 }), -0.9 + i * 0.36, 1.03, -0.15 + (i % 2) * 0.25); b.rotation.z = Math.PI / 2; g.add(b); }
    const st = textBoard(['BÁNH MÌ'], '#c0392b', '#ffe066', 512, 96, '900 66px Arial');
    const sb = mesh(geo('box', 2.5, 0.4, 0.06), [mat('#8e2a20'), mat('#8e2a20'), mat('#8e2a20'), mat('#8e2a20'), new THREE.MeshStandardMaterial({ map: st, emissive: new THREE.Color('#fff'), emissiveMap: st, emissiveIntensity: 0, roughness: 0.6 }), mat('#8e2a20')], 0, 1.95, 0.2);
    g.add(sb);
    ctx.glow.push({ m: sb.material[4], max: 0.8 });
    for (const [wx, wz] of [[-0.9, 0.45], [0.9, 0.45], [-0.9, -0.45], [0.9, -0.45]]) g.add(mesh(geo('torus', 0.17, 0.06, 6, 12), mat('#1b1b1f'), wx, 0.22, wz));
    g.add(mesh(geo('cyl', 0.16, 0.16, 0.45, 10), mat('#2f7fd1', { r: 0.3 }), -0.8, 0.6, 0.2));
    scene.add(g);
  }
  { // nồi phở trên bếp than
    const [x, z] = P(502, 160);
    scene.add(mesh(geo('cyl', 0.42, 0.38, 0.6, 14), mat('#3a3a3a', { r: 1 }), x, 0.3, z));
    const coal = mesh(geo('cyl', 0.3, 0.3, 0.02, 12), mat('#ff6a2a', { e: '#ff5a1a', ei: 0.8 }), x, 0.61, z, false);
    scene.add(coal);
    scene.add(mesh(geo('cyl', 0.62, 0.58, 0.9, 20), mat('#cfd6da', { m: 0.8, r: 0.3 }), x, 1.07, z));
    scene.add(mesh(geo('cyl', 0.56, 0.56, 0.02, 20), mat('#b8743a', { r: 0.2 }), x, 1.5, z, false));
    ctx.anchors.steam = new THREE.Vector3(x, 1.6, z);
  }

  // ----- Cột điện, dây điện, đèn -----
  const px0 = X(Wd.POLE.x), pz0 = Z(Wd.POLE.y) - 0.3;
  const concrete = mat('#a3a29b', { r: 0.95 });
  scene.add(mesh(geo('cyl', 0.13, 0.2, 11, 10), concrete, px0, 5.5, pz0));
  for (const [y, w] of [[10.6, 2.4], [9.9, 1.6]]) {
    scene.add(mesh(geo('box', w, 0.12, 0.12), mat('#5d5c58'), px0, y, pz0));
    for (const s of [-1, 1]) scene.add(mesh(geo('cyl', 0.05, 0.05, 0.16, 8), mat('#eee'), px0 + s * (w / 2 - 0.1), y + 0.14, pz0));
  }
  scene.add(mesh(geo('box', 0.55, 0.8, 0.45), mat('#6f7a72', { m: 0.3 }), px0 + 0.35, 7.6, pz0));
  for (let i = 0; i < 3; i++) scene.add(mesh(geo('torus', 0.35, 0.03, 4, 16), mat('#1d1d20'), px0, 5.4 + i * 0.12, pz0).rotateX(Math.PI / 2 - 0.2));
  const flyer = ['#f5f0d8', '#fff59a', '#ffffff', '#ffd0d0'];
  for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(geo('plane', 0.22, 0.28), mat(flyer[i % 4])); f.position.set(px0 + (R() - 0.5) * 0.06, 1.4 + i * 0.32, pz0 + 0.2); f.rotation.z = (R() - 0.5) * 0.2; scene.add(f); }
  const armCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(px0, 8.6, pz0), new THREE.Vector3(px0 + 0.3, 9.6, pz0 - 0.5), new THREE.Vector3(px0 + 1.4, 9.4, pz0 - 1.4));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(armCurve, 12, 0.06, 6), mat('#6f6e69')));
  const lampHeadM = new THREE.MeshStandardMaterial({ color: '#fff4d0', emissive: new THREE.Color('#ffdf9a'), emissiveIntensity: 0 });
  scene.add(mesh(geo('box', 0.7, 0.18, 0.4), mat('#4b5157', { m: 0.4 }), px0 + 1.55, 9.35, pz0 - 1.45));
  scene.add(mesh(geo('box', 0.55, 0.04, 0.3), lampHeadM, px0 + 1.55, 9.24, pz0 - 1.45, false));
  ctx.glow.push({ m: lampHeadM, max: 2.2 });
  ctx.anchors.lamp = new THREE.Vector3(px0 + 1.55, 9.0, pz0 - 1.45);
  const wireM = mat('#141418', { r: 0.6 });
  const top1 = (s) => new THREE.Vector3(px0 + s * 1.1, 10.75, pz0);
  const top2 = (s) => new THREE.Vector3(px0 + s * 0.7, 10.05, pz0);
  const F = (x, y) => new THREE.Vector3(x, y, FRONT + 0.05);
  for (const [a, b, sag] of [
    [top1(-1), F(-20, 9.0), 1.2], [top1(-1), F(-14, 8.6), 1.0], [top2(-1), F(-17, 7.0), 0.8], [top2(-1), F(-11, 7.6), 0.6],
    [top1(1), F(-1, 10.2), 0.9], [top1(1), F(8, 9.0), 1.3], [top2(1), F(2, 7.4), 0.6], [top2(1), F(14, 8.4), 1.4],
    [top1(1), new THREE.Vector3(32, 10, pz0), 1.8], [top1(-1), new THREE.Vector3(-32, 10, pz0), 1.8],
    [top2(-1), new THREE.Vector3(-30, 9.5, pz0 + 1), 1.6],
  ]) scene.add(catenary(a, b, sag, wireM));
  // dây điện dọc mặt tiền
  for (const y of [8.0, 8.25]) scene.add(catenary(F(-32, y), F(32, y), 0.5, wireM));

  // Dây bóng đèn tròn
  const bulbM = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: new THREE.Color('#ffc25a'), emissiveIntensity: 0.1, roughness: 0.3 });
  ctx.glow.push({ m: bulbM, max: 2.0, min: 0.1 });
  const strings = [
    [new THREE.Vector3(X(Wd.TREES[0].x) + 0.4, 3.4, Z(Wd.TREES[0].y) - 0.4), new THREE.Vector3(px0, 4.5, pz0)],
    [new THREE.Vector3(X(Wd.TREES[1].x) - 0.4, 3.4, Z(Wd.TREES[1].y) - 0.4), new THREE.Vector3(X(352) + 2.9, 2.75, cz + 0.8)],
    [new THREE.Vector3(px0, 4.5, pz0), new THREE.Vector3(X(352) - 2.9, 2.75, cz + 0.8)],
  ];
  for (const [a, b] of strings) {
    scene.add(catenary(a, b, 0.7, wireM));
    for (let i = 1; i < 9; i++) {
      const k = i / 9;
      scene.add(mesh(geo('sphere', 0.07, 8, 6), bulbM, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 0.7 - 0.08, a.z + (b.z - a.z) * k, false));
    }
  }

  // Xe máy đỗ & bác xe ôm
  const parked = [['#8e2a20', { basket: true, helmet: '#f3c623' }], ['#2c3e50', { helmet: '#e74c3c' }], ['#e8e4da', { basket: true }], ['#1f5fa8', { helmet: '#ffffff' }]];
  parked.forEach(([c, o], i) => {
    const b = makeBike(c, o);
    b.position.set(X(392 + i * 28), 0, Z(342));
    b.rotation.y = -Math.PI / 2 + 0.35 + (i % 2) * 0.1;
    scene.add(b);
  });
  const xeom = new THREE.Group();
  const xb = makeBike('#2c3e50', {}); xeom.add(xb);
  const xo = makeCharacter({ skin: 2, hairColor: 4, hairStyle: 3, shirt: 2, pants: 3, hat: 0 }, { hat: 'coi', shirt: '#5f7f4a', pants: '#4a5a3a' });
  xo.position.set(-0.15, 0.25, 0.05); xo.rotation.y = 0.2;
  poseCharacter(xo, 0, { sit: true });
  xo.userData.parts.body.position.y = 0;
  xeom.add(xo);
  xeom.position.set(X(Wd.XEOM.x), 0, Z(Wd.XEOM.y) - 0.3);
  xeom.rotation.y = -0.25;
  xeom.userData.type = 'xeom';
  scene.add(xeom);
  ctx.interactive.push(xeom);
  ctx.anchors.xeom = new THREE.Vector3(xeom.position.x, 2.6, xeom.position.z);

  // Gánh hàng rong, mèo
  ctx.vendor = vendorModel();
  ctx.vendor.userData.type = 'vendor';
  scene.add(ctx.vendor);
  ctx.interactive.push(ctx.vendor);
  ctx.cat = catModel();
  scene.add(ctx.cat);

  // Hơi phở & lá rơi
  const steamT = softDot();
  ctx.steam = Array.from({ length: 14 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamT, transparent: true, depthWrite: false, opacity: 0 }));
    sp.userData.life = Math.random() * 2.5;
    scene.add(sp); return sp;
  });
  ctx.leaves = Array.from({ length: 22 }, (_, i) => {
    const l = new THREE.Mesh(geo('plane', 0.16, 0.11), mat(i % 3 ? '#d0502a' : '#e53922', { side: 2 }));
    l.userData.life = Math.random() * 6;
    l.castShadow = true;
    scene.add(l); return l;
  });
  ctx.factories = { makeBike, flowerBike };
  return ctx;
}

export { makeBike as bikeModel, flowerBike as flowerBikeModel, poseCharacter };
