// Vòng lặp game: vẽ quán, nhân vật, xe cộ, ngày/đêm; điều khiển bàn phím & chạm.
import * as S from './sprites.js';
import * as Wd from './world.js';
import * as V from './vnart.js';

const SPEED = 62; // px/giây
const EMOTE_ICON = { wave: '👋', heart: '❤️', hug: '🤗', cheer: '💪', tea: '🍵', sad: '😢', laugh: '😂' };
const NPC_LINES = [
  'Trà đá đây, uống cho mát ruột!',
  'Có chuyện gì cứ ngồi xuống kể, cô nghe.',
  'Buồn thì kể, vui thì cười, đừng giữ trong lòng nghen.',
  'Ai cũng có ngày mệt mỏi mà con.',
  'Nghỉ chút đi, đời còn dài lắm.',
  'Ly trà đá hai nghìn, lời động viên miễn phí!',
  'Mưa rồi cũng tạnh, chuyện rồi cũng qua.',
  'Ăn miếng kẹo lạc cho đỡ buồn nè.',
  'Rít điếu thuốc lào cho tỉnh rồi kể tiếp!',
  'Trà đá hôm nay cô pha đậm, uống cho tỉnh táo.',
];
const XEOM_LINES = [
  'Xe ôm không cháu ơi?', 'Đi đâu chú chở, rẻ thôi!', 'Hôm nay đường tắc quá trời.',
  'Chú chạy xe ba chục năm, chuyện gì cũng qua hết cháu ạ.', 'Mệt thì ngồi uống ly trà đá đã.',
];
const VENDOR_LINES = [
  ['Ai xoài, ổi, mận ngọt không?', 'Hoa quả tươi đây, ngọt lắm!', 'Mua giúp cô ít ổi đi cháu!'],
  ['Ai bánh mì nóng giòn đây!', 'Xôi lạc, bánh giò đây!', 'Ai bánh khúc nóng không?'],
];

