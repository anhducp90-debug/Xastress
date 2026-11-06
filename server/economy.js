'use strict';
// Kinh tế của quán: "ly của mình", khay ly để tặng, phiếu, xu và ngưỡng thu phí.
//
// Luật quán Cô Tư:
//  - GỌI 1 ly: uống 1 ly và được TẶNG KÈM 1 ly cùng món vào khay.
//      * Chưa đủ khách (chưa thu phí): miễn phí.
//      * Đã thu phí: uống "ly của mình" nếu có (không kèm ly tặng) -> phiếu chào mừng -> trả xu.
//  - KHAY chỉ dùng để TẶNG người khác. Chỉ tặng được số ly đang có trong khay.
//  - NHẬN ly: nếu chưa có "ly của mình" món đó thì 1 ly thành ly của mình (để uống),
//    phần còn lại vào khay. Ví dụ nhận 100 ly trà đá -> 1 ly của mình + 99 ly để tặng;
//    tặng đi 10 ly -> còn 89.
const db = require('./db');
const config = require('./config');
const { DRINK_INFO } = require('./constants');

const FREE_ORDERS_PER_DAY = 10; // chống "gọi ly miễn phí" để gom ly tặng

const q = {
  participants: db.prepare('SELECT COUNT(*) n FROM users WHERE banned = 0'),
  user: db.prepare('SELECT xu, voucher_self FROM users WHERE id = ?'),
  tray: db.prepare('SELECT drink, qty, glass FROM cups WHERE user_id = ? AND (qty > 0 OR glass > 0)'),
  cup: db.prepare('SELECT qty, glass FROM cups WHERE user_id = ? AND drink = ?'),
  ensure: db.prepare('INSERT OR IGNORE INTO cups (user_id, drink, qty, glass) VALUES (?, ?, 0, 0)'),
  addTray: db.prepare('UPDATE cups SET qty = qty + ? WHERE user_id = ? AND drink = ?'),
  takeTray: db.prepare('UPDATE cups SET qty = qty - ? WHERE user_id = ? AND drink = ? AND qty >= ?'),
  setGlass: db.prepare('UPDATE cups SET glass = ? WHERE user_id = ? AND drink = ?'),
  useVoucher: db.prepare('UPDATE users SET voucher_self = voucher_self - 1 WHERE id = ? AND voucher_self > 0'),
  spendXu: db.prepare('UPDATE users SET xu = xu - ? WHERE id = ? AND xu >= ?'),
  addXu: db.prepare('UPDATE users SET xu = xu + ? WHERE id = ?'),
  logOrder: db.prepare('INSERT INTO orders (user_id, drink, method, created_at) VALUES (?, ?, ?, ?)'),
  freeToday: db.prepare("SELECT COUNT(*) n FROM orders WHERE user_id = ? AND method = 'free' AND created_at > ?"),
};

let cache = { at: 0, n: 0 };
function participants() {
  if (Date.now() - cache.at > 15000) cache = { at: Date.now(), n: q.participants.get().n };
  return cache.n;
}
function resetCache() { cache.at = 0; }

function isPaywall() {
  if (config.paywall.mode === 'on') return true;
  if (config.paywall.mode === 'off') return false;
  return participants() >= config.paywall.users;
}

function status() {
  return {
    paywall: isPaywall(), participants: participants(), threshold: config.paywall.users, mode: config.paywall.mode,
    prices: Object.fromEntries(Object.entries(DRINK_INFO).map(([k, v]) => [k, v.price])),
  };
}

const cupOf = (userId, drink) => q.cup.get(userId, drink) || { qty: 0, glass: 0 };

// tray: số ly có thể tặng theo món; glasses: các món đang có "ly của mình"
function wallet(userId) {
  const u = q.user.get(userId);
  const tray = {}, glasses = [];
  for (const r of q.tray.all(userId)) {
    if (r.qty > 0) tray[r.drink] = r.qty;
    if (r.glass > 0) glasses.push(r.drink);
  }
  return { xu: u.xu, vouchers: { self: u.voucher_self }, tray, glasses };
}

class NeedXu extends Error { constructor(cost, have) { super('need_xu'); this.cost = cost; this.have = have; } }
class NoCups extends Error { constructor(have) { super('no_cups'); this.have = have; } }
class TooManyFree extends Error { constructor() { super('too_many_free'); } }

// ---------- Gọi ly để uống ----------
function quoteOrder(userId, drink) {
  const u = q.user.get(userId);
  const c = cupOf(userId, drink);
  const price = DRINK_INFO[drink].price;
  let plan;
  if (!isPaywall()) plan = { method: 'free', bonus: 1, xu: 0 };
  else if (c.glass > 0) plan = { method: 'glass', bonus: 0, xu: 0 };
  else if (u.voucher_self > 0) plan = { method: 'voucher', bonus: 1, xu: 0 };
  else plan = { method: 'xu', bonus: 1, xu: price };
  plan.enough = u.xu >= plan.xu;
  plan.balance = u.xu;
  plan.tray = c.qty;
  plan.text = { free: 'miễn phí', glass: 'ly của bạn', voucher: 'phiếu chào mừng', xu: `${price} xu` }[plan.method];
  return plan;
}

// Gọi BÊN TRONG db.transaction
function order(userId, drink) {
  const plan = quoteOrder(userId, drink);
  if (plan.method === 'free' && q.freeToday.get(userId, Date.now() - 86400e3).n >= FREE_ORDERS_PER_DAY) throw new TooManyFree();
  if (!plan.enough) throw new NeedXu(plan.xu, plan.balance);
  q.ensure.run(userId, drink);
  if (plan.method === 'glass') q.setGlass.run(0, userId, drink);
  if (plan.method === 'voucher' && !q.useVoucher.run(userId).changes) throw new Error('voucher_changed');
  if (plan.method === 'xu' && !q.spendXu.run(plan.xu, userId, plan.xu).changes) throw new NeedXu(plan.xu, plan.balance);
  if (plan.bonus) q.addTray.run(plan.bonus, userId, drink); // 1 ly tặng kèm vào khay
  q.logOrder.run(userId, drink, plan.method, Date.now());
  plan.tray = cupOf(userId, drink).qty;
  return plan;
}

// ---------- Tặng: chỉ từ khay ----------
function giftable(userId, drink) { return cupOf(userId, drink).qty; }

// Gọi BÊN TRONG db.transaction
function give(fromId, toId, drink, qty) {
  const have = giftable(fromId, drink);
  if (have < qty || !q.takeTray.run(qty, fromId, drink, qty).changes) throw new NoCups(have);
  return receive(toId, drink, qty);
}

// Nhận ly: thiếu "ly của mình" thì 1 ly thành ly của mình, còn lại vào khay
function receive(userId, drink, qty) {
  q.ensure.run(userId, drink);
  const c = cupOf(userId, drink);
  let toTray = qty, toGlass = 0;
  if (!c.glass && qty > 0) { q.setGlass.run(1, userId, drink); toGlass = 1; toTray -= 1; }
  if (toTray) q.addTray.run(toTray, userId, drink);
  return { toGlass, toTray, tray: c.qty + toTray };
}

function addXu(userId, xu) { q.addXu.run(xu, userId); }

module.exports = {
  isPaywall, status, wallet, quoteOrder, order, giftable, give, receive, addXu,
  NeedXu, NoCups, TooManyFree, participants, resetCache, FREE_ORDERS_PER_DAY,
};
