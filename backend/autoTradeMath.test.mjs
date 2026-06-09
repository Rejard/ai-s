import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildTradePlan } = require('./autoTradeMath');

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

// 컴펜세이션으로 인해 3.12 USDT 잔고에서 3.0 USDT로 주문 성공
assert.equal(ratioPlan.executable, true);
assert.equal(ratioPlan.orderNotional, 3.0);

const insufficientBalancePlan = buildTradePlan({
  decision: 'BUY',
  proposedPrice: 0.15,
  amountRatio: 0.2,
  balances: { USDT: 2.50, SUT: 5 },
  lower: 0.12,
  upper: 0.35
});

assert.equal(insufficientBalancePlan.executable, false);
assert.match(insufficientBalancePlan.message, /minimum 3 USDT/);

console.log('ok - auto trade dry-run math with compensation check');
