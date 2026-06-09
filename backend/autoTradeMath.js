const GATEIO_MIN_ORDER_USDT = 3;
const GATEIO_SAFE_ORDER_USDT = GATEIO_MIN_ORDER_USDT + 0.1;
const GATEIO_AMOUNT_STEP = 0.1;

function floorToAmountStep(amount) {
  return parseFloat((Math.floor((amount + Number.EPSILON) / GATEIO_AMOUNT_STEP) * GATEIO_AMOUNT_STEP).toFixed(1));
}

function ceilToAmountStep(amount) {
  return parseFloat((Math.ceil((amount - Number.EPSILON) / GATEIO_AMOUNT_STEP) * GATEIO_AMOUNT_STEP).toFixed(1));
}

function buildTradePlan({ decision, proposedPrice, amountRatio, balances, lower, upper, count, oneTimeOverride = null }) {
  const normalizedDecision = String(decision || '').toUpperCase();
  const price = parseFloat(proposedPrice) || 0;

  const parsedCount = parseInt(count);
  let ratio = parseFloat(amountRatio) || 0.1;
  if (Number.isInteger(parsedCount) && parsedCount > 0) {
    ratio = 1 / parsedCount;
  }

  const sutBalance = balances && balances.SUT ? balances.SUT : 0;
  const usdtBalance = balances && balances.USDT ? balances.USDT : 0;

  if (!price || !['BUY', 'SELL'].includes(normalizedDecision)) {
    return { executable: false, side: '', amount: 0, orderNotional: 0, message: 'No executable AI decision.' };
  }

  if (normalizedDecision === 'BUY' && Number.isFinite(parseFloat(upper)) && price > parseFloat(upper)) {
    return { executable: false, side: 'buy', amount: 0, orderNotional: 0, message: 'BUY price is above manager upper limit.' };
  }

  if (normalizedDecision === 'SELL' && Number.isFinite(parseFloat(lower)) && price < parseFloat(lower)) {
    return { executable: false, side: 'sell', amount: 0, orderNotional: 0, message: 'SELL price is below manager lower limit.' };
  }

  if (oneTimeOverride && String(oneTimeOverride.side || '').toUpperCase() === normalizedDecision) {
    const spendUsdt = parseFloat(oneTimeOverride.spend_usdt) || 0;
    if (normalizedDecision !== 'BUY' || spendUsdt <= 0) {
      return { executable: false, side: normalizedDecision.toLowerCase(), amount: 0, orderNotional: 0, message: 'One-time dry-run override only supports BUY USDT spend.' };
    }
    if (usdtBalance < spendUsdt) {
      return { executable: false, side: 'buy', amount: 0, orderNotional: 0, message: `Insufficient USDT balance for ${spendUsdt} USDT dry-run.` };
    }
    return {
      executable: true,
      dryRun: true,
      side: 'buy',
      amount: parseFloat((spendUsdt / price).toFixed(4)),
      orderNotional: spendUsdt,
      message: `DRY_RUN one-time BUY test would spend ${spendUsdt.toFixed(2)} USDT.`
    };
  }

  if (normalizedDecision === 'BUY') {
    let amount = floorToAmountStep((usdtBalance * ratio) / price);
    let orderNotional = amount * price;
    if (amount <= 0) {
      return { executable: false, side: 'buy', amount: 0, orderNotional: 0, message: 'Insufficient USDT balance for server auto trade.' };
    }

    if (orderNotional < GATEIO_SAFE_ORDER_USDT && usdtBalance >= GATEIO_SAFE_ORDER_USDT) {
      amount = ceilToAmountStep(GATEIO_SAFE_ORDER_USDT / price);
      orderNotional = amount * price;
    }

    if (orderNotional < GATEIO_SAFE_ORDER_USDT || orderNotional > usdtBalance) {
      return { executable: false, side: 'buy', amount, orderNotional, message: `Available balance cannot meet the Gate.io safe minimum ${GATEIO_SAFE_ORDER_USDT} USDT order value.` };
    }
    return { executable: true, dryRun: false, side: 'buy', amount, orderNotional, message: 'Server auto trade order ready.' };
  }

  let amount = floorToAmountStep(sutBalance * ratio);
  let orderNotional = amount * price;
  if (amount <= 0) {
    return { executable: false, side: 'sell', amount: 0, orderNotional: 0, message: 'Insufficient SUT balance for server auto trade.' };
  }

  if (orderNotional < GATEIO_SAFE_ORDER_USDT && (sutBalance * price) >= GATEIO_SAFE_ORDER_USDT) {
    amount = ceilToAmountStep(GATEIO_SAFE_ORDER_USDT / price);
    orderNotional = amount * price;
  }

  if (orderNotional < GATEIO_SAFE_ORDER_USDT || amount > sutBalance) {
    return { executable: false, side: 'sell', amount, orderNotional, message: `Available balance cannot meet the Gate.io safe minimum ${GATEIO_SAFE_ORDER_USDT} USDT order value.` };
  }
  return { executable: true, dryRun: false, side: 'sell', amount, orderNotional, message: 'Server auto trade order ready.' };
}

module.exports = {
  GATEIO_MIN_ORDER_USDT,
  GATEIO_SAFE_ORDER_USDT,
  buildTradePlan
};
