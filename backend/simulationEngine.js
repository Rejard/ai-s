const INITIAL_CASH = 10000;
const TRADE_FEE_RATE = 0.002;
const INDICATOR_WINDOW = 20;

function precomputeIndicators(candles) {
  const results = new Array(candles.length);

  for (let i = INDICATOR_WINDOW; i < candles.length; i++) {
    const current = candles[i].close;
    const previous = candles[i - 1].close;
    const priceChange = previous > 0 ? (current - previous) / previous : 0;

    let gains = 0;
    let losses = 0;
    const rsiPeriod = Math.min(14, i);
    for (let j = i - rsiPeriod + 1; j <= i; j++) {
      const diff = candles[j].close - candles[j - 1].close;
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / rsiPeriod;
    const avgLoss = losses / rsiPeriod;
    const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
    const rsi = (100 - (100 / (1 + rs))) / 50 - 1;

    let smaSum = 0;
    for (let j = i - INDICATOR_WINDOW + 1; j <= i; j++) {
      smaSum += candles[j].close;
    }
    const sma = smaSum / INDICATOR_WINDOW;
    const smaDeviation = sma > 0 ? (current - sma) / sma : 0;

    let volSum = 0;
    const windowStart = i - INDICATOR_WINDOW + 1;
    for (let j = windowStart; j <= i; j++) {
      volSum += candles[j].volume;
    }
    const avgVolume = volSum / INDICATOR_WINDOW;
    const volumeRatio = avgVolume > 0 ? (candles[i].volume / avgVolume) - 1 : 0;

    let closeSum = 0;
    for (let j = windowStart; j <= i; j++) {
      closeSum += candles[j].close;
    }
    const mean = closeSum / INDICATOR_WINDOW;
    let varianceSum = 0;
    for (let j = windowStart; j <= i; j++) {
      varianceSum += (candles[j].close - mean) ** 2;
    }
    const volatility = mean > 0 ? Math.sqrt(varianceSum / INDICATOR_WINDOW) / mean : 0;

    results[i] = [
      Math.max(-1, Math.min(1, priceChange * 10)),
      Math.max(-1, Math.min(1, rsi)),
      Math.max(-1, Math.min(1, smaDeviation * 5)),
      Math.max(-1, Math.min(1, volumeRatio)),
      Math.max(-1, Math.min(1, volatility * 5)),
    ];
  }

  return results;
}

function calculateIndicators(candles) {
  if (candles.length < INDICATOR_WINDOW) return null;

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const current = closes[closes.length - 1];
  const previous = closes[closes.length - 2];

  const priceChange = previous > 0 ? (current - previous) / previous : 0;

  let gains = 0;
  let losses = 0;
  const rsiPeriod = Math.min(14, closes.length - 1);
  for (let i = closes.length - rsiPeriod; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / rsiPeriod;
  const avgLoss = losses / rsiPeriod;
  const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
  const rsi = (100 - (100 / (1 + rs))) / 50 - 1;

  const smaSlice = closes.slice(-INDICATOR_WINDOW);
  const sma = smaSlice.reduce((a, b) => a + b, 0) / smaSlice.length;
  const smaDeviation = sma > 0 ? (current - sma) / sma : 0;

  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const volumeRatio = avgVolume > 0 ? (volumes[volumes.length - 1] / avgVolume) - 1 : 0;

  const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
  const variance = closes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / closes.length;
  const volatility = mean > 0 ? Math.sqrt(variance) / mean : 0;

  return [
    Math.max(-1, Math.min(1, priceChange * 10)),
    Math.max(-1, Math.min(1, rsi)),
    Math.max(-1, Math.min(1, smaDeviation * 5)),
    Math.max(-1, Math.min(1, volumeRatio)),
    Math.max(-1, Math.min(1, volatility * 5)),
  ];
}

function detectMarketCondition(indicators) {
  if (!indicators) return 'SIDEWAYS_DRIFT';
  const [priceChange, , , , volatility] = indicators;
  if (Math.abs(volatility) > 0.7) return 'BLACK_SWAN';
  if (priceChange > 0.3) return 'BULL_EXPANSION';
  if (priceChange < -0.3) return 'BEAR_SQUEEZE';
  return 'SIDEWAYS_DRIFT';
}

function filterActiveGenes(dna, marketCondition) {
  const strategyGenes = Array.isArray(dna.strategy_genes) ? dna.strategy_genes : [];
  const reg = dna.regulatory_profile || {};
  const budget = Number(reg.expression_budget || 12);

  const activeGenes = strategyGenes.filter((gene) => {
    if (!gene || gene.state !== 'A') return false;
    const masks = Array.isArray(gene.context_mask) ? gene.context_mask : [];
    return masks.length === 0 || masks.includes(marketCondition);
  });

  if (activeGenes.length <= budget) return activeGenes;

  const dominanceBias = Number(reg.dominance_bias || 1);
  return activeGenes
    .sort((a, b) => (Number(b.copy_number || 1) * dominanceBias) - (Number(a.copy_number || 1) * dominanceBias))
    .slice(0, budget);
}

function blendWeights(baseWeights, activeGenes, regulatoryProfile) {
  if (!activeGenes || activeGenes.length === 0) return baseWeights;

  const decayResistance = Number(regulatoryProfile?.decay_resistance || 0.3);
  const blended = { BUY: [0, 0, 0, 0, 0], SELL: [0, 0, 0, 0, 0], HOLD: [0, 0, 0, 0, 0] };
  let totalWeight = 0;

  for (const gene of activeGenes) {
    const copyNumber = Number(gene.copy_number || 1);
    const subgenes = Array.isArray(gene.subgenes) ? gene.subgenes : [];

    for (const sub of subgenes) {
      if (!sub || sub.state !== 'A') continue;
      const action = sub.action;
      const featureIdx = sub.feature_index;
      if (['BUY', 'SELL', 'HOLD'].includes(action) && featureIdx >= 0 && featureIdx < 5) {
        blended[action][featureIdx] += Number(sub.weight || 0) * copyNumber;
        totalWeight += copyNumber;
      }
    }
  }

  if (totalWeight === 0) return baseWeights;

  for (const action of ['BUY', 'SELL', 'HOLD']) {
    for (let i = 0; i < 5; i++) {
      blended[action][i] = (blended[action][i] / Math.max(1, totalWeight / 3)) * (1 - decayResistance)
        + baseWeights[action][i] * decayResistance;
    }
  }

  return blended;
}

function dotProduct(weights, indicators) {
  let sum = 0;
  for (let i = 0; i < Math.min(weights.length, indicators.length); i++) {
    sum += weights[i] * indicators[i];
  }
  return sum;
}

function simulateTrades(dna, candles, config = {}) {
  const initialCash = config.initialCash || INITIAL_CASH;
  const feeRate = config.feeRate || TRADE_FEE_RATE;
  const precomputed = config._precomputedIndicators || null;

  const weights = dna.weights || { BUY: [0, 0, 0, 0, 0], SELL: [0, 0, 0, 0, 0], HOLD: [0, 0, 0, 0, 0] };

  let cash = initialCash;
  let position = 0;
  let trades = 0;
  let wins = 0;
  let losses = 0;
  let peakValue = initialCash;
  let maxDrawdown = 0;
  let lastValue = initialCash;
  let returnSum = 0;
  let returnSqSum = 0;
  let returnCount = 0;
  let lastEntryPrice = 0;

  for (let i = INDICATOR_WINDOW; i < candles.length; i++) {
    const indicators = precomputed ? precomputed[i] : null;
    if (!indicators) continue;

    const marketCondition = detectMarketCondition(indicators);
    const activeGenes = filterActiveGenes(dna, marketCondition);
    const effectiveWeights = blendWeights(weights, activeGenes, dna.regulatory_profile);

    const buyScore = dotProduct(effectiveWeights.BUY, indicators);
    const sellScore = dotProduct(effectiveWeights.SELL, indicators);
    const holdScore = dotProduct(effectiveWeights.HOLD, indicators);

    const currentPrice = candles[i].close;
    let action = 'HOLD';
    if (buyScore > sellScore && buyScore > holdScore) action = 'BUY';
    else if (sellScore > buyScore && sellScore > holdScore) action = 'SELL';

    if (action === 'BUY' && cash > 0) {
      const spendable = cash * 0.95;
      const amount = spendable / currentPrice;
      const fee = spendable * feeRate;
      cash -= (spendable + fee);
      position += amount;
      lastEntryPrice = currentPrice;
      trades++;
    } else if (action === 'SELL' && position > 0) {
      const revenue = position * currentPrice;
      const fee = revenue * feeRate;
      cash += (revenue - fee);
      if (currentPrice > lastEntryPrice) wins++;
      else losses++;
      position = 0;
      trades++;
    }

    const totalValue = cash + position * currentPrice;
    if (lastValue > 0) {
      const r = (totalValue - lastValue) / lastValue;
      returnSum += r;
      returnSqSum += r * r;
      returnCount++;
    }
    lastValue = totalValue;

    if (totalValue > peakValue) peakValue = totalValue;
    const drawdown = peakValue > 0 ? (peakValue - totalValue) / peakValue : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const finalPrice = candles[candles.length - 1]?.close || 0;
  const totalValue = cash + position * finalPrice;
  const totalReturn = (totalValue - initialCash) / initialCash;

  const avgReturn = returnCount > 0 ? returnSum / returnCount : 0;
  const variance = returnCount > 1 ? (returnSqSum - returnSum * returnSum / returnCount) / (returnCount - 1) : 1;
  const stdReturn = Math.sqrt(Math.max(0, variance));
  const sharpeRatio = stdReturn > 0 ? avgReturn / stdReturn : 0;

  const winRate = trades > 0 ? wins / Math.max(1, wins + losses) : 0;

  return {
    totalReturn,
    sharpeRatio,
    maxDrawdown,
    winRate,
    trades,
    wins,
    losses,
    finalValue: totalValue,
    fitness: calculateSimFitness({ totalReturn, sharpeRatio, maxDrawdown, winRate, trades }),
  };
}

function calculateSimFitness({ totalReturn, sharpeRatio, maxDrawdown, winRate, trades }) {
  if (trades < 5) return -1;
  if (maxDrawdown > 0.5) return totalReturn * 0.1;

  return totalReturn * 0.4
    + Math.max(-1, Math.min(1, sharpeRatio)) * 0.3
    + (1 - maxDrawdown) * 0.2
    + winRate * 0.1;
}

function splitTimeSeries(candles, trainRatio = 0.7) {
  const splitIdx = Math.floor(candles.length * trainRatio);
  return [candles.slice(0, splitIdx), candles.slice(splitIdx)];
}

module.exports = {
  calculateIndicators,
  precomputeIndicators,
  detectMarketCondition,
  filterActiveGenes,
  blendWeights,
  dotProduct,
  simulateTrades,
  calculateSimFitness,
  splitTimeSeries,
  INDICATOR_WINDOW,
};
