import React from 'react';

const reasonLabels = {
  MIN_LABELED_OBSERVATIONS: 'Labeled samples below 300',
  LABEL_INTEGRITY_FAILURE: 'Invalid labeled data remains',
  MIN_BENCHMARK_MARGIN: 'Benchmark margin below 3%p',
  MIN_CLASS_COVERAGE: 'BUY/SELL/HOLD class coverage too low',
  INVALID_PROMOTION_METADATA: 'Promotion metadata is invalid',
};

function Metric({ label, value, color = '#F3F4F6' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}

function formatContextMaskSummary(contextMaskSummary = []) {
  if (!Array.isArray(contextMaskSummary) || contextMaskSummary.length === 0) {
    return 'none';
  }
  return contextMaskSummary.join(', ');
}

function formatEventCounts(eventCounts = {}) {
  const entries = Object.entries(eventCounts).filter(([, count]) => Number(count) > 0);
  if (!entries.length) {
    return 'none';
  }
  return entries.map(([event, count]) => `${event} ${count}`).join(', ');
}

function parseActiveStrategyGenes(activeMembers = []) {
  return activeMembers.flatMap((member) => {
    try {
      const dna = JSON.parse(member.dna_json || '{}');
      const strategyGenes = Array.isArray(dna.strategy_genes) ? dna.strategy_genes : [];
      return strategyGenes.map((gene) => ({
        memberId: member.member_id,
        memberName: member.name,
        geneId: gene.gene_id,
        state: gene.state,
        subgeneCount: Array.isArray(gene.subgenes) ? gene.subgenes.length : 0,
        contextMaskSummary: Array.isArray(gene.context_mask) ? gene.context_mask : [],
        blackSwanEnabled: Array.isArray(gene.context_mask) && gene.context_mask.includes('BLACK_SWAN'),
      }));
    } catch {
      return [];
    }
  });
}

export default function AisTrainingEvidence({
  stats,
  globalAiEngine,
  handleToggleAutomaticPromotion,
  aidlPolicy,
  councilStats,
  submittingAidlGeneState,
  handleAidlGeneStateUpdate,
  submittingAidlGeneContext,
  handleAidlGeneContextUpdate,
}) {
  const latest = stats?.latestRun;
  const decisions = stats?.byDecision || {};
  const dnaStateTotals = stats?.dnaStateTotals || { active: 0, inactive: 0, deprecated: 0, lethal: 0 };
  const dnaMutationTotals = stats?.dnaMutationTotals || { stateMutation: 0, contextMaskMutation: 0, profileMutation: 0, copyNumberMutation: 0, weightNudge: 0, vepFiltered: 0 };
  const selectionTelemetry = stats?.selectionTelemetry || { culledCount: 0, offspringCount: 0, mutantCount: 0, archiveCount: 0 };
  const dnaOperations = stats?.dnaOperations || { archiveCount: 0, averageFitnessHistoryDepth: 0, latestArchivedAt: '' };
  const dnaRepairTelemetry = stats?.dnaRepairTelemetry || { accessionRepairCount: 0, contextMaskRepairCount: 0, profileRepairCount: 0, lastRepairedAt: '' };
  const dnaContextSummary = stats?.dnaContextSummary || { blackSwanStrategyGenes: 0, blackSwanActiveGenomes: 0, blackSwanArchivedGenomes: 0 };
  const dnaContextPerformance = stats?.dnaContextPerformance || {
    blackSwanActive: { genomeCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0, averageMutationEvents: 0 },
    coreActive: { genomeCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0, averageMutationEvents: 0 },
    blackSwanArchive: { archiveCount: 0, averageGeneration: 0, lowPerformanceCount: 0, vepFilteredCount: 0 },
    coreArchive: { archiveCount: 0, averageGeneration: 0, lowPerformanceCount: 0, vepFilteredCount: 0 },
  };
  const dnaContextPathway = stats?.dnaContextPathway || {
    blackSwanActive: { genomeCount: 0, vepFilteredGenomes: 0, lastMutationEventCounts: {} },
    coreActive: { genomeCount: 0, vepFilteredGenomes: 0, lastMutationEventCounts: {} },
    blackSwanArchive: { archiveCount: 0, lowPerformanceCount: 0, vepFilteredCount: 0, lastMutationEventCounts: {} },
    coreArchive: { archiveCount: 0, lowPerformanceCount: 0, vepFilteredCount: 0, lastMutationEventCounts: {} },
  };
  const dnaLineage = stats?.dnaLineage || { activeGenomes: [], recentArchives: [] };
  const activeStrategyGenes = parseActiveStrategyGenes(councilStats?.activeMembers || []);
  const runtimePolicy = aidlPolicy || { contextMutationRate: '0.10', stateMutationRate: '0.10', profileMutationRate: '0.08', copyNumberMutationRate: '0.06', weightNudgeSize: '0.02' };
  const isEngineEligible = globalAiEngine === 'HYBRID_COOP' || globalAiEngine === 'AIS_ONLY';
  const isPromoEnabled = stats?.automaticPromotionEnabled;

  return (
    <div style={{
      background: 'rgba(0,0,0,0.24)',
      border: '1px solid rgba(139,92,246,0.2)',
      borderRadius: '10px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '7px',
      fontSize: '10px',
      color: 'var(--text-muted)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <strong style={{ color: '#C4B5FD' }}>Shadow Challenger Validation</strong>

        {!isEngineEligible ? (
          <button
            type="button"
            disabled
            title="Automatic promotion is available only in HYBRID_COOP or AIS_ONLY mode."
            style={{
              color: 'var(--text-dark)',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              padding: '4px 10px',
              fontWeight: '800',
              fontSize: '9px',
              cursor: 'not-allowed',
              opacity: 0.6,
              transition: 'all 0.2s',
            }}
          >
            Auto Promotion OFF (engine restricted)
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleAutomaticPromotion}
            title={isPromoEnabled ? 'Disable automatic promotion' : 'Enable automatic promotion'}
            style={{
              color: isPromoEnabled ? '#10B981' : '#FBBF24',
              background: isPromoEnabled ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.06)',
              border: isPromoEnabled ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(245,158,11,0.2)',
              borderRadius: '6px',
              padding: '4px 10px',
              fontWeight: '900',
              fontSize: '9px',
              cursor: 'pointer',
              boxShadow: isPromoEnabled ? '0 0 10px rgba(16,185,129,0.1)' : 'none',
              transition: 'all 0.2s ease-in-out',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.03)';
              e.currentTarget.style.background = isPromoEnabled ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = isPromoEnabled ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.06)';
            }}
          >
            <span>Auto Promotion {isPromoEnabled ? 'ON' : 'OFF'}</span>
          </button>
        )}
      </div>

      <Metric label="Label Status" value={`Labeled ${stats?.labeled || 0} / Pending ${stats?.pending || 0} / Invalid ${stats?.invalid || 0}`} />
      <Metric
        label="DNA State"
        value={`A ${dnaStateTotals.active || 0} / I ${dnaStateTotals.inactive || 0} / D ${dnaStateTotals.deprecated || 0} / L ${dnaStateTotals.lethal || 0}`}
        color={stats?.dnaStateTotalsAvailable === false ? '#FBBF24' : '#C4B5FD'}
      />
      <Metric
        label="DNA Mutation"
        value={`State ${dnaMutationTotals.stateMutation || 0} / Context ${dnaMutationTotals.contextMaskMutation || 0} / Profile ${dnaMutationTotals.profileMutation || 0} / Copy ${dnaMutationTotals.copyNumberMutation || 0} / Nudge ${dnaMutationTotals.weightNudge || 0} / VEP ${dnaMutationTotals.vepFiltered || 0}`}
        color="#93C5FD"
      />
      <Metric
        label="Context Detail"
        value={`BS +${dnaMutationTotals.contextMutationDetail?.blackSwanAdded || 0} / BS -${dnaMutationTotals.contextMutationDetail?.blackSwanRemoved || 0} / Core +${dnaMutationTotals.contextMutationDetail?.coreAdded || 0} / Core -${dnaMutationTotals.contextMutationDetail?.coreRemoved || 0}`}
        color="#93C5FD"
      />
      <Metric
        label="Profile Detail"
        value={`Budget ${dnaMutationTotals.profileMutationByKey?.expressionBudget || 0} / Dominance ${dnaMutationTotals.profileMutationByKey?.dominanceBias || 0} / Decay ${dnaMutationTotals.profileMutationByKey?.decayResistance || 0} / Reactivation ${dnaMutationTotals.profileMutationByKey?.reactivationBias || 0}`}
        color="#93C5FD"
      />
      <Metric
        label="Copy Direction"
        value={`Up ${dnaMutationTotals.copyNumberDirection?.up || 0} / Down ${dnaMutationTotals.copyNumberDirection?.down || 0} / Flat ${dnaMutationTotals.copyNumberDirection?.flat || 0}`}
        color="#93C5FD"
      />
      <Metric
        label="BLACK_SWAN"
        value={`Genes ${dnaContextSummary.blackSwanStrategyGenes || 0} / Active ${dnaContextSummary.blackSwanActiveGenomes || 0} / Archive ${dnaContextSummary.blackSwanArchivedGenomes || 0}`}
        color="#F472B6"
      />
      <Metric
        label="BS Active Perf"
        value={`BS ${dnaContextPerformance.blackSwanActive?.genomeCount || 0} / V ${dnaContextPerformance.blackSwanActive?.averageLatestValidationScore || 0} / H ${dnaContextPerformance.blackSwanActive?.averageLatestHoldoutScore || 0} / M ${dnaContextPerformance.blackSwanActive?.averageMutationEvents || 0} | Core ${dnaContextPerformance.coreActive?.genomeCount || 0} / V ${dnaContextPerformance.coreActive?.averageLatestValidationScore || 0} / H ${dnaContextPerformance.coreActive?.averageLatestHoldoutScore || 0} / M ${dnaContextPerformance.coreActive?.averageMutationEvents || 0}`}
        color="#F472B6"
      />
      <Metric
        label="BS Archive Perf"
        value={`BS ${dnaContextPerformance.blackSwanArchive?.archiveCount || 0} / G ${dnaContextPerformance.blackSwanArchive?.averageGeneration || 0} / Low ${dnaContextPerformance.blackSwanArchive?.lowPerformanceCount || 0} / VEP ${dnaContextPerformance.blackSwanArchive?.vepFilteredCount || 0} | Core ${dnaContextPerformance.coreArchive?.archiveCount || 0} / G ${dnaContextPerformance.coreArchive?.averageGeneration || 0} / Low ${dnaContextPerformance.coreArchive?.lowPerformanceCount || 0} / VEP ${dnaContextPerformance.coreArchive?.vepFilteredCount || 0}`}
        color="#F472B6"
      />
      <Metric
        label="BS Path Active"
        value={`BS VEP ${dnaContextPathway.blackSwanActive?.vepFilteredGenomes || 0} / Last ${formatEventCounts(dnaContextPathway.blackSwanActive?.lastMutationEventCounts)} | Core VEP ${dnaContextPathway.coreActive?.vepFilteredGenomes || 0} / Last ${formatEventCounts(dnaContextPathway.coreActive?.lastMutationEventCounts)}`}
        color="#F472B6"
      />
      <Metric
        label="BS Path Archive"
        value={`BS Low ${dnaContextPathway.blackSwanArchive?.lowPerformanceCount || 0} / VEP ${dnaContextPathway.blackSwanArchive?.vepFilteredCount || 0} / Last ${formatEventCounts(dnaContextPathway.blackSwanArchive?.lastMutationEventCounts)} | Core Low ${dnaContextPathway.coreArchive?.lowPerformanceCount || 0} / VEP ${dnaContextPathway.coreArchive?.vepFilteredCount || 0} / Last ${formatEventCounts(dnaContextPathway.coreArchive?.lastMutationEventCounts)}`}
        color="#F472B6"
      />
      <Metric
        label="Selection"
        value={`Cull ${selectionTelemetry.culledCount || 0} / Offspring ${selectionTelemetry.offspringCount || 0} / Mutant ${selectionTelemetry.mutantCount || 0} / Archive ${selectionTelemetry.archiveCount || 0}`}
        color="#FCA5A5"
      />
      <Metric
        label="Runtime Policy"
        value={`Context ${runtimePolicy.contextMutationRate} / State ${runtimePolicy.stateMutationRate} / Profile ${runtimePolicy.profileMutationRate} / Copy ${runtimePolicy.copyNumberMutationRate} / Nudge ${runtimePolicy.weightNudgeSize}`}
        color="#86EFAC"
      />
      <Metric
        label="DNA Ops"
        value={`Archive ${dnaOperations.archiveCount || 0} / History ${dnaOperations.averageFitnessHistoryDepth || 0} / Latest ${dnaOperations.latestArchivedAt || '-'}`}
        color="#FDE68A"
      />
      <Metric
        label="DNA Repair"
        value={`Accession ${dnaRepairTelemetry.accessionRepairCount || 0} / Context ${dnaRepairTelemetry.contextMaskRepairCount || 0} / Profile ${dnaRepairTelemetry.profileRepairCount || 0} / Latest ${dnaRepairTelemetry.lastRepairedAt || '-'}`}
        color="#FDBA74"
      />

      {dnaLineage.activeGenomes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
          <strong style={{ color: '#93C5FD', fontSize: '10px' }}>Active DNA Lineage</strong>
          {dnaLineage.activeGenomes.map((genome) => (
            <div key={`${genome.memberId}-${genome.genomeId}`} style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {genome.name || genome.memberId} / {genome.genomeId} / G{genome.generation}
                </span>
                <strong style={{ color: genome.blackSwanEnabled ? '#F472B6' : '#E5E7EB' }}>
                  P{(genome.parentIds || []).length} M{genome.mutationEvents || 0} {genome.blackSwanEnabled ? '/ BLACK_SWAN' : ''}
                </strong>
              </div>
              <span style={{ color: '#9CA3AF' }}>
                Contexts: {formatContextMaskSummary(genome.contextMaskSummary)}
              </span>
              <span style={{ color: '#9CA3AF' }}>
                Budget {genome.expressionBudget || 0} / Dominance {genome.dominanceBias || 0} / Decay {genome.decayResistance || 0} / Reactivation {genome.reactivationBias || 0} / Copy avg {genome.averageCopyNumber || 0} / max {genome.maxCopyNumber || 0}
              </span>
            </div>
          ))}
        </div>
      )}

      {dnaLineage.recentArchives.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
          <strong style={{ color: '#FCA5A5', fontSize: '10px' }}>Recent DNA Archives</strong>
          {dnaLineage.recentArchives.map((archive) => (
            <div key={`${archive.memberId}-${archive.genomeId}-${archive.archivedAt}`} style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {archive.memberId} / {archive.genomeId} / {archive.archiveReason}
                </span>
                <strong style={{ color: archive.blackSwanEnabled ? '#F472B6' : '#E5E7EB' }}>
                  G{archive.generation} M{archive.mutationEvents || 0} {archive.blackSwanEnabled ? '/ BLACK_SWAN' : ''}
                </strong>
              </div>
              <span style={{ color: '#9CA3AF' }}>
                Contexts: {formatContextMaskSummary(archive.contextMaskSummary)}
              </span>
              <span style={{ color: '#9CA3AF' }}>
                Budget {archive.expressionBudget || 0} / Dominance {archive.dominanceBias || 0} / Decay {archive.decayResistance || 0} / Reactivation {archive.reactivationBias || 0} / Copy avg {archive.averageCopyNumber || 0} / max {archive.maxCopyNumber || 0}
              </span>
            </div>
          ))}
        </div>
      )}

      {activeStrategyGenes.length > 0 && typeof handleAidlGeneStateUpdate === 'function' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '6px' }}>
          <strong style={{ color: '#FBBF24', fontSize: '10px' }}>Admin Gene Override</strong>
          {activeStrategyGenes.map((gene) => (
            <div key={`${gene.memberId}:${gene.geneId}`} style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{gene.memberName} / {gene.geneId}</span>
                <strong style={{ color: gene.blackSwanEnabled ? '#F472B6' : '#E5E7EB' }}>{gene.state} / subgenes {gene.subgeneCount}</strong>
              </div>
              <span style={{ color: '#9CA3AF' }}>
                Contexts: {formatContextMaskSummary(gene.contextMaskSummary)}
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['A', 'I', 'D', 'L'].map((state) => {
                  const actionKey = `${gene.memberId}:${gene.geneId}:${state}`;
                  const disabled = state === gene.state || submittingAidlGeneState === actionKey;
                  return (
                    <button
                      key={state}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleAidlGeneStateUpdate(gene.memberId, gene.geneId, state)}
                      style={{
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '9px',
                        fontWeight: '800',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.5 : 1,
                        color: state === 'A' ? '#34D399' : state === 'I' ? '#CBD5E1' : state === 'D' ? '#FBBF24' : '#F87171',
                        background: 'rgba(0,0,0,0.18)',
                      }}
                    >
                      {submittingAidlGeneState === actionKey ? '...' : state}
                    </button>
                  );
                })}
              </div>
              {typeof handleAidlGeneContextUpdate === 'function' && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'BLACK_SWAN ON', enabled: true },
                    { label: 'BLACK_SWAN OFF', enabled: false },
                  ].map((item) => {
                    const actionKey = `${gene.memberId}:${gene.geneId}:BLACK_SWAN:${item.enabled ? 'ON' : 'OFF'}`;
                    const hasBlackSwan = gene.blackSwanEnabled === true;
                    const disabled = submittingAidlGeneContext === actionKey || (item.enabled ? hasBlackSwan : !hasBlackSwan);
                    return (
                      <button
                        key={item.label}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleAidlGeneContextUpdate(gene.memberId, gene.geneId, 'BLACK_SWAN', item.enabled)}
                        style={{
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '9px',
                          fontWeight: '800',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.5 : 1,
                          color: item.enabled ? '#F472B6' : '#CBD5E1',
                          background: 'rgba(0,0,0,0.18)',
                        }}
                      >
                        {submittingAidlGeneContext === actionKey ? '...' : item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {['BUY', 'SELL', 'HOLD'].map((decision) => {
        const item = decisions[decision] || { count: 0, accuracy: 0 };
        return (
          <Metric
            key={decision}
            label={`${decision} Validation`}
            value={`${item.accuracy || 0}% (${item.count || 0})`}
          />
        );
      })}

      {latest ? (
        <>
          <Metric label="Validation Score" value={`${latest.validationScore.toFixed(2)}%`} color="#60A5FA" />
          <Metric label="Holdout Score" value={`${latest.holdoutScore.toFixed(2)}%`} color="#34D399" />
          <Metric label="HOLD Benchmark" value={`${latest.benchmarkScore.toFixed(2)}%`} />
          <Metric label="Generation / Status" value={`G${latest.generation} / ${latest.status}`} />
          <div style={{ color: latest.promotionEligible ? '#34D399' : '#FBBF24', lineHeight: '1.5' }}>
            {latest.promotionEligible
              ? 'Promotion gate passed. Live engine change still requires explicit admin confirmation.'
              : `Promotion held: ${(latest.promotionReasons || []).map((reason) => reasonLabels[reason] || reason).join(', ') || 'validation running'}`}
          </div>
        </>
      ) : (
        <div style={{ color: '#FBBF24' }}>
          No completed challenger validation record is available yet.
        </div>
      )}

      {(stats?.invalid || 0) > 0 && (
        <div style={{ color: '#F87171', lineHeight: '1.5' }}>
          {stats.invalid} legacy instant-scored rows remain excluded from training until they are repaired.
        </div>
      )}
    </div>
  );
}
