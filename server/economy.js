'use strict';
// Kinh tế của quán: khay nước, phiếu tặng, xu và ngưỡng bắt đầu thu phí.
//
// Mỗi lần "uống" (mở gói Cô Tư AI) hoặc "tặng" N ly một món, quán trả theo thứ tự:
//   1. Ly cùng món có sẵn trong khay (ly được người khác tặng) – uống hoặc tặng lại
//   2. Chưa đủ người tham gia (chưa thu phí): miễn phí
//   3. Phiếu chào mừng: 1 ly cho mình / 1 ly để tặng
//   4. Trừ xu theo giá món (xu mua qua bot Telegram)
const db = require('./db');
const config = require('./config');
const { DRINK_INFO, ECONOMY } = require('./constants');

const q = {
  participants: db.prepare('SELECT COUNT(*) n FROM users WHERE banned = 0'),
  user: db.prepare('SELECT xu, voucher_self, voucher_gift FROM users WHERE id = ?'),
  tray: db.prepare('SELECT drink, qty FROM cups WHERE user_id = ? AND qty > 0'),
  cup: db.prepare('SELECT qty FROM cups WHERE user_id = ? AND drink = ?'),
  addCups: db.prepare(`INSERT INTO cups (user_id, drink, qty) VALUES (?, ?, ?)
    ON CONFLICT(user_id, drink) DO UPDATE SET qty = qty + excluded.qty`),
  takeCups: db.prepare('UPDATE cups SET qty = qty - ? WHERE user_id = ? AND drink = ? AND qty >= ?'),
  useVoucherSelf: db.prepare('UPDATE users SET voucher_self = voucher_self - 1 WHERE id = ? AND voucher_self > 0'),
  useVoucherGift: db.prepare('UPDATE users SET voucher_gift = voucher_gift - 1 WHERE id = ? AND voucher_gift > 0'),
  spendXu: db.prepare('UPDATE users SET xu = xu - ? WHERE id = ? AND xu >= ?'),
  addXu: db.prepare('UPDATE users SET xu = xu + ? WHERE id = ?'),
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

function tray(userId) {
  return Object.fromEntries(q.tray.all(userId).map((r) => [r.drink, r.qty]));
}
function wallet(userId) {
  const u = q.user.get(userId);
  return { xu: u.xu, vouchers: { self: u.voucher_self, gift: u.voucher_gift }, tray: tray(userId) };
}

class NeedXu extends Error {
  constructor(cost, have) { super('need_xu'); this.cost = cost; this.have = have; }
}

/**
 * Xem trước cách trả cho N ly (không trừ gì). purpose: 'self' | 'gift'
 */
function quote(userId, drink, qty, purpose) {
  const u = q.user.get(userId);
  const have = (q.cup.get(userId, drink) || { qty: 0 }).qty;
  const plan = { cups: Math.min(have, qty), free: 0, voucher: 0, xu: 0 };
  let need = qty - plan.cups;
  if (need > 0 && !isPaywall()) { plan.free = need; need = 0; }
  const vouchers = purpose === 'self' ? u.voucher_self : u.voucher_gift;
  if (need > 0 && vouchers > 0) { plan.voucher = 1; need -= 1; }
  plan.xu = need * DRINK_INFO[drink].price;
  plan.enough = u.xu >= plan.xu;
  plan.balance = u.xu;
  return plan;
}

/**
 * Trả cho N ly. Gọi BÊN TRONG db.transaction để đi cùng thao tác khác.
 * Ném NeedXu nếu không đủ xu.
 */
function pay(userId, drink, qty, purpose) {
  const plan = quote(userId, drink, qty, purpose);
  if (!plan.enough) throw new NeedXu(plan.xu, plan.balance);
  if (plan.cups && !q.takeCups.run(plan.cups, userId, drink, plan.cups).changes) throw new Error('cups_changed');
  if (plan.voucher && !(purpose === 'self' ? q.useVoucherSelf : q.useVoucherGift).run(userId).changes) throw new Error('voucher_changed');
  if (plan.xu && !q.spendXu.run(plan.xu, userId, plan.xu).changes) throw new NeedXu(plan.xu, plan.balance);
  return plan;
}

function addCups(userId, drink, qty) { q.addCups.run(userId, drink, qty); }
function addXu(userId, xu) { q.addXu.run(xu, userId); }

// Câu mô tả nguồn trả, hiện cho người dùng
function describe(plan) {
  const parts = [];
  if (plan.cups) parts.push(`${plan.cups} ly trong khay`);
  if (plan.free) parts.push(plan.free > 1 ? `${plan.free} ly miễn phí` : 'miễn phí');
  if (plan.voucher) parts.push('phiếu chào mừng');
  if (plan.xu) parts.push(`${plan.xu} xu`);
  return parts.join(' + ');
}

module.exports = { isPaywall, status, wallet, tray, quote, pay, addCups, addXu, describe, NeedXu, participants, resetCache, ECONOMY };
