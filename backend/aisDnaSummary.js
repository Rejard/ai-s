const { safeParseJson } = require('./councilShared');
const { DEFAULT_WEIGHTS } = require('./simulationEngine');

function summarizeDnaStates(dnaInput) {
  const dna = safeParseJson(dnaInput, {});
  const summary = { active: 0, inactive: 0, deprecated: 0, lethal: 0 };
  const bump = (state) => {
    if (state === 'A') summary.active += 1;
    else if (state === 'I') summary.inactive += 1;
    else if (state === 'D') summary.deprecated += 1;
    else if (state === 'L') summary.lethal += 1;
  };

  const strategyGenes = dna && Array.isArray(dna.strategy_genes) ? dna.strategy_genes : [];
  for (const strategy of strategyGenes) {
    if (!strategy || typeof strategy !== 'object') continue;
    bump(strategy.state);
    const subgenes = Array.isArray(strategy.subgenes) ? strategy.subgenes : [];
    for (const subgene of subgenes) {
      if (subgene && typeof subgene === 'object') bump(subgene.state);
    }
  }
  return summary;
}

function summarizeMutationLog(dnaInput) {
  const dna = safeParseJson(dnaInput, {});
  const summary = {
    stateMutation: 0,
    contextMaskMutation: 0,
    contextMutationDetail: {
      blackSwanAdded: 0,
      blackSwanRemoved: 0,
      coreAdded: 0,
      coreRemoved: 0,
    },
    profileMutation: 0,
    profileMutationByKey: {
      expressionBudget: 0,
      dominanceBias: 0,
      decayResistance: 0,
      reactivationBias: 0,
    },
    copyNumberMutation: 0,
    copyNumberDirection: {
      up: 0,
      down: 0,
      flat: 0,
    },
    weightNudge: 0,
    vepFiltered: 0,
  };
  const mutationLog = dna && Array.isArray(dna.mutation_log) ? dna.mutation_log : [];

  for (const entry of mutationLog) {
    const event = entry && typeof entry === 'object' ? entry.event : null;
    if (event === 'state_mutation') summary.stateMutation += 1;
    else if (event === 'context_mask_mutation') {
      summary.contextMaskMutation += 1;
      const contextKey = entry.context_key;
      const action = entry.action;
      if (contextKey === 'BLACK_SWAN') {
        if (action === 'added') summary.contextMutationDetail.blackSwanAdded += 1;
        else if (action === 'removed') summary.contextMutationDetail.blackSwanRemoved += 1;
      } else if (typeof contextKey === 'string' && contextKey) {
        if (action === 'added') summary.contextMutationDetail.coreAdded += 1;
        else if (action === 'removed') summary.contextMutationDetail.coreRemoved += 1;
      }
    }
    else if (event === 'profile_mutation') {
      summary.profileMutation += 1;
      const key = entry.profile_key;
      if (key === 'expression_budget') summary.profileMutationByKey.expressionBudget += 1;
      else if (key === 'dominance_bias') summary.profileMutationByKey.dominanceBias += 1;
      else if (key === 'decay_resistance') summary.profileMutationByKey.decayResistance += 1;
      else if (key === 'reactivation_bias') summary.profileMutationByKey.reactivationBias += 1;
    } else if (event === 'copy_number_mutation') {
      summary.copyNumberMutation += 1;
      const fromValue = Number(entry.from_value);
      const toValue = Number(entry.to_value);
      if (Number.isFinite(fromValue) && Number.isFinite(toValue)) {
        if (toValue > fromValue) summary.copyNumberDirection.up += 1;
        else if (toValue < fromValue) summary.copyNumberDirection.down += 1;
        else summary.copyNumberDirection.flat += 1;
      } else {
        summary.copyNumberDirection.flat += 1;
      }
    }
    else if (event === 'weight_nudge') summary.weightNudge += 1;
    else if (event === 'vep_filtered_deleterious_mutation') summary.vepFiltered += 1;
  }

  return summary;
}

function extractPhenotype(phenotypeInput) {
  const fallback = {
    BUY: DEFAULT_WEIGHTS(),
    SELL: DEFAULT_WEIGHTS(),
    HOLD: DEFAULT_WEIGHTS(),
  };
  const parsed = safeParseJson(phenotypeInput, fallback);
  return Object.fromEntries(
    Object.entries(fallback).map(([action, defaultVector]) => {
      const vector = parsed && Array.isArray(parsed[action]) ? parsed[action] : defaultVector;
      return [
        action,
        vector.length === defaultVector.length ? vector : defaultVector,
      ];
    })
  );
}

module.exports = {
  summarizeDnaStates,
  summarizeMutationLog,
  extractPhenotype,
};
