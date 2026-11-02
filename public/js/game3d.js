// Engine 3D (Three.js): camera bám nhân vật, ánh sáng ngày/đêm theo giờ VN, xe cộ, NPC, nhãn chữ HTML.
import { THREE, makeCharacter, poseCharacter } from './char3d.js';
import { buildWorld, X, Z, bikeModel, flowerBikeModel } from './scene3d.js';
import * as Wd from './world.js';

const SPEED = 62; // px/giây (cùng hệ toạ độ với server)
const EMOTE_ICON = { wave: '👋', heart: '❤️', hug: '🤗', cheer: '💪', tea: '🍵', sad: '😢', laugh: '😂' };
const NPC_LINES = [
  'Trà đá đây, uống cho mát ruột!', 'Có chuyện gì cứ ngồi xuống kể, cô nghe.',
  'Buồn thì kể, vui thì cười, đừng giữ trong lòng nghen.', 'Ai cũng có ngày mệt mỏi mà con.',
  'Nghỉ chút đi, đời còn dài lắm.', 'Ly trà đá ba nghìn, lời động viên miễn phí!',
  'Mưa rồi cũng tạnh, chuyện rồi cũng qua.', 'Ăn miếng kẹo lạc cho đỡ buồn nè.',
  'Rít điếu thuốc lào cho tỉnh rồi kể tiếp!',
];
const XEOM_LINES = ['Xe ôm không cháu ơi?', 'Đi đâu chú chở, rẻ thôi!', 'Hôm nay đường tắc quá trời.', 'Chú chạy xe ba chục năm, chuyện gì cũng qua hết cháu ạ.', 'Mệt thì ngồi uống ly trà đá đã.'];
const VENDOR_LINES = ['Ai xoài, ổi, mận ngọt không?', 'Hoa quả tươi đây, ngọt lắm!', 'Mua giúp cô ít ổi đi cháu!', 'Ai bánh mì nóng giòn đây!'];
const DIR_ANGLE = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

export class Game3D {
  constructor(canvas, hooks) {
    this.cv = canvas;
    this.hooks = hooks;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;

    const s = (this.scene = new THREE.Scene());
    this.dayColor = new THREE.Color('#a9d8f5');
    this.nightColor = new THREE.Color('#0e1233');
    s.background = this.dayColor.clone();
    s.fog = new THREE.Fog(s.background.clone(), 40, 90);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 200);
    this.dist = coarse ? 24 : 21;
    this.camTarget = new THREE.Vector3(0, 0.8, 2);

