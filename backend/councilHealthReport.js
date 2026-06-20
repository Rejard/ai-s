function parseRunKeyTimestamp(runKey) {
  const match = /^ais_run_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_/.exec(String(runKey || ''));
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
}

function parseTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function computeDiversity(allMembers) {
  let diversityScore = 100;
  let rawStdDev = 0.15;

  if (!allMembers || allMembers.length === 0) {
    return { diversityScore, rawStdDev };
  }

  const vectors = [];
  allMembers.forEach((member) => {
    try {
      const raw = member.phenotype_json || member.weights_json;
      const weights = JSON.parse(raw);
      const buyVec = Array.isArray(weights.BUY) ? weights.BUY : [];
      const sellVec = Array.isArray(weights.SELL) ? weights.SELL : [];
      const holdVec = Array.isArray(weights.HOLD) ? weights.HOLD : [];
      const flat = [...buyVec, ...sellVec, ...holdVec];
      if (flat.length > 0) vectors.push(flat);
    } catch {}
  });

  if (vectors.length <= 1) {
    return { diversityScore, rawStdDev };
  }

  const numDimensions = vectors[0].length;
  const numSamples = vectors.length;
  let totalStdDev = 0;
  let validDimensions = 0;

  for (let dimension = 0; dimension < numDimensions; dimension += 1) {
    let sum = 0;
    for (let sample = 0; sample < numSamples; sample += 1) {
      sum += vectors[sample][dimension] || 0;
    }
    const mean = sum / numSamples;

    let varianceSum = 0;
    for (let sample = 0; sample < numSamples; sample += 1) {
      varianceSum += Math.pow((vectors[sample][dimension] || 0) - mean, 2);
    }
    const variance = varianceSum / (numSamples - 1);
    const stdDev = Math.sqrt(variance);
    if (!Number.isNaN(stdDev)) {
      totalStdDev += stdDev;
      validDimensions += 1;
    }
  }

  rawStdDev = validDimensions > 0 ? (totalStdDev / validDimensions) : 0.15;
  diversityScore = Math.min(100, Math.max(0, Math.round((rawStdDev / 0.25) * 100)));
  return { diversityScore, rawStdDev };
}

function computeTiming(latestRun) {
  let computationMargin = 90.0;
  let elapsedSeconds = 30.0;

  if (!latestRun || !latestRun.completed_at) {
    return { computationMargin, elapsedSeconds };
  }

  const completedAt = parseTimestamp(latestRun.completed_at);
  const startedAt = parseRunKeyTimestamp(latestRun.run_key) || parseTimestamp(latestRun.created_at);

  if (!completedAt || !startedAt) {
    return { computationMargin, elapsedSeconds };
  }

  elapsedSeconds = Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000));
  computationMargin = Math.max(0, parseFloat((((300 - elapsedSeconds) / 300) * 100).toFixed(1)));
  return { computationMargin, elapsedSeconds };
}

function buildCouncilHealthReport({ totalCount, allMembers, latestRun }) {
  const { diversityScore, rawStdDev } = computeDiversity(allMembers);
  const { computationMargin, elapsedSeconds } = computeTiming(latestRun);

  let diversityGrade = 'GOOD';
  let diagnosticClass = 'success';
  let recommendationText = `현재 ${totalCount}명 정원은 유전자 다양성(${diversityScore}%)과 서버 연산 마진(${computationMargin}%) 모두 최상의 밸런스를 유지하고 있습니다. 무작정 정원을 늘릴 필요가 없는 매우 이상적인 규모입니다.`;

  if (diversityScore < 20) {
    diversityGrade = 'CRITICAL';
    diagnosticClass = 'danger';
    recommendationText = `⚠️ 경고: AI 의원들의 유전적 다양성(${diversityScore}%)이 바닥나 거의 똑같이 판단하는 획일화 현상이 감지되었습니다. 다양성 확보를 위해 의원 정원을 800~1,000명으로 확장하거나, 돌연변이 수혈 비중을 강제로 높여야 합니다.`;
  } else if (diversityScore < 40) {
    diversityGrade = 'WARNING';
    diagnosticClass = 'warning';
    recommendationText = `⚠️ 주의: 유전적 획일화 현상이 시작되었습니다. 현재 ${totalCount}명 정원은 아직 가능하나, 시장이 정체될 경우 정원을 800명 수준으로 늘려 다양성을 확보하는 것을 권장합니다.`;
  } else if (computationMargin < 20) {
    diversityGrade = 'WARNING';
    diagnosticClass = 'warning';
    recommendationText = `⚠️ 서버 연산 주의: 매 5분당 AI 학습 필요 시간(${elapsedSeconds}초)이 한계치에 가까워 서버 마진이 부족합니다. 정원을 더 늘리면 의사결정 지연이 발생할 수 있으므로 현재 ${totalCount}명 정원 유지가 강력 권장됩니다.`;
  }

  return {
    diversityScore,
    rawStdDev: parseFloat(rawStdDev.toFixed(4)),
    computationMargin,
    elapsedSeconds,
    diversityGrade,
    diagnosticClass,
    recommendationText,
  };
}

module.exports = {
  buildCouncilHealthReport,
};
