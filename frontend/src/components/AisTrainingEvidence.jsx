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

export default function AisTrainingEvidence({ stats }) {
  const latest = stats?.latestRun;
  const decisions = stats?.byDecision || {};

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
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <strong style={{ color: '#C4B5FD' }}>Shadow Challenger 검증</strong>
        <span style={{
          color: '#FBBF24',
          background: 'rgba(245,158,11,0.12)',
          borderRadius: '6px',
          padding: '2px 6px',
          fontWeight: '800'
        }}>
          자동 실전 승격 OFF
        </span>
      </div>

      <Metric label="라벨 상태" value={`유효 ${stats?.labeled || 0} / 대기 ${stats?.pending || 0} / 무효 ${stats?.invalid || 0}`} />
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