    this.hemi = new THREE.HemisphereLight('#dff1ff', '#8a6a4a', 1.1);
    s.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight('#fff1d6', 2.6));
    sun.position.set(-14, 26, 20);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 22, bottom: -22, near: 1, far: 80 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    s.add(sun, sun.target);

    this.world = buildWorld(s);
    const A = this.world.anchors;
    const pl = (col, pos, max, dist) => { const l = new THREE.PointLight(col, 0, dist, 1.4); l.position.copy(pos); l.userData.max = max; s.add(l); return l; };
    this.points = [
      pl('#ff9a50', new THREE.Vector3(X(352), 2.3, Z(Wd.CART.y) - 0.5), 30, 13),
      pl('#ffd890', A.lamp, 60, 20),
      pl('#ffc070', A.steam.clone().add(new THREE.Vector3(0, 1.5, 0.8)), 14, 9),
      pl('#ffe2a0', new THREE.Vector3(X(449), 2.2, Z(170)), 10, 8),
      pl('#ffc25a', new THREE.Vector3(X(120), 3.5, Z(260)), 14, 11),
      pl('#ffc25a', new THREE.Vector3(X(560), 3.3, Z(240)), 14, 11),
    ];

    // Lớp nhãn chữ HTML
    this.labels = document.createElement('div');
    this.labels.className = 'labels3d';
    document.body.appendChild(this.labels);
    this.lbls = new Map();

    this.players = new Map();
    this.me = null;
    this.keys = new Set();
    this.path = null;
    this.pendingAction = null;
    this.tableCounts = {};
    this.sparkles = [];
    this.bubbles = new Map();
    this.emotes = [];
    this.bikes = [];
    this.talk = new Map();
    this.talkNext = { xeom: performance.now() + 9000, vendor: performance.now() + 6000, npc: performance.now() + 4000 };
    this.vendor = { x: 340, y: 338, dir: -1, pause: 0 };
    this.cat = { x: 480, y: 200, tx: 480, ty: 200, t: 0, sleep: 0, ang: 0 };
    this.hover = null;
    this.lastSent = 0;
    this.nightOverride = null;
    this.raycaster = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.tmpV = new THREE.Vector3();

    this.resize();
    addEventListener('resize', () => this.resize());
    this.bindInput();
    this.lastT = performance.now();
    r.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 46 : 36;
    this.camera.updateProjectionMatrix();
  }

  // ---------- Người chơi ----------
  makeModel(p) {
    const m = makeCharacter(p.avatar || {});
    m.position.set(X(p.x), 0, Z(p.y));
    this.scene.add(m);
    return m;
  }
  setMe(p) {
    this.me = { ...p, face: DIR_ANGLE[p.dir] || 0 };
    this.me.model = this.makeModel(p);
    this.players.set(p.sid, this.me);
    this.myId = p.sid;
  }
  upsertPlayer(p) {
    if (p.sid === this.myId) return;
    const ex = this.players.get(p.sid);
    if (ex) Object.assign(ex, { tx: p.x, ty: p.y, dir: p.dir, moving: p.moving, sit: p.sit });
    else {
      const np = { ...p, tx: p.x, ty: p.y, face: DIR_ANGLE[p.dir] || 0 };
      np.model = this.makeModel(np);
      this.players.set(p.sid, np);
    }
  }
  updatePlayer(u) {
    const p = this.players.get(u.sid);
    if (!p) return;
    p.nickname = u.nickname;
    p.avatar = u.avatar;
    this.scene.remove(p.model);
    p.model = this.makeModel(p);
  }
  removePlayer(sid) {
    const p = this.players.get(sid);
    if (p) this.scene.remove(p.model);
    this.players.delete(sid);
    this.bubbles.delete(sid);
  }
  clearPlayers() {
    for (const p of this.players.values()) this.scene.remove(p.model);
    this.players.clear();
    this.me = null;
  }
  say(sid, text) { this.bubbles.set(sid, { text, until: performance.now() + 6000 }); }
  emote(sid, e) { this.emotes.push({ sid, icon: EMOTE_ICON[e] || '✨', t0: performance.now(), id: Math.random() }); }
  setTableCounts(c) {
    this.tableCounts = c;
    for (const [id, t] of Object.entries(this.world.tables)) {
      const n = Math.min(8, c[id] || 0);
      t.glasses.forEach((g, i) => { g.visible = i < n; });
    }
  }
  sparkleTable(id) {
    const t = Wd.tableById[id];
    if (t) this.sparkles.push({ x: t.x, y: t.y, t0: performance.now(), id: Math.random() });
  }
  npcSay(who, text) { this.talk.set(who, { text, until: performance.now() + 4800 }); }

  // ---------- Điều khiển ----------
  bindInput() {
    const typing = () => {
      const a = document.activeElement;
      return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
    };
    addEventListener('keydown', (e) => {
      if (typing() || this.hooks.isUiOpen()) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        this.keys.add(k); this.path = null; this.pendingAction = null; e.preventDefault();
      }
      if ((k === 'e' || k === ' ') && this.hover) { e.preventDefault(); this.interact(this.hover); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    const pts = new Map();
    let pinch = 0, downAt = null;
    this.cv.addEventListener('wheel', (e) => { e.preventDefault(); this.dist = Math.max(9, Math.min(34, this.dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
    this.cv.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); downAt = null; }
    });
    this.cv.addEventListener('pointermove', (e) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.dist = Math.max(9, Math.min(34, this.dist * (pinch / d)));
        pinch = d;
        return;
      }
      if (e.pointerType === 'mouse') {
        const hit = this.pick(e.clientX, e.clientY);
        this.cv.style.cursor = hit && hit.target ? 'pointer' : 'default';
      }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = 0;
      if (!downAt || pts.size) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 10 || !this.me) return;
      const hit = this.pick(e.clientX, e.clientY);
      if (!hit) return;
      const target = hit.target;
      if (target && (target.type === 'xeom' || target.type === 'vendor')) { this.interact(target); return; }
      if (target) {
        const near = this.nearestApproach(target);
        if (Math.hypot(this.me.x - near.x, this.me.y - near.y) < 6) { this.interact(target); return; }
        this.walkTo(near.x, near.y, target);
      } else if (hit.ground) this.walkTo(hit.ground.x, hit.ground.y, null);
    };
    this.cv.addEventListener('pointerup', up);
    this.cv.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); downAt = null; });
  }

  pick(cx, cy) {
    const rect = this.cv.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.world.interactive, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !(o.userData && o.userData.type)) o = o.parent;
      if (o) return { target: o.userData.type === 'table' ? { type: 'table', id: o.userData.id } : { type: o.userData.type } };
    }
    const p = this.raycaster.ray.intersectPlane(this.ground, this.tmpV);
    if (!p) return null;
    return { ground: { x: (p.x + 20) * 16, y: (p.z + 14) * 16 } };
  }

  nearestApproach(target) {
    const me = this.me;
    if (target.type === 'npc') return { x: Wd.CART.x + (me.x < Wd.CART.x ? -12 : 12), y: Wd.CART.y + 10 };
    const t = Wd.tableById[target.id];
    const taken = new Set([...this.players.values()].filter((p) => p !== me && p.sit).map((p) => `${Math.round(p.x)},${Math.round(p.y)}`));
    const free = Wd.stoolsOf(t).filter((s) => !taken.has(`${s.x},${s.y}`));
    const list = free.length ? free : Wd.stoolsOf(t);
    list.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
    return list[0];
  }
  walkTo(x, y, action) {
    if (!this.me) return;
    const p = Wd.findPath(this.me.x, this.me.y, x, y);
    if (p && action && action.type === 'table') {
      const last = p[p.length - 1];
      if (!last || Math.hypot(last.x - x, last.y - y) > 1) p.push({ x, y });
    }
    this.path = p;
    this.pendingAction = action;
    this.me.sit = false;
  }
  interact(target) {
    this.path = null;
    this.pendingAction = null;
    if (target.type === 'table') {
      const s = this.nearestApproach(target);
      if (Math.hypot(this.me.x - s.x, this.me.y - s.y) < 26) {
        this.me.x = s.x; this.me.y = s.y; this.me.dir = s.dir; this.me.sit = true;
        this.sendMove(true);
      }
      this.hooks.onTable(target.id);
    } else if (target.type === 'npc') {
      this.me.dir = 'up';
      this.hooks.onNpc();
    } else if (target.type === 'xeom') {
      this.npcSay('xeom', XEOM_LINES[(Math.random() * XEOM_LINES.length) | 0]);
    } else if (target.type === 'vendor') {
      this.npcSay('vendor', VENDOR_LINES[(Math.random() * VENDOR_LINES.length) | 0]);
      this.vendor.pause = Math.max(this.vendor.pause, 3);
    }
  }
  sendMove(force) {
    const now = performance.now();
    if (!force && now - this.lastSent < 90) return;
    this.lastSent = now;
    const m = this.me;
    this.hooks.onMove({ x: Math.round(m.x * 10) / 10, y: Math.round(m.y * 10) / 10, dir: m.dir, moving: !!m.moving, sit: !!m.sit });
  }

  darkness() {
    if (this.nightOverride !== null) return this.nightOverride;
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
    const h = +parts.find((p) => p.type === 'hour').value + +parts.find((p) => p.type === 'minute').value / 60;
    if (h >= 6.5 && h <= 17) return 0;
    if (h > 17 && h < 19) return ((h - 17) / 2) * 0.62;
    if (h >= 5 && h < 6.5) return ((6.5 - h) / 1.5) * 0.62;
    return 0.62;
  }

  // ---------- Cập nhật ----------
  update(dt, now) {
    const me = this.me;
    if (me) {
      let dx = 0, dy = 0;
      const k = this.keys;
      if (k.has('arrowleft') || k.has('a')) dx -= 1;
      if (k.has('arrowright') || k.has('d')) dx += 1;
      if (k.has('arrowup') || k.has('w')) dy -= 1;
      if (k.has('arrowdown') || k.has('s')) dy += 1;
      if (!dx && !dy && this.path && this.path.length) {
        const n = this.path[0];
        const ddx = n.x - me.x, ddy = n.y - me.y, d = Math.hypot(ddx, ddy);
        if (d < 1.5) {
          me.x = n.x; me.y = n.y; this.path.shift();
          if (!this.path.length) { this.path = null; if (this.pendingAction) this.interact(this.pendingAction); }
        } else { dx = ddx / d; dy = ddy / d; }
      }
      const moving = !!(dx || dy);
      if (moving) {
        const len = Math.hypot(dx, dy);
        const vx = (dx / len) * SPEED * dt, vy = (dy / len) * SPEED * dt;
        const fp = !!this.path;
        if (fp || !Wd.blocked(me.x + vx, me.y)) me.x += vx;
        if (fp || !Wd.blocked(me.x, me.y + vy)) me.y += vy;
        if (Math.abs(dx) > Math.abs(dy)) me.dir = dx < 0 ? 'left' : 'right';
        else me.dir = dy < 0 ? 'up' : 'down';
        me.faceTo = Math.atan2(dx, dy);
        me.sit = false;
      } else me.faceTo = DIR_ANGLE[me.dir];
      if (moving !== me.moving) { me.moving = moving; this.sendMove(true); } else if (moving) this.sendMove(false);
      this.hover = null;
      for (const t of Wd.TABLES) if (Math.hypot(me.x - t.x, me.y - t.y) < 34) { this.hover = { type: 'table', id: t.id }; break; }
      if (!this.hover && Math.abs(me.x - Wd.CART.x) < 60 && me.y > Wd.CART.y - 2 && me.y < Wd.CART.y + 26) this.hover = { type: 'npc' };
    }
    for (const p of this.players.values()) {
      if (p !== me) {
        const ddx = p.tx - p.x, ddy = p.ty - p.y, d = Math.hypot(ddx, ddy);
        if (d > 80) { p.x = p.tx; p.y = p.ty; } else { const f = Math.min(1, dt * 10); p.x += ddx * f; p.y += ddy * f; }
        p.faceTo = p.moving && d > 0.5 ? Math.atan2(ddx, ddy) : DIR_ANGLE[p.dir] || 0;
      }
      p.face = lerpAngle(p.face || 0, p.faceTo ?? 0, Math.min(1, dt * 12));
      p.model.position.set(X(p.x), 0, Z(p.y));
      p.model.rotation.y = p.face;
      poseCharacter(p.model, dt, { moving: p.moving, sit: p.sit });
    }

    // Xe cộ
    if (Math.random() < dt * 0.7 && this.bikes.length < 9) this.spawnVehicle();
    for (const b of this.bikes) {
      const ahead = this.bikes.filter((o) => o !== b && o.lane === b.lane && Math.sign(o.x - b.x) === Math.sign(b.v) && Math.abs(o.x - b.x) < 56);
      const v = ahead.length ? ahead.reduce((m, o) => (Math.abs(o.v) < Math.abs(m) ? o.v : m), b.v) : b.v;
      b.x += v * dt;
      b.model.position.x = X(b.x);
      b.model.position.y = Math.sin(now / 90 + b.ph) * 0.012;
      for (const w of b.model.userData.wheels) w.rotation.z -= (Math.abs(v) / 16) * dt / 0.3;
    }
    this.bikes = this.bikes.filter((b) => {
      const keep = b.x > -90 && b.x < Wd.W + 90;
      if (!keep) this.scene.remove(b.model);
      return keep;
    });

    // Gánh hàng rong
    const vd = this.vendor, vm = this.world.vendor;
    let vmove = false;
    if (vd.pause > 0) vd.pause -= dt;
    else {
      vd.x += vd.dir * 14 * dt; vmove = true;
      if (vd.x < 24 || vd.x > 366) { vd.dir *= -1; vd.x = Math.max(24, Math.min(366, vd.x)); }
      if (Math.random() < dt * 0.08) vd.pause = 3 + Math.random() * 4;
    }
    vm.position.set(X(vd.x), 0, Z(vd.y));
    vm.rotation.y = lerpAngle(vm.rotation.y, vd.dir > 0 ? Math.PI / 2 : -Math.PI / 2, Math.min(1, dt * 5));
    poseCharacter(vm.userData.char, dt, { moving: vmove, speed: 0.6 });
    vm.userData.char.userData.parts.arms[1].rotation.x = -2.6; // tay giữ đòn gánh
    vm.userData.baskets.forEach((b, i) => { b.rotation.x = Math.sin(now / 300 + i) * (vmove ? 0.08 : 0.02); b.position.y = 1.2 + (vmove ? Math.abs(Math.sin(now / 160)) * 0.04 : 0); });

    // Mèo
    const c = this.cat, cm = this.world.cat;
    c.t += dt;
    if (c.sleep > 0) c.sleep -= dt;
    else {
      const ddx = c.tx - c.x, ddy = c.ty - c.y, d = Math.hypot(ddx, ddy);
      if (d < 2) {
        if (Math.random() < 0.4) c.sleep = 6 + Math.random() * 10;
        for (let i = 0; i < 10; i++) {
          const nx = 20 + Math.random() * (Wd.W - 40), ny = Wd.WALL_Y + 14 + Math.random() * (Wd.CURB_Y - Wd.WALL_Y - 20);
          if (!Wd.blocked(nx, ny)) { c.tx = nx; c.ty = ny; break; }
        }
      } else {
        const nx = c.x + (ddx / d) * 22 * dt, ny = c.y + (ddy / d) * 22 * dt;
        if (Wd.blocked(nx, ny)) { c.tx = c.x; c.ty = c.y; } else { c.x = nx; c.y = ny; }
        c.ang = Math.atan2(ddx, ddy);
      }
    }
    cm.position.set(X(c.x), 0, Z(c.y));
    cm.rotation.y = lerpAngle(cm.rotation.y, c.ang, Math.min(1, dt * 6));
    cm.scale.y = c.sleep > 0 ? 0.7 : 1;
    cm.userData.tail.rotation.z = Math.sin(now / 250) * 0.5;

    // NPC lên tiếng
    for (const who of ['xeom', 'vendor', 'npc']) {
      if (now > this.talkNext[who]) {
        const lines = who === 'xeom' ? XEOM_LINES : who === 'vendor' ? VENDOR_LINES : NPC_LINES;
        this.npcSay(who, lines[(Math.random() * lines.length) | 0]);
        this.talkNext[who] = now + 14000 + Math.random() * 22000;
      }
    }
    // Cờ bay, cột cắt tóc, hơi phở, lá rơi
    const t = now / 1000;
    for (const f of this.world.flags) {
      const pos = f.mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = f.base[i * 3] + 0.6;
        pos.setZ(i, Math.sin(x * 5 - t * 6) * 0.07 * x);
      }
      pos.needsUpdate = true;
      f.mesh.geometry.computeVertexNormals();
    }
    for (const sp of this.world.spin) sp.rotation.y += dt * 2;
    const st = this.world.anchors.steam;
    for (const sp of this.world.steam) {
      sp.userData.life += dt;
      if (sp.userData.life > 2.6) { sp.userData.life = 0; sp.position.set(st.x + (Math.random() - 0.5) * 0.6, st.y, st.z + (Math.random() - 0.5) * 0.6); sp.userData.ph = Math.random() * 6; }
      const L = sp.userData.life;
      sp.position.y = st.y + L * 0.6;
      sp.position.x += Math.sin((sp.userData.ph || 0) + L * 2) * 0.004;
      sp.scale.setScalar(0.4 + L * 0.35);
      sp.material.opacity = 0.45 * Math.sin((L / 2.6) * Math.PI);
    }
    for (const l of this.world.leaves) {
      l.userData.life += dt;
      if (l.userData.life > 6 || l.position.y < 0.02) {
        if (l.userData.life > 6) {
          const tr = Wd.TREES[Math.random() < 0.5 ? 0 : 1];
          l.position.set(X(tr.x) + (Math.random() - 0.5) * 4, 3.5 + Math.random(), Z(tr.y) + (Math.random() - 0.5) * 3);
          l.userData.life = 0;
        } else continue;
      }
      l.position.y -= dt * 0.6;
      l.position.x += Math.sin(l.userData.life * 2.4 + l.id) * dt * 0.4;
      l.rotation.set(l.userData.life * 2, l.userData.life * 1.3, l.userData.life);
    }
    // Cô Tư ngồi, đèn lồng đung đưa
    for (const [i, lg] of this.world.lanterns.entries()) lg.rotation.z = Math.sin(now / 700 + i) * 0.06;
  }

  spawnVehicle() {
    const laneI = Math.random() < 0.5 ? 0 : 1;
    const lane = Wd.LANES[laneI];
    const pick = (a) => a[(Math.random() * a.length) | 0];
    const flower = Math.random() < 0.12;
    const opt = {
      rider: pick(['#f2efe6', '#e74c3c', '#3b8fd6', '#f3c623', '#9b59b6', '#5f7f4a', '#ec6fa0', '#2e2e34']),
      helmetColor: pick(['#2c6fbb', '#e74c3c', '#f3c623', '#ffffff', '#2e2e34', '#ec6fa0', '#3fbf6f']),
      basket: Math.random() < 0.4,
    };
    const r = Math.random();
    if (r < 0.25) opt.passenger = pick(['#f2efe6', '#e74c3c', '#3b8fd6', '#f3c623']);
    else if (r < 0.38) opt.cargo = 'box';
    else if (r < 0.48) opt.cargo = 'water';
    else if (r < 0.55) opt.cargo = 'flower';
    const x = lane.dir > 0 ? -70 : Wd.W + 70;
    if (this.bikes.some((b) => b.lane === laneI && Math.abs(b.x - x) < 70)) return;
    const model = flower ? flowerBikeModel() : bikeModel(pick(['#8e2a20', '#2c3e50', '#e8e4da', '#1f5fa8', '#c0392b', '#3a3a40', '#6b2d5c', '#d4a017']), opt);
    model.position.set(X(x), 0, Z(lane.y) - 0.6);
    model.rotation.y = lane.dir > 0 ? 0 : Math.PI;
    this.scene.add(model);
    this.bikes.push({ x, lane: laneI, v: lane.dir * (flower ? 24 : 50 + Math.random() * 55), model, ph: Math.random() * 10 });
  }

  // ---------- Ánh sáng ----------
  applyLighting() {
    const n = this.darkness() / 0.62;
    this.sun.intensity = 2.6 * (1 - n) + 0.12 * n;
    this.sun.color.set(n > 0.05 && n < 0.95 ? '#ffc38a' : '#fff1d6');
    this.hemi.intensity = 1.1 * (1 - n) + 0.35 * n;
    this.hemi.color.set(n > 0.5 ? '#5b6ca8' : '#dff1ff');
    this.scene.background.copy(this.dayColor).lerp(this.nightColor, n);
    this.scene.fog.color.copy(this.scene.background);
    this.renderer.toneMappingExposure = 1.05 + n * 0.25;
    for (const l of this.points) l.intensity = l.userData.max * n * (0.95 + Math.sin(performance.now() / 90) * 0.03);
    for (const gl of this.world.glow) gl.m.emissiveIntensity = (gl.min || 0) + (gl.max - (gl.min || 0)) * n;
  }

  // ---------- Camera ----------
  updateCamera(dt) {
    const me = this.me;
    const tx = me ? X(me.x) : 0, tz = me ? Z(me.y) - 1.8 : -1;
    const want = new THREE.Vector3(Math.max(-13, Math.min(13, tx)), me ? 1.2 : 2.5, Math.max(-4, Math.min(5, tz)));
    this.camTarget.lerp(want, Math.min(1, dt * 4));
    const el = 0.6;
    const dist = me ? this.dist : 30;
    const cam = this.camera;
    cam.position.set(this.camTarget.x, this.camTarget.y + dist * Math.sin(el), this.camTarget.z + dist * Math.cos(el));
    cam.lookAt(this.camTarget);
  }

  // ---------- Nhãn chữ HTML ----------
  label(key, pos, text, cls, extra) {
    let el = this.lbls.get(key);
    if (!el) {
      el = document.createElement('div');
      this.labels.appendChild(el);
      this.lbls.set(key, el);
    }
    el._used = true;
    if (el._cls !== cls) { el.className = `lb ${cls}`; el._cls = cls; }
    if (el._text !== text) { el.textContent = text; el._text = text; }
    const v = this.tmpV.copy(pos).project(this.camera);
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (v.z > 1 || v.x < -1.3 || v.x > 1.3 || v.y < -1.3 || v.y > 1.3) { el.style.display = 'none'; return; }
    el.style.display = '';
    const x = ((v.x + 1) / 2) * w, y = ((1 - v.y) / 2) * h;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${extra && extra.below ? '30%' : '-100%'})${extra && extra.dy ? ` translateY(${extra.dy}px)` : ''}`;
    if (extra && extra.opacity !== undefined) el.style.opacity = extra.opacity; else el.style.opacity = '';
  }
  drawLabels(now) {
    for (const el of this.lbls.values()) el._used = false;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    for (const t of Wd.TABLES) {
      const hov = this.hover && this.hover.type === 'table' && this.hover.id === t.id;
      const n = this.tableCounts[t.id] || 0;
      this.label(`t:${t.id}`, V(X(t.x), 1.25, Z(t.y)), `${t.icon} ${t.name}${n ? ` · ${n} 🍵` : ''}`, hov ? 'tbl hov' : 'tbl');
    }
    const A = this.world.anchors;
    this.label('npc', A.coTu, 'Cô Tư chủ quán', 'npcname');
    const talkers = [['npc', A.coTu, 'Cô Tư chủ quán'], ['xeom', A.xeom, 'Bác xe ôm'], ['vendor', V(X(this.vendor.x), 2.6, Z(this.vendor.y)), 'Cô bán hàng rong']];
    for (const [who, pos, name] of talkers) {
      const tk = this.talk.get(who);
      if (tk && tk.until > now) {
        if (who !== 'npc') this.label(`n:${who}`, pos, name, 'npcname');
        this.label(`b:${who}`, pos, tk.text, 'bubble', { dy: -22 });
      }
    }
    for (const p of this.players.values()) {
      const head = V(X(p.x), p.sit ? 2.05 : 2.35, Z(p.y));
      this.label(`p:${p.sid}`, head, p.nickname, p === this.me ? 'name me' : 'name');
      const b = this.bubbles.get(p.sid);
      if (b && b.until > now) this.label(`pb:${p.sid}`, head, b.text, 'bubble', { dy: -22 });
      else if (b) this.bubbles.delete(p.sid);
    }
    this.emotes = this.emotes.filter((e) => now - e.t0 < 2200);
    for (const e of this.emotes) {
      const p = this.players.get(e.sid);
      if (!p) continue;
      const k = (now - e.t0) / 2200;
      this.label(`e:${e.id}`, V(X(p.x), 2.6 + k * 1.2, Z(p.y)), e.icon, 'emote', { opacity: 1 - k * k });
    }
    this.sparkles = this.sparkles.filter((s) => now - s.t0 < 1800);
    for (const s of this.sparkles) {
      const k = (now - s.t0) / 1800;
      this.label(`s:${s.id}`, V(X(s.x), 0.8 + k * 1.5, Z(s.y)), '✨🍵✨', 'emote', { opacity: 1 - k });
    }
    if (this.hover && this.me && !this.hooks.isUiOpen()) {
      const label = this.hover.type === 'npc' ? 'Trò chuyện với Cô Tư' : `Ngồi bàn ${Wd.tableById[this.hover.id].name}`;
      const touch = matchMedia('(pointer: coarse)').matches;
      this.label('prompt', V(X(this.me.x), 0, Z(this.me.y)), touch ? `👆 Chạm để ${label.toLowerCase()}` : `[E] ${label}`, 'prompt', { below: true });
    }
    for (const [k, el] of this.lbls) if (!el._used) { el.remove(); this.lbls.delete(k); }
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    this.update(dt, now);
    // Cô Tư ngồi uống trà
    const coTu = this.world.interactive.find((o) => o.userData.type === 'npc' && o.userData.parts);
    if (coTu) { poseCharacter(coTu, dt, { sit: true }); coTu.userData.parts.arms[1].rotation.x = -0.9 + Math.sin(now / 1500) * 0.2; }
    this.applyLighting();
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.drawLabels(now);
  }
}
