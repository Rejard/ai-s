const INITIAL_CASH = 10000;
const TRADE_FEE_RATE = 0.002;
const INDICATOR_WINDOW = 20;
const FEATURE_COUNT = 10;
const DEFAULT_WEIGHTS = () => new Array(FEATURE_COUNT).fill(0);

function computeEma(values, period) {
  const ema = new Array(values.length).fill(0);
  const k = 2 / (period + 1);
  ema[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    ema[i] = values[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function precomputeIndicators(candles) {
  const results = new Array(candles.length);
  const len = candles.length;

  const closes = new Float64Array(len);
  const volumes = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    closes[i] = candles[i].close;
    volumes[i] = candles[i].volume;
  }

  const ema9 = computeEma(closes, 9);
  const ema12 = computeEma(closes, 12);
  const ema21 = computeEma(closes, 21);
  const ema26 = computeEma(closes, 26);

  const macdLine = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    macdLine[i] = ema12[i] - ema26[i];
  }
  const signalLine = computeEma(macdLine, 9);

  let obv = 0;
  const obvArr = new Float64Array(len);
  obvArr[0] = 0;
  for (let i = 1; i < len; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    obvArr[i] = obv;
  }

  for (let i = INDICATOR_WINDOW; i < len; i++) {
    const current = closes[i];
    const previous = closes[i - 1];
    const priceChange = previous > 0 ? (current - previous) / previous : 0;

    let gains = 0;
    let losses = 0;
    const rsiPeriod = Math.min(14, i);
    for (let j = i - rsiPeriod + 1; j <= i; j++) {
      const diff = closes[j] - closes[j - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / rsiPeriod;
    const avgLoss = losses / rsiPeriod;
    const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
    const rsi = (100 - (100 / (1 + rs))) / 50 - 1;

    let smaSum = 0;
    const windowStart = i - INDICATOR_WINDOW + 1;
    for (let j = windowStart; j <= i; j++) {
      smaSum += closes[j];
    }
    const sma = smaSum / INDICATOR_WINDOW;
    const smaDeviation = sma > 0 ? (current - sma) / sma : 0;

    let volSum = 0;
    for (let j = windowStart; j <= i; j++) {
      volSum += volumes[j];
    }
    const avgVolume = volSum / INDICATOR_WINDOW;
    const volumeRatio = avgVolume > 0 ? (volumes[i] / avgVolume) - 1 : 0;

    let closeSum = 0;
    for (let j = windowStart; j <= i; j++) {
      closeSum += closes[j];
    }
    const mean = closeSum / INDICATOR_WINDOW;
    let varianceSum = 0;
    for (let j = windowStart; j <= i; j++) {
      varianceSum += (closes[j] - mean) ** 2;
    }
    const stdDev = Math.sqrt(varianceSum / INDICATOR_WINDOW);
    const volatility = mean > 0 ? stdDev / mean : 0;

    const macdHistogram = current > 0 ? (macdLine[i] - signalLine[i]) / current : 0;

    const bollingerUpper = sma + 2 * stdDev;
    const bollingerLower = sma - 2 * stdDev;
    const bollingerRange = bollingerUpper - bollingerLower;
    const bollingerPctB = bollingerRange > 0 ? (current - bollingerLower) / bollingerRange : 0.5;

    let trSum = 0;
    for (let j = i - 13; j <= i; j++) {
      if (j < 1) continue;
      const high = candles[j].high;
      const low = candles[j].low;
      const prevClose = closes[j - 1];
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trSum += tr;
    }
    const atr = trSum / 14;
    const atrRatio = current > 0 ? atr / current : 0;

    const emaCrossover = current > 0 ? (ema9[i] - ema21[i]) / current : 0;

    const prevObv = i >= 20 ? obvArr[i - 20] : obvArr[0];
    const obvChange = Math.abs(prevObv) > 0 ? (obvArr[i] - prevObv) / Math.abs(prevObv) : 0;

    const clamp = (v) => Math.max(-1, Math.min(1, v));

    results[i] = [
      clamp(priceChange * 10),
      clamp(rsi),
      clamp(smaDeviation * 5),
      clamp(volumeRatio),
      clamp(volatility * 5),
      clamp(macdHistogram * 100),
      clamp(bollingerPctB * 2 - 1),
      clamp(atrRatio * 10),
      clamp(emaCrossover * 100),
      clamp(obvChange),
    ];
  }

  return results;
}

function calculateIndicators(candles) {
  if (candles.length < INDICATOR_WINDOW) return null;

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const len = closes.length;
  const current = closes[len - 1];
  const previous = closes[len - 2];

  const priceChange = previous > 0 ? (current - previous) / previous : 0;

  let gains = 0;
  let losses = 0;
  const rsiPeriod = Math.min(14, len - 1);
  for (let i = len - rsiPeriod; i < len; i++) {
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
  const volumeRatio = avgVolume > 0 ? (volumes[len - 1] / avgVolume) - 1 : 0;

  const mean = closes.reduce((a, b) => a + b, 0) / len;
  const variance = closes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / len;
  const stdDev = Math.sqrt(variance);
  const volatility = mean > 0 ? stdDev / mean : 0;

  const ema9 = computeEma(closes, 9);
  const ema12 = computeEma(closes, 12);
  const ema21 = computeEma(closes, 21);
  const ema26 = computeEma(closes, 26);
  const macdLine = ema12[len - 1] - ema26[len - 1];
  const signalArr = computeEma(closes.map((_, idx) => ema12[idx] - ema26[idx]), 9);
  const macdHistogram = current > 0 ? (macdLine - signalArr[len - 1]) / current : 0;

  const bollingerUpper = sma + 2 * stdDev;
  const bollingerLower = sma - 2 * stdDev;
  const bollingerRange = bollingerUpper - bollingerLower;
  const bollingerPctB = bollingerRange > 0 ? (current - bollingerLower) / bollingerRange : 0.5;

  let trSum = 0;
  const atrStart = Math.max(1, len - 14);
  for (let i = atrStart; i < len; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = closes[i - 1];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trSum += tr;
  }
  const atr = trSum / Math.min(14, len - 1);
  const atrRatio = current > 0 ? atr / current : 0;

  const emaCrossover = current > 0 ? (ema9[len - 1] - ema21[len - 1]) / current : 0;

  let obv = 0;
  for (let i = 1; i < len; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
  }
  let obvPrev = 0;
  const obvLookback = Math.max(1, len - 20);
  for (let i = 1; i < obvLookback; i++) {
    if (closes[i] > closes[i - 1]) obvPrev += volumes[i];
    else if (closes[i] < closes[i - 1]) obvPrev -= volumes[i];
  }
  const obvChange = Math.abs(obvPrev) > 0 ? (obv - obvPrev) / Math.abs(obvPrev) : 0;

  const clamp = (v) => Math.max(-1, Math.min(1, v));

  return [
    clamp(priceChange * 10),
    clamp(rsi),
    clamp(smaDeviation * 5),
    clamp(volumeRatio),
    clamp(volatility * 5),
    clamp(macdHistogram * 100),
    clamp(bollingerPctB * 2 - 1),
    clamp(atrRatio * 10),
    clamp(emaCrossover * 100),
    clamp(obvChange),
  ];
}

function detectMarketCondition(indicators) {
  if (!indicators) return 'SIDEWAYS_DRIFT';
  const priceChange = indicators[0];
  const volatility = indicators[4];
  const volumeRatio = indicators[3];
  if (Math.abs(volatility) > 0.7) return 'BLACK_SWAN';
  if (volumeRatio < -0.6) return 'LOW_VOLUME';
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
  const blended = { BUY: DEFAULT_WEIGHTS(), SELL: DEFAULT_WEIGHTS(), HOLD: DEFAULT_WEIGHTS() };
  let totalWeight = 0;

  for (const gene of activeGenes) {
    const copyNumber = Number(gene.copy_number || 1);
    const subgenes = Array.isArray(gene.subgenes) ? gene.subgenes : [];

    for (const sub of subgenes) {
      if (!sub || sub.state !== 'A') continue;
      const action = sub.action;
      const featureIdx = sub.feature_index;
      if (['BUY', 'SELL', 'HOLD'].includes(action) && featureIdx >= 0 && featureIdx < FEATURE_COUNT) {
        blended[action][featureIdx] += Number(sub.weight || 0) * copyNumber;
        totalWeight += copyNumber;
      }
    }
  }

  if (totalWeight === 0) return baseWeights;

  for (const action of ['BUY', 'SELL', 'HOLD']) {
    for (let i = 0; i < FEATURE_COUNT; i++) {
      blended[action][i] = (blended[action][i] / Math.max(1, totalWeight / 3)) * (1 - decayResistance)
        + (baseWeights[action][i] || 0) * decayResistance;
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

  const weights = dna.weights || { BUY: DEFAULT_WEIGHTS(), SELL: DEFAULT_WEIGHTS(), HOLD: DEFAULT_WEIGHTS() };

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
  FEATURE_COUNT,
  DEFAULT_WEIGHTS,
};
