const emptyDecision = () => ({ count: 0, correct: 0, accuracy: 0 });

export function normalizeAisTrainingStats(data = {}) {
  const byDecision = data.byDecision || {};
  return {
    total: Number(data.total || data.count || 0),
    labeled: Number(data.labeled || 0),
    pending: Number(data.pending || 0),
    invalid: Number(data.invalid || 0),
    labelVersion: Number(data.labelVersion || 2),
    byDecision: {
      BUY: { ...emptyDecision(), ...(byDecision.BUY || {}) },
      SELL: { ...emptyDecision(), ...(byDecision.SELL || {}) },
      HOLD: { ...emptyDecision(), ...(byDecision.HOLD || {}) },
    },
    latestRun: data.latestRun || null,
    shadowOnly: data.shadowOnly !== false,
    automaticPromotionEnabled: data.automaticPromotionEnabled === true,
  };
}
