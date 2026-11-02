// Nhân vật 3D phong cách chibi + kho vật liệu/hình khối dùng chung.
import * as THREE from '/vendor/three/three.module.js';
import { PALETTE } from './sprites.js';

export { THREE };

// ---------- Vật liệu & hình khối dùng chung ----------
const mats = new Map();
export function mat(color, o = {}) {
  const key = `${color}|${o.r ?? 0.8}|${o.m ?? 0}|${o.e || ''}|${o.ei ?? 0}|${o.o ?? 1}|${o.flat ? 1 : 0}|${o.side || 0}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: o.r ?? 0.8, metalness: o.m ?? 0, flatShading: !!o.flat,
      emissive: o.e ? new THREE.Color(o.e) : new THREE.Color(0), emissiveIntensity: o.ei ?? 0,
      transparent: (o.o ?? 1) < 1, opacity: o.o ?? 1, side: o.side === 2 ? THREE.DoubleSide : THREE.FrontSide,
    });
    mats.set(key, m);
  }
  return m;
}
const geos = new Map();
export function geo(kind, ...a) {
  const key = kind + a.join(',');
  let g = geos.get(key);
  if (!g) {
    const C = {
      box: THREE.BoxGeometry, sphere: THREE.SphereGeometry, cyl: THREE.CylinderGeometry, cone: THREE.ConeGeometry,
      capsule: THREE.CapsuleGeometry, torus: THREE.TorusGeometry, plane: THREE.PlaneGeometry, ico: THREE.IcosahedronGeometry,
    }[kind];
    g = new C(...a);
    geos.set(key, g);
  }
  return g;
}
export function mesh(g, m, x = 0, y = 0, z = 0, shadow = true) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  if (shadow) { o.castShadow = true; o.receiveShadow = true; }
  return o;
}

const HAIR_TOP = new THREE.SphereGeometry(0.41, 24, 16);
const SHOE = '#3a2a22';

/**
 * Tạo nhân vật. av: {skin, hairColor, hairStyle, shirt, pants, hat}
 * opt.hat ghi đè mũ: 'nonla' | 'cap' | 'helmet' | 'coi' | null; opt.hatColor
 */
export function makeCharacter(av, opt = {}) {
  const skin = PALETTE.skin[av.skin] || PALETTE.skin[0];
  const hairC = PALETTE.hairColor[av.hairColor] || PALETTE.hairColor[0];
  const shirt = opt.shirt || PALETTE.shirt[av.shirt] || PALETTE.shirt[0];
  const pants = opt.pants || PALETTE.pants[av.pants] || PALETTE.pants[0];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Chân: đùi + cẳng (có khớp gối để ngồi ghế nhựa thấp)
  const legs = [];
  for (const sx of [-0.13, 0.13]) {
    const hip = new THREE.Group(); hip.position.set(sx, 0.6, 0);
    hip.add(mesh(geo('capsule', 0.105, 0.16, 4, 10), mat(pants), 0, -0.15, 0));
    const knee = new THREE.Group(); knee.position.set(0, -0.3, 0);
    knee.add(mesh(geo('capsule', 0.095, 0.14, 4, 10), mat(pants), 0, -0.13, 0));
    knee.add(mesh(geo('box', 0.17, 0.09, 0.26), mat(SHOE, { r: 0.6 }), 0, -0.27, 0.04));
    hip.add(knee);
    body.add(hip);
    legs.push({ hip, knee });
  }
  // Thân áo
  const torso = mesh(geo('capsule', 0.27, 0.28, 6, 14), mat(shirt), 0, 0.93, 0);
  torso.scale.set(1, 1, 0.82);
  body.add(torso);
  body.add(mesh(geo('cyl', 0.1, 0.12, 0.08, 10), mat(skin), 0, 1.24, 0)); // cổ
  // Tay
  const arms = [];
  for (const sx of [-0.34, 0.34]) {
    const sh = new THREE.Group(); sh.position.set(sx, 1.12, 0);
    sh.add(mesh(geo('capsule', 0.08, 0.2, 4, 8), mat(shirt), 0, -0.13, 0));
    sh.add(mesh(geo('sphere', 0.085, 10, 8), mat(skin), 0, -0.36, 0));
    sh.rotation.z = sx < 0 ? -0.08 : 0.08;
    body.add(sh);
    arms.push(sh);
  }
  // Đầu to dễ thương
  const head = new THREE.Group(); head.position.set(0, 1.55, 0);
  body.add(head);
  const face = mesh(geo('sphere', 0.38, 28, 20), mat(skin, { r: 0.7 }));
  head.add(face);
  const eyeM = mat('#1e1614', { r: 0.3 });
  for (const sx of [-0.13, 0.13]) {
    const e = mesh(geo('sphere', 0.05, 10, 8), eyeM, sx, 0.0, 0.345, false);
    e.scale.set(1, 1.3, 0.5);
    head.add(e);
    head.add(mesh(geo('sphere', 0.016, 6, 4), mat('#ffffff', { r: 0.2 }), sx + 0.018, 0.025, 0.37, false));
    const b = mesh(geo('sphere', 0.06, 10, 6), mat('#f19aa0', { r: 0.9 }), sx * 1.55, -0.09, 0.31, false);
    b.scale.set(1, 0.55, 0.3);
    head.add(b);
  }
  const mouth = mesh(geo('capsule', 0.014, 0.05, 2, 6), mat('#9c4a3a'), 0, -0.13, 0.355, false);
  mouth.rotation.z = Math.PI / 2;
  head.add(mouth);

  // Tóc
  const hairM = mat(hairC, { r: 0.65 });
  const hs = av.hairStyle | 0;
  const hatKind = opt.hat !== undefined ? opt.hat : [null, 'nonla', 'cap'][av.hat | 0];
  if (hs === 3) {
    const h = mesh(HAIR_TOP, hairM, 0, 0.1, -0.05); h.scale.set(0.97, 0.9, 0.97); head.add(h);
  } else {
    const h = mesh(HAIR_TOP, hairM, 0, 0.06, -0.06); head.add(h);
    // mái tóc
    const fr = mesh(geo('sphere', 0.2, 12, 8), hairM, -0.12, 0.24, 0.24); fr.scale.set(1.3, 0.55, 0.6); head.add(fr);
    if (hs === 1) {
      const back = mesh(geo('capsule', 0.3, 0.42, 6, 12), hairM, 0, -0.32, -0.16); back.scale.set(1.15, 1, 0.55); head.add(back);
    }
    if (hs === 2) head.add(mesh(geo('sphere', 0.15, 12, 10), hairM, 0, 0.36, -0.22));
  }
  // Mũ
  if (hatKind === 'nonla') {
    const c = mesh(geo('cone', 0.56, 0.34, 28, 1), mat('#efdcaa', { r: 0.9 }), 0, 0.5, 0);
    head.add(c);
    const rim = mesh(geo('torus', 0.545, 0.016, 6, 28), mat('#c9b27c'), 0, 0.34, 0);
    rim.rotation.x = Math.PI / 2; head.add(rim);
  } else if (hatKind === 'cap') {
    const cap = mesh(geo('sphere', 0.425, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(opt.hatColor || '#d0392b'), 0, 0.06, -0.02);
    head.add(cap);
    head.add(mesh(geo('box', 0.42, 0.035, 0.3), mat(opt.hatColor || '#a02d22'), 0, 0.1, 0.42));
  } else if (hatKind === 'helmet') {
    const hm = mesh(geo('sphere', 0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(opt.hatColor || '#2c6fbb', { r: 0.35 }), 0, 0.02, -0.02);
    head.add(hm);
    head.add(mesh(geo('box', 0.5, 0.05, 0.12), mat('#222', { r: 0.4 }), 0, 0.12, 0.42));
  } else if (hatKind === 'coi') {
    const hm = mesh(geo('sphere', 0.44, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#6b8a4a'), 0, 0.08, 0);
    hm.scale.y = 0.85; head.add(hm);
    head.add(mesh(geo('cyl', 0.56, 0.56, 0.03, 24), mat('#5a7a3a'), 0, 0.1, 0));
  }
  root.userData.parts = { body, legs, arms, head, torso };
  root.userData.anim = { phase: Math.random() * 6, face: 0 };
  return root;
}

// Tư thế: đi bộ, đứng, ngồi ghế nhựa (cao ~0.3), ngồi xe máy
export function poseCharacter(ch, dt, { moving = false, sit = false, ride = false, speed = 1 } = {}) {
  const { body, legs, arms, head } = ch.userData.parts;
  const a = ch.userData.anim;
  if (moving) a.phase += dt * 9 * speed;
  const s = Math.sin(a.phase);
  if (sit || ride) {
    body.position.y = ride ? -0.06 : -0.27;
    for (const l of legs) { l.hip.rotation.x = -Math.PI / 2 + (ride ? 0.35 : 0); l.knee.rotation.x = Math.PI / 2 - (ride ? 0.2 : 0); }
    arms.forEach((ar, i) => { ar.rotation.x = ride ? -1.1 : -0.35; ar.rotation.z = (i ? 1 : -1) * 0.12; });
    head.rotation.z = Math.sin(performance.now() / 1400 + a.phase) * 0.03;
  } else if (moving) {
    body.position.y = Math.abs(Math.cos(a.phase)) * 0.05;
    legs[0].hip.rotation.x = s * 0.6; legs[1].hip.rotation.x = -s * 0.6;
    legs[0].knee.rotation.x = Math.max(0, -s) * 0.7; legs[1].knee.rotation.x = Math.max(0, s) * 0.7;
    arms[0].rotation.x = -s * 0.55; arms[1].rotation.x = s * 0.55;
    head.rotation.z = 0;
  } else {
    const br = Math.sin(performance.now() / 700 + a.phase) * 0.012;
    body.position.y = br;
    for (const l of legs) { l.hip.rotation.x *= 0.8; l.knee.rotation.x *= 0.8; }
    for (const ar of arms) ar.rotation.x *= 0.8;
    head.rotation.z = 0;
  }
}
