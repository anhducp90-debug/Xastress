'use strict';
// Giới hạn tần suất theo khoá (user id) trong bộ nhớ – đủ cho 1 VPS đơn lẻ
const buckets = new Map();
function hit(key, limit, windowMs) {
  const now = Date.now();
  let arr = buckets.get(key);
  if (!arr) buckets.set(key, (arr = []));
  while (arr.length && arr[0] <= now - windowMs) arr.shift();
  if (arr.length >= limit) return false;
  arr.push(now);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of buckets) if (!arr.length || arr[arr.length - 1] < now - 3600e3) buckets.delete(k);
}, 10 * 60e3).unref();
module.exports = { hit };
