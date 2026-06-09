import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  GATEIO_SAFE_ORDER_USDT,
  buildTradePlan
} = require('./autoTradeMath');

assert.equal(GATEIO_SAFE_ORDER_USDT, 3.1);

const plan = buildTradePlan({
  decision: 'BUY',
  proposedPrice: 0.15,
  amountRatio: 0.2,
  balances: { USDT: 3.12, SUT: 5 },
  lower: 0.12,
  upper: 0.35,
  oneTimeOverride: { side: 'BUY', spend_usdt: 3, dry_run: 1 }
});

assert.equal(plan.executable, true);
assert.equal(plan.dryRun, true);
assert.equal(plan.side, 'buy');
assert.equal(plan.amount, 20);
assert.equal(plan.orderNotional, 3);
assert.match(plan.message, /DRY_RUN/);

const ratioPlan = buildTradePlan({
  decision: 'BUY',
  proposedPrice: 0.15,
  amountRatio: 0.2,
  balances: { USDT: 3.12, SUT: 5 },
  lower: 0.12,
  upper: 0.35
});

// Safety compensation raises the order above the 3.10 USDT threshold.
assert.equal(ratioPlan.executable, true);
assert.equal(ratioPlan.amount, 20.7);
assert.equal(ratioPlan.orderNotional, 3.105);

for (const proposedPrice of [0.1472, 0.1475, 0.1495]) {
  const precisionPlan = buildTradePlan({
    decision: 'BUY',
    proposedPrice,
    amountRatio: 0.2,
    balances: { USDT: 10, SUT: 100 },
    lower: 0.12,
    upper: 0.35
  });

  assert.equal(precisionPlan.executable, true);
  assert.equal(
    precisionPlan.amount * proposedPrice >= GATEIO_SAFE_ORDER_USDT,
    true,
    `BUY order at ${proposedPrice} must remain at least ${GATEIO_SAFE_ORDER_USDT} USDT`
  );
  assert.equal(
    Number.isInteger(precisionPlan.amount * 10),
    true,
    'Gate.io SUT amount must use 0.1 precision'
  );
}

const sellPrecisionPlan = buildTradePlan({
  decision: 'SELL',
  proposedPrice: 0.1495,
  amountRatio: 0.01,
  balances: { USDT: 10, SUT: 100 },
  lower: 0.12,
  upper: 0.35
});

assert.equal(sellPrecisionPlan.executable, true);
assert.equal(sellPrecisionPlan.amount, 20.8);
assert.equal(sellPrecisionPlan.orderNotional >= GATEIO_SAFE_ORDER_USDT, true);

const insufficientBalancePlan = buildTradePlan({
  decision: 'BUY',
  proposedPrice: 0.15,
  amountRatio: 0.2,
  balances: { USDT: 3.05, SUT: 5 },
  lower: 0.12,
  upper: 0.35
});

assert.equal(insufficientBalancePlan.executable, false);
assert.match(insufficientBalancePlan.message, /safe minimum 3.1 USDT/);

console.log('ok - auto trade dry-run math with compensation check');
