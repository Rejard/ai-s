const GATEIO_MIN_ORDER_USDT = 3;

function buildTradePlan({ decision, proposedPrice, amountRatio, balances, lower, upper, oneTimeOverride = null }) {
  const normalizedDecision = String(decision || '').toUpperCase();
  const price = parseFloat(proposedPrice) || 0;
  const ratio = parseFloat(amountRatio) || 0.1;
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
    const amount = parseFloat(((usdtBalance * ratio) / price).toFixed(4));
    const orderNotional = amount * price;
    if (amount <= 0) {
      return { executable: false, side: 'buy', amount: 0, orderNotional: 0, message: 'Insufficient USDT balance for server auto trade.' };
    }
    if (orderNotional < GATEIO_MIN_ORDER_USDT) {
      return { executable: false, side: 'buy', amount, orderNotional, message: `Order value ${orderNotional.toFixed(5)} USDT is below Gate.io minimum ${GATEIO_MIN_ORDER_USDT} USDT.` };
    }
    return { executable: true, dryRun: false, side: 'buy', amount, orderNotional, message: 'Server auto trade order ready.' };
  }

  const amount = parseFloat((sutBalance * ratio).toFixed(4));
  const orderNotional = amount * price;
  if (amount <= 0) {
    return { executable: false, side: 'sell', amount: 0, orderNotional: 0, message: 'Insufficient SUT balance for server auto trade.' };
  }
  if (orderNotional < GATEIO_MIN_ORDER_USDT) {
    return { executable: false, side: 'sell', amount, orderNotional, message: `Order value ${orderNotional.toFixed(5)} USDT is below Gate.io minimum ${GATEIO_MIN_ORDER_USDT} USDT.` };
  }
  return { executable: true, dryRun: false, side: 'sell', amount, orderNotional, message: 'Server auto trade order ready.' };
}

module.exports = {
  GATEIO_MIN_ORDER_USDT,
  buildTradePlan
};