export class Game {
  constructor(canvas, hooks) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks; // { onMove, onTable, onNpc, isUiOpen }
    this.view = document.createElement('canvas');
    this.vctx = this.view.getContext('2d');
    this.bg = Wd.renderBackground();
    this.statics = Wd.staticSprites();
    this.players = new Map();
    this.me = null;
    this.keys = new Set();
    this.path = null;
    this.pendingAction = null;
    this.tableCounts = {};
    this.sparkles = [];
    this.bubbles = new Map(); // sid -> {text, until}
    this.emotes = [];
    this.leaves = [];
    this.bikes = [];
    this.cat = { x: 480, y: 200, tx: 480, ty: 200, t: 0, sleep: 0, dir: 1 };
    this.vendor = { x: 340, y: 338, dir: -1, pause: 0, goods: 0, anim: 0, frame: 0 };
    this.steam = [];
    this.talk = new Map(); // bong bóng của các NPC phụ: xeom, vendor
    this.talkNext = { xeom: performance.now() + 9000, vendor: performance.now() + 6000 };
    this.npc = { bubble: null, until: 0, next: performance.now() + 4000 };
    this.hover = null;
    this.lastSent = 0;
    this.time = 0;
    this.nightOverride = null;
    this.resize();
    addEventListener('resize', () => this.resize());
    this.bindInput();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ---------- Thiết lập ----------
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    const zc = Math.max(2, Math.floor(Math.min(w / Wd.W, h / Wd.H) + 0.15));
    this.zoom = zc * dpr;
    this.dpr = dpr;
    this.vw = Math.ceil(this.cv.width / this.zoom);
    this.vh = Math.ceil(this.cv.height / this.zoom);
    this.view.width = this.vw;
    this.view.height = this.vh;
    this.vctx.imageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;
  }

  setMe(p) {
    this.me = { ...p, frame: 0, anim: 0, idle: 0 };
    this.players.set(p.sid, this.me);
    this.myId = p.sid;
  }
  upsertPlayer(p) {
    if (p.sid === this.myId) return;
    const ex = this.players.get(p.sid);
    if (ex) Object.assign(ex, { tx: p.x, ty: p.y, dir: p.dir, moving: p.moving, sit: p.sit });
    else this.players.set(p.sid, { ...p, tx: p.x, ty: p.y, frame: 0, anim: 0 });
  }
  updatePlayer(u) {
    const p = this.players.get(u.sid);
    if (p) { p.nickname = u.nickname; p.avatar = u.avatar; }
  }
  removePlayer(sid) { this.players.delete(sid); this.bubbles.delete(sid); }
  clearPlayers() { this.players.clear(); this.me = null; }
  say(sid, text) { this.bubbles.set(sid, { text, until: performance.now() + 6000 }); }
  emote(sid, e) { this.emotes.push({ sid, icon: EMOTE_ICON[e] || '✨', t0: performance.now() }); }
  setTableCounts(c) { this.tableCounts = c; }
  sparkleTable(id) {
    const t = Wd.tableById[id];
    if (t) this.sparkles.push({ x: t.x, y: t.y - 6, t0: performance.now() });
  }

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
      if ((k === 'e' || k === ' ' || k === 'enter') && this.hover && k !== 'enter') { e.preventDefault(); this.interact(this.hover); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    const toWorld = (ev) => {
      const r = this.cv.getBoundingClientRect();
      const sx = (ev.clientX - r.left) * this.dpr, sy = (ev.clientY - r.top) * this.dpr;
      return { x: sx / this.zoom + this.camX, y: sy / this.zoom + this.camY };
    };
    this.cv.addEventListener('pointermove', (ev) => {
      const w = toWorld(ev);
      const t = this.hitTest(w.x, w.y);
      this.cv.style.cursor = t ? 'pointer' : 'default';
    });
    this.cv.addEventListener('pointerdown', (ev) => {
      if (!this.me) return;
      const w = toWorld(ev);
      const target = this.hitTest(w.x, w.y);
      if (target && (target.type === 'xeom' || target.type === 'vendor')) { this.interact(target); return; }
      if (target) {
        const near = this.nearestApproach(target);
        if (Math.hypot(this.me.x - near.x, this.me.y - near.y) < 6) { this.interact(target); return; }
        this.walkTo(near.x, near.y, target);
      } else {
        this.walkTo(w.x, w.y, null);
      }
    });
  }

  hitTest(x, y) {
    for (const t of Wd.TABLES) if (Math.abs(x - t.x) < 18 && y > t.y - 14 && y < t.y + 10) return { type: 'table', id: t.id };
    if (Math.abs(x - Wd.NPC_POS.x) < 44 && y > Wd.NPC_POS.y - 34 && y < Wd.CART.y + 2) return { type: 'npc' };
    if (Math.abs(x - Wd.XEOM.x) < 22 && y > Wd.XEOM.y - 36 && y < Wd.XEOM.y + 2) return { type: 'xeom' };
    const v = this.vendor;
    if (Math.abs(x - v.x) < 24 && y > v.y - 34 && y < v.y + 2) return { type: 'vendor' };
    return null;
  }
  nearestApproach(target) {
    const me = this.me;
    if (target.type === 'npc') return { x: Wd.CART.x + (me.x < Wd.CART.x ? -10 : 10), y: Wd.CART.y + 10 };
    const t = Wd.tableById[target.id];
    const taken = new Set([...this.players.values()].filter((p) => p !== me && p.sit).map((p) => `${Math.round(p.x)},${Math.round(p.y)}`));
    const free = Wd.stoolsOf(t).filter((s) => !taken.has(`${s.x},${s.y}`));
    const list = free.length ? free : Wd.stoolsOf(t);
    list.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
    return list[0];
  }
  walkTo(x, y, action) {
    const p = Wd.findPath(this.me.x, this.me.y, x, y);
    // Cho phép đặt chân lên đúng ghế dù ô lưới bị coi là gần bàn
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
      const l = VENDOR_LINES[this.vendor.goods];
      this.npcSay('vendor', l[(Math.random() * l.length) | 0]);
      this.vendor.pause = Math.max(this.vendor.pause, 3);
    }
  }
  npcSay(who, text) {
    this.talk.set(who, { text, until: performance.now() + 4500 });
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
          if (!this.path.length) {
            this.path = null;
            if (this.pendingAction) this.interact(this.pendingAction);
          }
        } else { dx = ddx / d; dy = ddy / d; }
      }
      const moving = !!(dx || dy);
      if (moving) {
        const len = Math.hypot(dx, dy);
        const vx = (dx / len) * SPEED * dt, vy = (dy / len) * SPEED * dt;
        const followingPath = !!this.path;
        // Đi theo đường dẫn thì cho phép đi qua ô ghế (đích cuối có thể sát bàn)
        if (followingPath || !Wd.blocked(me.x + vx, me.y)) me.x += vx;
        if (followingPath || !Wd.blocked(me.x, me.y + vy)) me.y += vy;
        if (Math.abs(dx) > Math.abs(dy)) me.dir = dx < 0 ? 'left' : 'right';
        else me.dir = dy < 0 ? 'up' : 'down';
        me.sit = false;
        me.anim += dt * 8;
        me.frame = 1 + (Math.floor(me.anim) % 2);
      } else {
        me.frame = 0;
      }
      if (moving !== me.moving) { me.moving = moving; this.sendMove(true); }
      else if (moving) this.sendMove(false);
      // Đối tượng tương tác gần nhất
      this.hover = null;
      for (const t of Wd.TABLES) {
        if (Math.hypot(me.x - t.x, me.y - t.y) < 34) { this.hover = { type: 'table', id: t.id }; break; }
      }
      if (!this.hover && Math.abs(me.x - Wd.CART.x) < 50 && me.y > Wd.CART.y - 2 && me.y < Wd.CART.y + 26) this.hover = { type: 'npc' };
    }
    // Người chơi khác: nội suy
    for (const p of this.players.values()) {
      if (p === me) continue;
      const ddx = p.tx - p.x, ddy = p.ty - p.y;
      const d = Math.hypot(ddx, ddy);
      if (d > 80) { p.x = p.tx; p.y = p.ty; } else { const f = Math.min(1, dt * 10); p.x += ddx * f; p.y += ddy * f; }
      if (p.moving) { p.anim += dt * 8; p.frame = 1 + (Math.floor(p.anim) % 2); } else p.frame = 0;
    }
    // Xe máy chạy ngoài đường
    if (Math.random() < dt * 0.7 && this.bikes.length < 9) {
      const lane = Wd.LANES[Math.random() < 0.5 ? 0 : 1];
      const pick = (a) => a[(Math.random() * a.length) | 0];
      const bodies = ['#8e2a20', '#2c3e50', '#e8e4da', '#1f5fa8', '#c0392b', '#3a3a40', '#6b2d5c', '#d4a017'];
      const shirts = ['#f2efe6', '#e74c3c', '#3b8fd6', '#f3c623', '#9b59b6', '#5f7f4a', '#ec6fa0', '#2e2e34'];
      const helmets = ['#2c6fbb', '#e74c3c', '#f3c623', '#ffffff', '#2e2e34', '#ec6fa0', '#3fbf6f'];
      const flower = Math.random() < 0.12;
      const opt = { rider: pick(shirts), riderHelmet: pick(helmets), basket: Math.random() < 0.4, mask: Math.random() < 0.4 };
      const r = Math.random();
      if (r < 0.25) opt.passenger = pick(shirts);
      else if (r < 0.38) opt.cargo = 'box';
      else if (r < 0.48) opt.cargo = 'water';
      else if (r < 0.55) opt.cargo = 'flower';
      this.bikes.push({
        x: lane.dir > 0 ? -50 : Wd.W + 50, y: lane.y, v: lane.dir * (flower ? 22 : 45 + Math.random() * 55),
        img: flower ? null : V.bikeVN(pick(bodies), opt), flower, ph: Math.random() * 10,
      });
      // tránh xe đè nhau cùng làn
      const last = this.bikes[this.bikes.length - 1];
      if (this.bikes.some((b) => b !== last && b.y === last.y && Math.abs(b.x - last.x) < 60)) this.bikes.pop();
    }
    for (const b of this.bikes) {
      // giữ khoảng cách với xe phía trước cùng làn
      const ahead = this.bikes.filter((o) => o !== b && o.y === b.y && Math.sign(o.x - b.x) === Math.sign(b.v) && Math.abs(o.x - b.x) < 52);
      const v = ahead.length ? ahead.reduce((m, o) => (Math.abs(o.v) < Math.abs(m) ? o.v : m), b.v) : b.v;
      b.x += v * dt;
    }
    this.bikes = this.bikes.filter((b) => b.x > -70 && b.x < Wd.W + 70);
    // Lá bàng rơi
    if (Math.random() < dt * 0.6) {
      const t = Wd.TREES[Math.random() < 0.5 ? 0 : 1];
      const col = t.kind === 'phuong' ? (Math.random() < 0.6 ? '#e53922' : '#ff7a3a') : (Math.random() < 0.5 ? '#b93a22' : '#d0742f');
      this.leaves.push({ x: t.x + (Math.random() - 0.5) * 100, y: t.y - 120 + Math.random() * 60, vy: 9 + Math.random() * 8, ph: Math.random() * 6, life: 0, col });
    }
    for (const l of this.leaves) { l.life += dt; l.y += l.vy * dt; l.x += Math.sin(l.ph + l.life * 2.5) * 12 * dt; }
    this.leaves = this.leaves.filter((l) => l.life < 6);
    // Hơi nồi phở bốc lên
    if (Math.random() < dt * 6) this.steam.push({ x: Wd.PHO_STEAM.x + (Math.random() - 0.5) * 14, y: Wd.PHO_STEAM.y, life: 0, ph: Math.random() * 6 });
    for (const st of this.steam) { st.life += dt; st.y -= 9 * dt; st.x += Math.sin(st.ph + st.life * 2) * 6 * dt; }
    this.steam = this.steam.filter((st) => st.life < 2.6);
    // Gánh hàng rong đi dọc mép vỉa hè
    const vd = this.vendor;
    if (vd.pause > 0) { vd.pause -= dt; vd.frame = 0; }
    else {
      vd.x += vd.dir * 14 * dt;
      vd.anim += dt * 5; vd.frame = 1 + (Math.floor(vd.anim) % 2);
      if (vd.x < 24 || vd.x > 366) { vd.dir *= -1; vd.x = Math.max(24, Math.min(366, vd.x)); }
      if (Math.random() < dt * 0.08) vd.pause = 3 + Math.random() * 4;
    }
    // NPC phụ thỉnh thoảng lên tiếng
    for (const who of ['xeom', 'vendor']) {
      if (now > this.talkNext[who]) {
        const lines = who === 'xeom' ? XEOM_LINES : VENDOR_LINES[vd.goods];
        this.npcSay(who, lines[(Math.random() * lines.length) | 0]);
        this.talkNext[who] = now + 14000 + Math.random() * 22000;
        if (who === 'vendor' && Math.random() < 0.3) vd.goods = 1 - vd.goods;
      }
    }
    // Mèo đi lang thang
    const c = this.cat;
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
        c.dir = ddx < 0 ? -1 : 1;
      }
    }
    // Cô chủ quán thỉnh thoảng nói
    if (now > this.npc.next) {
      this.npc.bubble = NPC_LINES[(Math.random() * NPC_LINES.length) | 0];
      this.npc.until = now + 5000;
      this.npc.next = now + 15000 + Math.random() * 20000;
    }
  }

  sendMove(force) {
    const now = performance.now();
    if (!force && now - this.lastSent < 90) return;
    this.lastSent = now;
    const m = this.me;
    this.hooks.onMove({ x: Math.round(m.x * 10) / 10, y: Math.round(m.y * 10) / 10, dir: m.dir, moving: !!m.moving, sit: !!m.sit });
  }

  // ---------- Ngày / đêm theo giờ Việt Nam ----------
  darkness() {
    if (this.nightOverride !== null) return this.nightOverride;
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
    const h = +parts.find((p) => p.type === 'hour').value + +parts.find((p) => p.type === 'minute').value / 60;
    if (h >= 6.5 && h <= 17) return 0;
    if (h > 17 && h < 19) return ((h - 17) / 2) * 0.62;
    if (h >= 5 && h < 6.5) return ((6.5 - h) / 1.5) * 0.62;
    return 0.62;
  }

  // ---------- Vẽ ----------
  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.time += dt;
    this.update(dt, t);
    this.draw(t);
    requestAnimationFrame((tt) => this.loop(tt));
  }

  draw(now) {
    const g = this.vctx;
    const me = this.me;
    // Camera
    const fx = me ? me.x : Wd.W / 2, fy = me ? me.y - 20 : Wd.H / 2;
    const cam = (f, view, world) => (view >= world ? -Math.floor((view - world) / 2) : Math.round(Math.max(0, Math.min(world - view, f - view / 2))));
    this.camX = cam(fx, this.vw, Wd.W);
    this.camY = cam(fy, this.vh, Wd.H);
    g.setTransform(1, 0, 0, 1, -this.camX, -this.camY);
    g.fillStyle = '#2b2f2a';
    g.fillRect(this.camX, this.camY, this.vw, this.vh);
    g.drawImage(this.bg, 0, 0);
    // Cờ đỏ sao vàng bay trên ban công
    const ff = Math.floor(now / 260) % 3;
    for (const f of Wd.HOUSE_FLAGS()) g.drawImage(V.flag(ff), f.x, f.y - 30);

    // Danh sách vẽ theo chiều sâu
    const items = this.statics.map((s) => ({ base: s.base, draw: () => {
      if (s.flip) { g.save(); g.scale(-1, 1); g.drawImage(s.img, -s.x - s.img.width, s.y); g.restore(); } else g.drawImage(s.img, s.x, s.y);
    } }));
    for (const t of Wd.TABLES) {
      items.push({ base: t.y + 8, draw: () => this.drawTable(g, t, now) });
    }
    // Cô chủ quán
    items.push({ base: Wd.NPC_POS.y, draw: () => {
      const bob = Math.sin(now / 600) > 0.6 ? 1 : 0;
      const img = S.getCharSprite({ skin: 1, hairColor: 0, hairStyle: 2, shirt: 7, pants: 2, hat: 1 }, 'down', 0, true);
      g.drawImage(img, Wd.NPC_POS.x - 10, Wd.NPC_POS.y - 29 + bob);
    } });
    // Mèo
    const c = this.cat;
    items.push({ base: c.y, draw: () => {
      const img = S.cat(Math.floor(c.t * 6) % 2, c.sleep > 0);
      if (c.dir < 0) { g.save(); g.scale(-1, 1); g.drawImage(img, -Math.round(c.x) - 7, Math.round(c.y) - 10); g.restore(); }
      else g.drawImage(img, Math.round(c.x) - 7, Math.round(c.y) - 10);
    } });
    for (const p of this.players.values()) {
      items.push({ base: p.y, draw: () => {
        g.fillStyle = 'rgba(0,0,0,0.22)';
        if (!p.sit) { g.beginPath(); g.ellipse(Math.round(p.x), Math.round(p.y) - 1, 6, 2, 0, 0, Math.PI * 2); g.fill(); }
        const img = S.getCharSprite(p.avatar, p.dir, p.frame, p.sit);
        g.drawImage(img, Math.round(p.x) - 10, Math.round(p.y) - 29 - (p.sit ? 4 : 0));
      } });
    }
    for (const b of this.bikes) {
      items.push({ base: b.y, draw: () => {
        const img = b.flower ? V.flowerBike(Math.floor(now / 250) % 2) : b.img;
        const x = Math.round(b.x), y = b.y - img.height + 1 + (Math.floor(now / 110 + b.ph) % 2);
        if (b.v < 0) { g.save(); g.scale(-1, 1); g.drawImage(img, -x - img.width / 2, y); g.restore(); } else g.drawImage(img, x - img.width / 2, y);
      } });
    }
    // Bác xe ôm
    items.push({ base: Wd.XEOM.y, draw: () => {
      const img = V.xeOm(Math.floor(now / 900) % 3 === 2 ? 1 : 0);
      g.drawImage(img, Wd.XEOM.x - 23, Wd.XEOM.y - 45);
    } });
    // Gánh hàng rong
    const vd = this.vendor;
    items.push({ base: vd.y, draw: () => {
      const img = V.vendor(vd.frame, vd.goods);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(Math.round(vd.x), vd.y - 1, 18, 3, 0, 0, Math.PI * 2); g.fill();
      if (vd.dir > 0) { g.save(); g.scale(-1, 1); g.drawImage(img, -Math.round(vd.x) - 26, vd.y - 38); g.restore(); }
      else g.drawImage(img, Math.round(vd.x) - 26, vd.y - 38);
    } });
    items.sort((a, b) => a.base - b.base);
    for (const it of items) it.draw();

    // Lá rơi
    for (const l of this.leaves) { g.fillStyle = l.col; g.fillRect(Math.round(l.x), Math.round(l.y), 2, 2); }
    // Lấp lánh khi có tâm sự mới
    this.sparkles = this.sparkles.filter((s) => now - s.t0 < 1600);
    for (const s of this.sparkles) {
      const k = (now - s.t0) / 1600;
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 + k * 3, r = 6 + k * 14;
        g.fillStyle = `rgba(255,236,140,${1 - k})`;
        g.fillRect(Math.round(s.x + Math.cos(a) * r), Math.round(s.y + Math.sin(a) * r * 0.6 - k * 10), 2, 2);
      }
    }
    // Hơi nồi phở
    for (const st of this.steam) {
      g.fillStyle = `rgba(255,255,255,${0.5 * (1 - st.life / 2.6)})`;
      const r = 1 + st.life * 1.4;
      g.fillRect(Math.round(st.x - r), Math.round(st.y - r), Math.round(r * 2), Math.round(r * 2));
    }
    const dark = this.darkness();
    // Ô che quầy & đèn lồng đỏ
    g.drawImage(V.umbrella(), Wd.UMBRELLA.x, Wd.UMBRELLA.y);
    g.strokeStyle = '#3a2a22'; g.lineWidth = 1;
    for (const l of Wd.LANTERNS) {
      const sw = Math.round(Math.sin(now / 700 + l.x) * 1);
      g.beginPath(); g.moveTo(l.x + 4, l.y - 2); g.lineTo(l.x + 4 + sw, l.y + 1); g.stroke();
      g.drawImage(V.lantern(), l.x + sw, l.y);
    }
    // Dây điện chằng chịt
    g.strokeStyle = 'rgba(22,22,26,0.9)';
    for (const [x1, y1, x2, y2, sag] of Wd.WIRES) {
      g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2, Math.max(y1, y2) + sag, x2, y2); g.stroke();
    }
    // Đèn cao áp cần cong
    const L = Wd.LAMP;
    g.strokeStyle = '#6f6e69'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(Wd.POLE.x + 3, L.y + 10); g.quadraticCurveTo(Wd.POLE.x + 6, L.y - 2, L.x, L.y); g.stroke();
    g.lineWidth = 1;
    g.fillStyle = '#4b5157'; g.fillRect(L.x - 2, L.y - 1, 12, 4);
    g.fillStyle = dark > 0.1 ? '#fff2c0' : '#d8d4c4'; g.fillRect(L.x, L.y + 3, 8, 2);
    // Dây bóng đèn tròn
    g.strokeStyle = '#2a2a2e';
    for (const str of Wd.BULB_STRINGS) {
      g.beginPath();
      str.forEach((b, i) => (i ? g.lineTo(b.x, b.y) : g.moveTo(b.x, b.y)));
      g.stroke();
    }
    for (const [i, b] of Wd.BULBS.entries()) {
      g.fillStyle = dark > 0.1 ? ['#ffd36e', '#ff9f6e', '#fff3b0'][i % 3] : '#e9e4d0';
      g.fillRect(Math.round(b.x) - 1, Math.round(b.y) + 1, 3, 3);
    }
    // Ban đêm
    if (dark > 0.01) this.drawNight(g, dark, now);

    // Chuyển lên canvas chính
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.view, 0, 0, this.vw * this.zoom, this.vh * this.zoom);
    this.drawOverlay(ctx, now);
  }

  drawTable(g, t, now) {
    const img = S.table(t.kind);
    g.drawImage(img, t.x - 15, t.y - 9);
    const n = Math.min(8, this.tableCounts[t.id] || 0);
    for (let i = 0; i < n; i++) {
      const gx = t.x - 11 + (i % 4) * 6, gy = t.y - 11 + Math.floor(i / 4) * 4;
      g.drawImage(S.teaGlass(1), gx, gy);
    }
    if (this.hover && this.hover.type === 'table' && this.hover.id === t.id) {
      const a = 0.5 + Math.sin(now / 200) * 0.3;
      g.strokeStyle = `rgba(255,240,170,${a})`;
      g.strokeRect(t.x - 16.5, t.y - 10.5, 33, 14);
    }
  }

  drawNight(g, dark, now) {
    if (!this.night) { this.night = document.createElement('canvas'); }
    const n = this.night;
    if (n.width !== this.vw || n.height !== this.vh) { n.width = this.vw; n.height = this.vh; }
    const ng = n.getContext('2d');
    ng.setTransform(1, 0, 0, 1, 0, 0);
    ng.globalCompositeOperation = 'source-over';
    ng.clearRect(0, 0, n.width, n.height);
    ng.fillStyle = `rgba(14,18,48,${dark})`;
    ng.fillRect(0, 0, n.width, n.height);
    ng.setTransform(1, 0, 0, 1, -this.camX, -this.camY);
    ng.globalCompositeOperation = 'destination-out';
    const flick = 0.95 + Math.sin(now / 90) * 0.03;
    const hole = (x, y, r, s = 1) => {
      const gr = ng.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${s})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ng.fillStyle = gr; ng.beginPath(); ng.arc(x, y, r, 0, Math.PI * 2); ng.fill();
    };
    for (const l of Wd.LIGHTS) hole(l.x, l.y, l.r * flick, 0.95);
    for (const b of Wd.BULBS) hole(b.x, b.y + 2, 26, 0.6);
    for (const l of Wd.LANTERNS) hole(l.x + 4, l.y + 6, 22, 0.8);
    for (const w of Wd.WINDOWS) if (w.lit) { ng.fillStyle = 'rgba(0,0,0,0.85)'; ng.fillRect(w.x, w.y, w.w, w.h); }
    for (const b of this.bikes) hole(b.x + (b.v > 0 ? 34 : -34), b.y - 18, 28, 0.7);
    g.drawImage(n, this.camX, this.camY);
    // Ánh vàng ấm
    g.globalCompositeOperation = 'lighter';
    for (const w of Wd.WINDOWS) if (w.lit) { g.fillStyle = `rgba(255,190,90,${dark * 0.35})`; g.fillRect(w.x, w.y, w.w, w.h); }
    for (const l of Wd.LIGHTS) {
      const gr = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      gr.addColorStop(0, `rgba(${l.col},${dark * 0.3})`); gr.addColorStop(1, `rgba(${l.col},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(l.x, l.y, l.r, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  // Chữ vẽ ở độ phân giải màn hình cho sắc nét
  drawOverlay(ctx, now) {
    const z = this.zoom, d = this.dpr;
    const sx = (x) => (x - this.camX) * z, sy = (y) => (y - this.camY) * z;
    const fs = (px) => `${Math.round(px * d)}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const pill = (text, x, y, weight, size, bg, fg, pad = 5) => {
      ctx.font = `${weight} ${fs(size)}`;
      const w = ctx.measureText(text).width + pad * 2 * d;
      const h = size * d + pad * 1.2 * d;
      ctx.fillStyle = bg;
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 4 * d);
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.fillText(text, x, y + 0.5 * d);
      return { w, h };
    };

    // Biển hiệu cửa hàng (chữ tiếng Việt sắc nét)
    const k = z; // px màn hình / px thế giới
    for (const sg of Wd.SIGNS) {
      ctx.fillStyle = sg.fg;
      fitText(ctx, sg.text, sx(sg.x + sg.w / 2), sy(sg.y + sg.h / 2 + 0.5), sg.w * k * 0.92, sg.h * k * 0.78, '800', '"Arial Narrow", Arial, sans-serif');
      ctx.globalAlpha = 0.9;
      fitText(ctx, sg.sub, sx(sg.x + sg.w / 2), sy(sg.y + sg.h + 2), sg.w * k * 0.9, 3.4 * k, '600', 'Arial, sans-serif');
      ctx.globalAlpha = 1;
    }
    for (const lb of Wd.LABELS) {
      ctx.save();
      ctx.translate(sx(lb.x), sy(lb.y));
      if (lb.rot) ctx.rotate(lb.rot);
      const fam = lb.hand ? '"Comic Sans MS", "Segoe Print", "Bradley Hand", cursive' : 'Arial, sans-serif';
      ctx.font = `${lb.bold || lb.hand ? 800 : 600} ${Math.round(lb.size * k * 0.62)}px ${fam}`;
      if (lb.bg) { const tw = ctx.measureText(lb.text).width; ctx.fillStyle = lb.bg; ctx.fillRect(-tw / 2 - 2 * d, -lb.size * k * 0.4, tw + 4 * d, lb.size * k * 0.8); }
      ctx.fillStyle = lb.color;
      ctx.fillText(lb.text, 0, 0);
      ctx.restore();
    }
    // Tên quán trên tán ô
    pill('☕ TRÀ ĐÁ XẢ STRESS', sx(Wd.UMBRELLA.x + 64), sy(Wd.UMBRELLA.y + 20), 900, Math.max(10, (k / d) * 4.2), 'rgba(140,28,18,0.92)', '#fff4d6', 6);
    // Nhãn bàn
    for (const t of Wd.TABLES) {
      const hov = this.hover && this.hover.type === 'table' && this.hover.id === t.id;
      const n = this.tableCounts[t.id] || 0;
      pill(`${t.icon} ${t.name}${n ? ` · ${n}` : ''}`, sx(t.x), sy(t.y - 30), 600, 11, hov ? 'rgba(255,244,214,0.97)' : 'rgba(40,28,20,0.62)', hov ? '#5a2d14' : '#fff4d6');
    }
    // Tên & bong bóng chat
    for (const p of this.players.values()) {
      const x = sx(p.x), y = sy(p.y - 36 - (p.sit ? 4 : 0));
      const mine = p === this.me;
      pill(p.nickname, x, y, 600, 11, mine ? 'rgba(46,125,50,0.85)' : 'rgba(20,20,28,0.6)', '#fff', 4);
      const b = this.bubbles.get(p.sid);
      if (b && b.until > now) this.bubble(ctx, b.text, x, y - 14 * d, fs);
      else if (b) this.bubbles.delete(p.sid);
    }
    // Cô chủ quán
    pill('Cô Tư chủ quán', sx(Wd.NPC_POS.x), sy(Wd.NPC_POS.y - 34), 600, 11, 'rgba(122,35,24,0.85)', '#fff4d6', 4);
    if (this.npc.bubble && this.npc.until > now) this.bubble(ctx, this.npc.bubble, sx(Wd.NPC_POS.x), sy(Wd.NPC_POS.y - 34) - 10 * d, fs);
    const vd = this.vendor;
    const extra = [['xeom', Wd.XEOM.x, Wd.XEOM.y - 44, 'Bác xe ôm'], ['vendor', vd.x, vd.y - 40, 'Cô bán hàng rong']];
    for (const [who, x, y, name] of extra) {
      const t = this.talk.get(who);
      if (t && t.until > now) {
        pill(name, sx(x), sy(y), 600, 10, 'rgba(20,20,28,0.55)', '#fff', 4);
        this.bubble(ctx, t.text, sx(x), sy(y) - 12 * d, fs);
      }
    }
    // Biểu cảm
    this.emotes = this.emotes.filter((e) => now - e.t0 < 2200);
    for (const e of this.emotes) {
      const p = this.players.get(e.sid);
      if (!p) continue;
      const k = (now - e.t0) / 2200;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = fs(20);
      ctx.fillText(e.icon, sx(p.x), sy(p.y - 44) - k * 30 * d);
      ctx.globalAlpha = 1;
    }
    // Gợi ý tương tác
    if (this.hover && this.me && !this.hooks.isUiOpen()) {
      const label = this.hover.type === 'npc' ? 'Trò chuyện với Cô Tư' : `Ngồi bàn ${Wd.tableById[this.hover.id].name}`;
      const touch = matchMedia('(pointer: coarse)').matches;
      pill(touch ? `👆 Chạm để ${label.toLowerCase()}` : `[E] ${label}`, sx(this.me.x), sy(this.me.y + 10), 700, 12, 'rgba(255,244,214,0.95)', '#5a2d14', 6);
    }
  }

  bubble(ctx, text, x, y, fs) {
    const d = this.dpr;
    ctx.font = `500 ${fs(12)}`;
    const maxW = 200 * d;
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    const lh = 15 * d;
    const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width))) + 14 * d;
    const h = lines.length * lh + 8 * d;
    const top = y - h;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    roundRect(ctx, x - w / 2, top, w, h, 7 * d);
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 5 * d, y); ctx.lineTo(x + 5 * d, y); ctx.lineTo(x, y + 6 * d); ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,30,0.25)'; ctx.lineWidth = d;
    roundRect(ctx, x - w / 2, top, w, h, 7 * d); ctx.stroke();
    ctx.fillStyle = '#2b1d16';
    lines.forEach((l, i) => ctx.fillText(l, x, top + 4 * d + lh * (i + 0.5)));
  }
}

// Vẽ chữ co giãn vừa khung
function fitText(ctx, text, x, y, maxW, maxH, weight, family) {
  let size = Math.max(6, Math.floor(maxH));
  ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) { size = Math.max(5, Math.floor(size * (maxW / w))); ctx.font = `${weight} ${size}px ${family}`; }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
