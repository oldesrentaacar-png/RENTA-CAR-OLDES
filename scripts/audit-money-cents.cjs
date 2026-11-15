/* Executable lock: 58.66 × 3 must close as 176, never a $0.02 credit.
   Compare in integer cents — 175.98 − 176 is > 0.02 in IEEE floats. */
const assert = require("assert");

const SETTLE = 2;

function toCents(value) {
  return Math.round(Number(value) * 100);
}

function fromCents(cents) {
  return Math.round(cents) / 100;
}

function settleCents(amount) {
  const cents = toCents(amount);
  return Math.abs(cents) <= SETTLE ? 0 : fromCents(cents);
}

function snapCommercialDollars(amount) {
  const cents = toCents(amount);
  const nearest = Math.round(cents / 100) * 100;
  return Math.abs(cents - nearest) <= SETTLE
    ? fromCents(nearest)
    : fromCents(cents);
}

function closeBalanceDue(owed, paid) {
  return settleCents(
    snapCommercialDollars(Math.max(0, fromCents(toCents(owed)))) -
      fromCents(toCents(paid)),
  );
}

function dailyRateForPactTotal(total, days) {
  return Math.round((Number(total) / Number(days)) * 1e6) / 1e6;
}

assert.strictEqual(toCents(58.66 * 3), 17598, "58.66 × 3 is 17598 cents");
assert.strictEqual(
  Math.abs(175.98 - 176) > 0.02,
  true,
  "IEEE trap: 175.98 − 176 is greater than 0.02; never compare dollars as floats",
);
assert.strictEqual(snapCommercialDollars(58.66 * 3), 176, "175.98 snaps to the $176 pact");
assert.strictEqual(settleCents(176 - 175.98), 0, "Overpay of 2¢ is not a credit");
assert.strictEqual(settleCents(175.98 - 176), 0, "Underpay of 2¢ is not a leftover debt");
assert.strictEqual(closeBalanceDue(175.98, 176), 0, "Close 175.98 vs receipt 176 is zero");
assert.strictEqual(closeBalanceDue(176, 175.98), 0, "Close 176 vs receipt 175.98 is zero");
assert.strictEqual(closeBalanceDue(176, 176), 0, "Exact $176 closes at zero");
assert.strictEqual(closeBalanceDue(200, 0), 200, "A real unpaid $200 is kept");
assert.strictEqual(closeBalanceDue(200, 50), 150, "A real $150 remainder is kept");
assert.strictEqual(snapCommercialDollars(175), 175, "Exact dollars are not changed");
assert.strictEqual(snapCommercialDollars(175.5), 175.5, "50¢ is a real amount, not snapped");
assert.strictEqual(snapCommercialDollars(175.97), 175.97, "3¢ off a dollar is kept");
assert.strictEqual(dailyRateForPactTotal(176, 3), 58.666667, "176 / 3 keeps 6 decimals");
assert.strictEqual(toCents(58.666667 * 3), 17600, "Aligned rate × days is exactly 17600 cents");

function recoverCommercialDiscountPercent({ agreedRate, rentalDays, discountPercent, discountAmount }) {
  const explicit = Number(discountPercent) || 0;
  if (explicit > 0) return explicit;
  const amount = Number(discountAmount) || 0;
  const days = Number(rentalDays) || 0;
  const rate = Number(agreedRate) || 0;
  const base = rate * days;
  if (amount <= 0 || days <= 0 || rate <= 0 || amount >= base) return 0;
  return Math.round((amount / base) * 100 * 1e6) / 1e6;
}

const recovered = recoverCommercialDiscountPercent({
  agreedRate: 27,
  rentalDays: 4,
  discountPercent: 0,
  discountAmount: 8,
});
assert.ok(Math.abs(recovered - (2 / 27) * 100) < 0.001, "Recover 27→25 as ~7.407% from $8 on 4 days");
const extendedBase = 27 * 6;
const extendedDiscount = extendedBase * (recovered / 100);
assert.strictEqual(Math.round((extendedBase - extendedDiscount) * 100) / 100, 150, "6 days at recovered % is $150 not $162");

console.log("  OK  Money cents: 58.66×3→176 and a $176 receipt closes at $0");
console.log("  OK  Commercial % recovers 27→25 so +2 days stay at $150");
