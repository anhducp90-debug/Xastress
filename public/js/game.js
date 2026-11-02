// Vòng lặp game: vẽ quán, nhân vật, xe cộ, ngày/đêm; điều khiển bàn phím & chạm.
import * as S from './sprites.js';
import * as Wd from './world.js';

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
    this.cat = { x: 480, y: 140, tx: 480, ty: 140, t: 0, sleep: 0, dir: 1 };
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
    if (Math.abs(x - Wd.NPC_POS.x) < 40 && y > Wd.NPC_POS.y - 30 && y < Wd.CART.y + 2) return { type: 'npc' };
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
    }
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
      if (!this.hover && Math.abs(me.x - Wd.CART.x) < 46 && me.y > Wd.CART.y - 2 && me.y < Wd.CART.y + 26) this.hover = { type: 'npc' };
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
    if (Math.random() < dt * 0.45 && this.bikes.length < 7) {
      const right = Math.random() < 0.5;
      const cols = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#2c3e50', '#ecf0f1'];
      const shirts = S.PALETTE.shirt;
      this.bikes.push({
        x: right ? -40 : Wd.W + 40, y: right ? 362 : 404, v: (right ? 1 : -1) * (50 + Math.random() * 50),
        img: S.motorbike(cols[(Math.random() * cols.length) | 0], shirts[(Math.random() * shirts.length) | 0]),
        honk: Math.random() < 0.15 ? now + 800 + Math.random() * 2000 : 0,
      });
    }
    for (const b of this.bikes) b.x += b.v * dt;
    this.bikes = this.bikes.filter((b) => b.x > -60 && b.x < Wd.W + 60);
    // Lá bàng rơi
    if (Math.random() < dt * 0.6) {
      const tx = Math.random() < 0.5 ? 42 : 602;
      this.leaves.push({ x: tx + (Math.random() - 0.5) * 60, y: 110 + Math.random() * 30, vy: 10 + Math.random() * 8, ph: Math.random() * 6, life: 0, col: Math.random() < 0.5 ? '#c4472b' : '#e0702f' });
    }
    for (const l of this.leaves) { l.life += dt; l.y += l.vy * dt; l.x += Math.sin(l.ph + l.life * 2.5) * 12 * dt; }
    this.leaves = this.leaves.filter((l) => l.life < 5);
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
        const x = Math.round(b.x), y = b.y - 26 + (Math.floor(now / 120) % 2);
        if (b.v < 0) { g.save(); g.scale(-1, 1); g.drawImage(b.img, -x - 18, y); g.restore(); } else g.drawImage(b.img, x - 18, y);
      } });
    }
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
    // Dây đèn
    const dark = this.darkness();
    g.strokeStyle = '#2a2a2e'; g.lineWidth = 1;
    g.beginPath();
    Wd.BULBS.forEach((b, i) => (i ? g.lineTo(b.x, b.y) : g.moveTo(b.x, b.y)));
    g.stroke();
    for (const [i, b] of Wd.BULBS.entries()) {
      g.fillStyle = dark > 0.1 ? ['#ffd36e', '#ff9f6e', '#fff3b0'][i % 3] : '#e9e4d0';
      g.fillRect(b.x - 1, b.y + 1, 3, 3);
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
    for (const w of Wd.WINDOWS) if (w.lit) { ng.fillStyle = 'rgba(0,0,0,0.85)'; ng.fillRect(w.x, w.y, w.w, w.h); }
    for (const b of this.bikes) hole(b.x + (b.v > 0 ? 30 : -30), b.y - 12, 26, 0.7);
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

    // Biển hiệu quán
    pill('☕ TRÀ ĐÁ XẢ STRESS', sx(320), sy(34), 800, Math.max(12, (z / d) * 5.5), 'rgba(122,35,24,0.92)', '#fff4d6', 8);
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
    pill('Cô Tư chủ quán', sx(Wd.NPC_POS.x), sy(Wd.NPC_POS.y - 40), 600, 11, 'rgba(122,35,24,0.8)', '#fff4d6', 4);
    if (this.npc.bubble && this.npc.until > now) this.bubble(ctx, this.npc.bubble, sx(Wd.NPC_POS.x), sy(Wd.NPC_POS.y - 40) - 14 * d, fs);
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
      const label = this.hover.type === 'npc' ? 'Trò chuyện với Cô Tư' : `Ngồi ${Wd.tableById[this.hover.id].name}`;
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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
