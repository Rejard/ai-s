import React from 'react';

const reasonLabels = {
  MIN_LABELED_OBSERVATIONS: '유효 라벨 300건 미만',
  LABEL_INTEGRITY_FAILURE: '현재 라벨 무결성 오류',
  MIN_BENCHMARK_MARGIN: '벤치마크 대비 3%p 개선 미달',
  MIN_CLASS_COVERAGE: 'BUY/SELL/HOLD 표본 부족',
  INVALID_PROMOTION_METADATA: '승격 메타데이터 오류',
};

function Metric({ label, value, color = '#F3F4F6' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}

export default function AisTrainingEvidence({ stats, globalAiEngine, handleToggleAutomaticPromotion, aidlPolicy }) {
  const latest = stats?.latestRun;
  const decisions = stats?.byDecision || {};
  const dnaStateTotals = stats?.dnaStateTotals || { active: 0, inactive: 0, deprecated: 0, lethal: 0 };
  const dnaMutationTotals = stats?.dnaMutationTotals || { stateMutation: 0, contextMaskMutation: 0, weightNudge: 0, vepFiltered: 0 };
  const selectionTelemetry = stats?.selectionTelemetry || { culledCount: 0, offspringCount: 0, mutantCount: 0, archiveCount: 0 };
  const dnaOperations = stats?.dnaOperations || { archiveCount: 0, averageFitnessHistoryDepth: 0, latestArchivedAt: '' };
  const runtimePolicy = aidlPolicy || { contextMutationRate: '0.10', stateMutationRate: '0.10', weightNudgeSize: '0.02' };
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
      color: 'var(--text-muted)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <strong style={{ color: '#C4B5FD' }}>Shadow Challenger 검증</strong>
        
        {!isEngineEligible ? (
          <button
            type="button"
            disabled
            title="작동 엔진이 [공동 합의] 또는 [AiS 독자] 모드일 때만 자동 승격을 활성화할 수 있습니다."
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
              transition: 'all 0.2s'
            }}
          >
            자동 실전 승격 OFF (엔진 모드 제한)
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleAutomaticPromotion}
            title={isPromoEnabled ? "클릭 시 자동 승격 비활성화" : "클릭 시 자동 승격 활성화"}
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
              gap: '4px'
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
            <span>자동 실전 승격 {isPromoEnabled ? 'ON 🟢' : 'OFF 🟡'}</span>
          </button>
        )}
      </div>

      <Metric label="라벨 상태" value={`유효 ${stats?.labeled || 0} / 대기 ${stats?.pending || 0} / 무효 ${stats?.invalid || 0}`} />
      <Metric
        label="DNA 상태"
        value={`A ${dnaStateTotals.active || 0} / I ${dnaStateTotals.inactive || 0} / D ${dnaStateTotals.deprecated || 0} / L ${dnaStateTotals.lethal || 0}`}
        color={stats?.dnaStateTotalsAvailable === false ? '#FBBF24' : '#C4B5FD'}
      />
      <Metric
        label="DNA Mutation"
        value={`State ${dnaMutationTotals.stateMutation || 0} / Context ${dnaMutationTotals.contextMaskMutation || 0} / Nudge ${dnaMutationTotals.weightNudge || 0} / VEP ${dnaMutationTotals.vepFiltered || 0}`}
        color="#93C5FD"
      />
      <Metric
        label="Selection"
        value={`Cull ${selectionTelemetry.culledCount || 0} / Offspring ${selectionTelemetry.offspringCount || 0} / Mutant ${selectionTelemetry.mutantCount || 0} / Archive ${selectionTelemetry.archiveCount || 0}`}
        color="#FCA5A5"
      />
      <Metric
        label="Runtime Policy"
        value={`Context ${runtimePolicy.contextMutationRate} / State ${runtimePolicy.stateMutationRate} / Nudge ${runtimePolicy.weightNudgeSize}`}
        color="#86EFAC"
      />
      <Metric
        label="DNA Ops"
        value={`Archive ${dnaOperations.archiveCount || 0} / History ${dnaOperations.averageFitnessHistoryDepth || 0} / Latest ${dnaOperations.latestArchivedAt || '-'}`}
        color="#FDE68A"
      />
      {['BUY', 'SELL', 'HOLD'].map((decision) => {
        const item = decisions[decision] || { count: 0, accuracy: 0 };
        return (
          <Metric
            key={decision}
            label={`${decision} 검증`}
            value={`${item.accuracy || 0}% (${item.count || 0}건)`}
          />
        );
      })}

      {latest ? (
        <>
          <Metric label="검증 점수" value={`${latest.validationScore.toFixed(2)}%`} color="#60A5FA" />
          <Metric label="홀드아웃 점수" value={`${latest.holdoutScore.toFixed(2)}%`} color="#34D399" />
          <Metric label="HOLD 벤치마크" value={`${latest.benchmarkScore.toFixed(2)}%`} />
          <Metric label="세대 / 상태" value={`${latest.generation}세대 / ${latest.status}`} />
          <div style={{ color: latest.promotionEligible ? '#34D399' : '#FBBF24', lineHeight: '1.5' }}>
            {latest.promotionEligible
              ? '승격 기준 충족. 실제 엔진 변경은 어드민 수동 승인만 가능합니다.'
              : `승격 보류: ${(latest.promotionReasons || []).map(
                (reason) => reasonLabels[reason] || reason
              ).join(', ') || '검증 진행 중'}`}
          </div>
        </>
      ) : (
        <div style={{ color: '#FBBF24' }}>
          아직 시간순 검증을 완료한 Challenger 실행 기록이 없습니다.
        </div>
      )}

      {(stats?.invalid || 0) > 0 && (
        <div style={{ color: '#F87171', lineHeight: '1.5' }}>
          기존 즉시 채점 데이터 {stats.invalid}건은 학습에서 제외되어 보존 중입니다.
        </div>
      )}
    </div>
  );
}
