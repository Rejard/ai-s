import React from 'react';

import { extractAidlAdminGenes } from '../lib/aidlAdminGenes.js';

const reasonLabels = {
  MIN_LABELED_OBSERVATIONS: '정상 분류 데이터 300건 미만',
  LABEL_INTEGRITY_FAILURE: '무효 데이터 잔존',
  MIN_BENCHMARK_MARGIN: '대비 마진 3%p 미만',
  MIN_CLASS_COVERAGE: '매수/매도/관망 다양성 분포 부족',
  INVALID_PROMOTION_METADATA: '승격 메타데이터 결함',
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

function formatGeneCounts(geneCounts = {}) {
  const entries = Object.entries(geneCounts).filter(([, count]) => Number(count) > 0);
  if (!entries.length) {
    return 'none';
  }
  return entries.map(([geneId, count]) => `${geneId} ${count}`).join(', ');
}

function formatTimelineRuns(runs = []) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return 'none';
  }
  return runs.map((run) => `${run.runKey} V${run.averageValidationScore} H${run.averageHoldoutScore} G${run.genomeCount}`).join(', ');
}

function formatOverrideSnapshot(snapshot = {}) {
  return `N ${snapshot.overrideCount || 0} / Pre V ${snapshot.preAverageValidationScore || 0} H ${snapshot.preAverageHoldoutScore || 0} / Post V ${snapshot.postAverageValidationScore || 0} H ${snapshot.postAverageHoldoutScore || 0}`;
}

function formatOverrideCoverage(coverage = {}) {
  return `Total ${coverage.totalOverrideCount || 0} / Snapshot ${coverage.snapshotComparableCount || 0} / Timeline ${coverage.timelineComparableCount || 0}`;
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
  const dnaAdminOverrideTelemetry = stats?.dnaAdminOverrideTelemetry || {
    stateOverrideCount: 0,
    contextOverrideCount: 0,
    recentEvent: null,
    targetGeneCounts: {},
  };
  const dnaAdminOverrideOutcome = stats?.dnaAdminOverrideOutcome || {
    stateOverrideActive: { genomeCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0 },
    contextOverrideActive: { genomeCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0 },
    stateOverrideArchive: { archiveCount: 0, lowPerformanceCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0 },
    contextOverrideArchive: { archiveCount: 0, lowPerformanceCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0 },
  };
  const dnaAdminOverrideDelta = stats?.dnaAdminOverrideDelta || {
    stateOverrideDelta: { overrideCount: 0, averageValidationDelta: 0, averageHoldoutDelta: 0 },
    contextOverrideDelta: { overrideCount: 0, averageValidationDelta: 0, averageHoldoutDelta: 0 },
  };
  const dnaAdminOverrideSnapshot = stats?.dnaAdminOverrideSnapshot || {
    stateOverride: {
      overrideCount: 0,
      preAverageValidationScore: 0,
      preAverageHoldoutScore: 0,
      postAverageValidationScore: 0,
      postAverageHoldoutScore: 0,
    },
    contextOverride: {
      overrideCount: 0,
      preAverageValidationScore: 0,
      preAverageHoldoutScore: 0,
      postAverageValidationScore: 0,
      postAverageHoldoutScore: 0,
    },
  };
  const dnaAdminOverrideCoverage = stats?.dnaAdminOverrideCoverage || {
    stateOverride: {
      totalOverrideCount: 0,
      snapshotComparableCount: 0,
      timelineComparableCount: 0,
    },
    contextOverride: {
      totalOverrideCount: 0,
      snapshotComparableCount: 0,
      timelineComparableCount: 0,
    },
  };
  const dnaOverrideLineageAttribution = stats?.dnaOverrideLineageAttribution || {
    activeInheritedStateCount: 0,
    activeInheritedContextCount: 0,
    archivedInheritedStateCount: 0,
    archivedInheritedContextCount: 0,
  };
  const dnaAdminOverrideTimeline = stats?.dnaAdminOverrideTimeline || {
    stateOverrideRuns: [],
    contextOverrideRuns: [],
  };
  const dnaLineage = stats?.dnaLineage || { activeGenomes: [], recentArchives: [] };
  const activeStrategyGenes = extractAidlAdminGenes(councilStats?.activeMembers || []);
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
      {latest && latest.status === 'FAILED' && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '8px',
          padding: '10px',
          color: '#FCA5A5',
          fontSize: '11px',
          lineHeight: '1.4',
          marginBottom: '8px'
        }}>
          <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span>⚠️</span> AI 자동 학습 실행 실패 감지!
          </div>
          <div>
            <strong>최근 실행:</strong> {latest.runKey} ({latest.completedAt || latest.createdAt})
          </div>
          <div style={{
            background: 'rgba(0,0,0,0.4)',
            padding: '6px',
            borderRadius: '4px',
            marginTop: '4px',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            fontSize: '9px',
            color: '#FEE2E2'
          }}>
            {latest.errorMessage || '알 수 없는 실행 에러'}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <strong style={{ color: '#C4B5FD' }}>관망 후보군 AI 검증</strong>

        {!isEngineEligible ? (
          <button
            type="button"
            disabled
            title="자동 승격은 HYBRID_COOP 또는 AIS_ONLY 모드에서만 사용 가능합니다."
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
            자동 승격 OFF (엔진 제한됨)
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleAutomaticPromotion}
            title={isPromoEnabled ? '자동 승격 비활성화' : '자동 승격 활성화'}
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
            <span>자동 승격 {isPromoEnabled ? 'ON(켜짐)' : 'OFF(꺼짐)'}</span>
          </button>
        )}
      </div>

      <Metric label="데이터 분류 상태" value={`정상 라벨링 ${stats?.labeled || 0} / 채점 대기 ${stats?.pending || 0} / 무효 데이터 ${stats?.invalid || 0}`} />
      <Metric
        label="DNA 상태 정보"
        value={`A (활성) ${dnaStateTotals.active || 0} / I (비활성) ${dnaStateTotals.inactive || 0} / D (노후) ${dnaStateTotals.deprecated || 0} / L (치명) ${dnaStateTotals.lethal || 0}`}
        color={stats?.dnaStateTotalsAvailable === false ? '#FBBF24' : '#C4B5FD'}
      />
      <Metric
        label="DNA 누적 변이 건수"
        value={`노드 변이 ${dnaMutationTotals.stateMutation || 0} / 상황 변이 ${dnaMutationTotals.contextMaskMutation || 0} / 특성 변이 ${dnaMutationTotals.profileMutation || 0} / 복제수 변이 ${dnaMutationTotals.copyNumberMutation || 0} / 가중치 조정 ${dnaMutationTotals.weightNudge || 0} / VEP 필터 차단 ${dnaMutationTotals.vepFiltered || 0}`}
        color="#93C5FD"
      />
      <Metric
        label="상황별 변이 분석"
        value={`블랙스완 추가 +${dnaMutationTotals.contextMutationDetail?.blackSwanAdded || 0} / 블랙스완 제거 -${dnaMutationTotals.contextMutationDetail?.blackSwanRemoved || 0} / 일반 추가 +${dnaMutationTotals.contextMutationDetail?.coreAdded || 0} / 일반 제거 -${dnaMutationTotals.contextMutationDetail?.coreRemoved || 0}`}
        color="#93C5FD"
      />
      <Metric
        label="생체 특성별 변이 분석"
        value={`의결예산 ${dnaMutationTotals.profileMutationByKey?.expressionBudget || 0} / 지배성향 ${dnaMutationTotals.profileMutationByKey?.dominanceBias || 0} / 망각저항 ${dnaMutationTotals.profileMutationByKey?.decayResistance || 0} / 재활성편향 ${dnaMutationTotals.profileMutationByKey?.reactivationBias || 0}`}
        color="#93C5FD"
      />
      <Metric
        label="유전자 복제수 변이 방향"
        value={`증가 ${dnaMutationTotals.copyNumberDirection?.up || 0} / 감소 ${dnaMutationTotals.copyNumberDirection?.down || 0} / 보존 ${dnaMutationTotals.copyNumberDirection?.flat || 0}`}
        color="#93C5FD"
      />
      <Metric
        label="블랙스완 유전자 추적"
        value={`보유 유전자 ${dnaContextSummary.blackSwanStrategyGenes || 0} / 활성 개체 ${dnaContextSummary.blackSwanActiveGenomes || 0} / 은퇴 개체 ${dnaContextSummary.blackSwanArchivedGenomes || 0}`}
        color="#F472B6"
      />
      <Metric
        label="활성 의원 분석 성능"
        value={`개체수 ${dnaContextPerformance.blackSwanActive?.genomeCount || 0} / V ${dnaContextPerformance.blackSwanActive?.averageLatestValidationScore || 0}% / H ${dnaContextPerformance.blackSwanActive?.averageLatestHoldoutScore || 0}% / 변이 ${dnaContextPerformance.blackSwanActive?.averageMutationEvents || 0}회 | 일반 개체수 ${dnaContextPerformance.coreActive?.genomeCount || 0} / V ${dnaContextPerformance.coreActive?.averageLatestValidationScore || 0}% / H ${dnaContextPerformance.coreActive?.averageLatestHoldoutScore || 0}% / 변이 ${dnaContextPerformance.coreActive?.averageMutationEvents || 0}회`}
        color="#F472B6"
      />
      <Metric
        label="은퇴 의원 분석 성능"
        value={`개체수 ${dnaContextPerformance.blackSwanArchive?.archiveCount || 0} / G ${dnaContextPerformance.blackSwanArchive?.averageGeneration || 0}세대 / 성능미달 ${dnaContextPerformance.blackSwanArchive?.lowPerformanceCount || 0} / VEP오류 ${dnaContextPerformance.blackSwanArchive?.vepFilteredCount || 0} | 일반 개체수 ${dnaContextPerformance.coreArchive?.archiveCount || 0} / G ${dnaContextPerformance.coreArchive?.averageGeneration || 0}세대 / 성능미달 ${dnaContextPerformance.coreArchive?.lowPerformanceCount || 0} / VEP오류 ${dnaContextPerformance.coreArchive?.vepFilteredCount || 0}`}
        color="#F472B6"
      />
      <Metric
        label="활성 변이 경로 분석"
        value={`블랙스완 VEP차단 ${dnaContextPathway.blackSwanActive?.vepFilteredGenomes || 0} / 최근변이 [${formatEventCounts(dnaContextPathway.blackSwanActive?.lastMutationEventCounts)}] | 일반 VEP차단 ${dnaContextPathway.coreActive?.vepFilteredGenomes || 0} / 최근변이 [${formatEventCounts(dnaContextPathway.coreActive?.lastMutationEventCounts)}]`}
        color="#F472B6"
      />
      <Metric
        label="은퇴 변이 경로 분석"
        value={`블랙스완 성능미달 ${dnaContextPathway.blackSwanArchive?.lowPerformanceCount || 0} / VEP차단 ${dnaContextPathway.blackSwanArchive?.vepFilteredCount || 0} / 최근변이 [${formatEventCounts(dnaContextPathway.blackSwanArchive?.lastMutationEventCounts)}] | 일반 성능미달 ${dnaContextPathway.coreArchive?.lowPerformanceCount || 0} / VEP차단 ${dnaContextPathway.coreArchive?.vepFilteredCount || 0} / 최근변이 [${formatEventCounts(dnaContextPathway.coreArchive?.lastMutationEventCounts)}]`}
        color="#F472B6"
      />
      <Metric
        label="관리자 강제 변경 이력"
        value={`노드개입 ${dnaAdminOverrideTelemetry.stateOverrideCount || 0}회 / 상황개입 ${dnaAdminOverrideTelemetry.contextOverrideCount || 0}회 / 최근사건: ${dnaAdminOverrideTelemetry.recentEvent?.event || '없음'} ${dnaAdminOverrideTelemetry.recentEvent?.geneId || ''} ${dnaAdminOverrideTelemetry.recentEvent?.action || ''}`.trim()}
        color="#FBBF24"
      />
      <Metric
        label="강제 개입 유전자 수"
        value={formatGeneCounts(dnaAdminOverrideTelemetry.targetGeneCounts)}
        color="#FBBF24"
      />
      <Metric
        label="개입된 활성 의원 성능"
        value={`상태 개입 ${dnaAdminOverrideOutcome.stateOverrideActive?.genomeCount || 0}개체 / V ${dnaAdminOverrideOutcome.stateOverrideActive?.averageLatestValidationScore || 0}% / H ${dnaAdminOverrideOutcome.stateOverrideActive?.averageLatestHoldoutScore || 0}% | 상황 개입 ${dnaAdminOverrideOutcome.contextOverrideActive?.genomeCount || 0}개체 / V ${dnaAdminOverrideOutcome.contextOverrideActive?.averageLatestValidationScore || 0}% / H ${dnaAdminOverrideOutcome.contextOverrideActive?.averageLatestHoldoutScore || 0}%`}
        color="#FBBF24"
      />
      <Metric
        label="개입된 은퇴 의원 성능"
        value={`상태 개입 ${dnaAdminOverrideOutcome.stateOverrideArchive?.archiveCount || 0}개체 / 성능미달 ${dnaAdminOverrideOutcome.stateOverrideArchive?.lowPerformanceCount || 0} / V ${dnaAdminOverrideOutcome.stateOverrideArchive?.averageLatestValidationScore || 0}% / H ${dnaAdminOverrideOutcome.stateOverrideArchive?.averageLatestHoldoutScore || 0}% | 상황 개입 ${dnaAdminOverrideOutcome.contextOverrideArchive?.archiveCount || 0}개체 / 성능미달 ${dnaAdminOverrideOutcome.contextOverrideArchive?.lowPerformanceCount || 0} / V ${dnaAdminOverrideOutcome.contextOverrideArchive?.averageLatestValidationScore || 0}% / H ${dnaAdminOverrideOutcome.contextOverrideArchive?.averageLatestHoldoutScore || 0}%`}
        color="#FBBF24"
      />
      <Metric
        label="개입 전후 성능 스냅샷"
        value={`상태 개입 [${formatOverrideSnapshot(dnaAdminOverrideSnapshot.stateOverride)}] | 상황 개입 [${formatOverrideSnapshot(dnaAdminOverrideSnapshot.contextOverride)}]`}
        color="#FBBF24"
      />
      <Metric
        label="개입 추적 커버리지"
        value={`상태 개입 [${formatOverrideCoverage(dnaAdminOverrideCoverage.stateOverride)}] | 상황 개입 [${formatOverrideCoverage(dnaAdminOverrideCoverage.contextOverride)}]`}
        color="#FBBF24"
      />
      <Metric
        label="개입 후 성능 변화량"
        value={`상태 개입 ${dnaAdminOverrideDelta.stateOverrideDelta?.overrideCount || 0}건 / dV ${dnaAdminOverrideDelta.stateOverrideDelta?.averageValidationDelta || 0}% / dH ${dnaAdminOverrideDelta.stateOverrideDelta?.averageHoldoutDelta || 0}% | 상황 개입 ${dnaAdminOverrideDelta.contextOverrideDelta?.overrideCount || 0}건 / dV ${dnaAdminOverrideDelta.contextOverrideDelta?.averageValidationDelta || 0}% / dH ${dnaAdminOverrideDelta.contextOverrideDelta?.averageHoldoutDelta || 0}%`}
        color="#FBBF24"
      />
      <Metric
        label="유전적 승계 지분율"
        value={`활성 상태승계 ${dnaOverrideLineageAttribution.activeInheritedStateCount || 0} / 상황승계 ${dnaOverrideLineageAttribution.activeInheritedContextCount || 0} | 은퇴 상태승계 ${dnaOverrideLineageAttribution.archivedInheritedStateCount || 0} / 상황승계 ${dnaOverrideLineageAttribution.archivedInheritedContextCount || 0}`}
        color="#FBBF24"
      />
      <Metric
        label="개입 누적 런(Run) 이력"
        value={`상태 개입 [${formatTimelineRuns(dnaAdminOverrideTimeline.stateOverrideRuns)}] | 상황 개입 [${formatTimelineRuns(dnaAdminOverrideTimeline.contextOverrideRuns)}]`}
        color="#FBBF24"
      />
      <Metric
        label="자연 선택 결과 (1회 학습)"
        value={`도태 ${selectionTelemetry.culledCount || 0} / 자손 ${selectionTelemetry.offspringCount || 0} / 돌연변이 ${selectionTelemetry.mutantCount || 0} / 은퇴 보존 ${selectionTelemetry.archiveCount || 0}`}
        color="#FCA5A5"
      />
      <Metric
        label="실시간 유전 변이 정책"
        value={`상황변이 ${runtimePolicy.contextMutationRate} / 노드변이 ${runtimePolicy.stateMutationRate} / 특성변이 ${runtimePolicy.profileMutationRate} / 복제변이 ${runtimePolicy.copyNumberMutationRate} / 가중미세조정 ${runtimePolicy.weightNudgeSize}`}
        color="#86EFAC"
      />
      <Metric
        label="DNA 유전 라이브러리 운영"
        value={`은퇴개체수 ${dnaOperations.archiveCount || 0} / 피트니스 히스토리 깊이 ${dnaOperations.averageFitnessHistoryDepth || 0} / 최근 은퇴시각 ${dnaOperations.latestArchivedAt || '-'}`}
        color="#FDE68A"
      />
      <Metric
        label="결함 유전자 실시간 복구"
        value={`복제수오류 복구 ${dnaRepairTelemetry.accessionRepairCount || 0} / 상황오류 복구 ${dnaRepairTelemetry.contextMaskRepairCount || 0} / 특성오류 복구 ${dnaRepairTelemetry.profileRepairCount || 0} / 최근 복구시각 ${dnaRepairTelemetry.lastRepairedAt || '-'}`}
        color="#FDBA74"
      />

      {dnaLineage.activeGenomes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
          <strong style={{ color: '#93C5FD', fontSize: '10px' }}>실시간 활성 DNA 가계도</strong>
          {dnaLineage.activeGenomes.map((genome) => (
            <div key={`${genome.memberId}-${genome.genomeId}`} style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {genome.name || genome.memberId} / {genome.genomeId} / G{genome.generation}세대
                </span>
                <strong style={{ color: genome.blackSwanEnabled ? '#F472B6' : '#E5E7EB' }}>
                  부모 P{(genome.parentIds || []).length} 변이 M{genome.mutationEvents || 0} {genome.blackSwanEnabled ? '/ 블랙스완 작동' : ''}{genome.inheritedStateOverride ? ' / 상태개입 승계' : ''}{genome.inheritedContextOverride ? ' / 상황개입 승계' : ''}
                </strong>
              </div>
              <span style={{ color: '#9CA3AF' }}>
                활성 상황 마스크: {formatContextMaskSummary(genome.contextMaskSummary)}
              </span>
              <span style={{ color: '#9CA3AF' }}>
                의결예산 {genome.expressionBudget || 0} / 지배성향 {genome.dominanceBias || 0} / 망각저항 {genome.decayResistance || 0} / 재활성편향 {genome.reactivationBias || 0} / 복제수 평균 {genome.averageCopyNumber || 0} / 최대 {genome.maxCopyNumber || 0}
              </span>
            </div>
          ))}
        </div>
      )}

      {dnaLineage.recentArchives.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
          <strong style={{ color: '#FCA5A5', fontSize: '10px' }}>최근 은퇴 DNA 아카이브</strong>
          {dnaLineage.recentArchives.map((archive) => (
            <div key={`${archive.memberId}-${archive.genomeId}-${archive.archivedAt}`} style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {archive.memberId} / {archive.genomeId} / {archive.archiveReason === 'CULLED_LOW_PERFORMANCE' ? '저성능 자연도태' : archive.archiveReason}
                </span>
                <strong style={{ color: archive.blackSwanEnabled ? '#F472B6' : '#E5E7EB' }}>
                  G{archive.generation}세대 변이 M{archive.mutationEvents || 0} {archive.blackSwanEnabled ? '/ 블랙스완 작동' : ''}{archive.inheritedStateOverride ? ' / 상태개입 승계' : ''}{archive.inheritedContextOverride ? ' / 상황개입 승계' : ''}
                </strong>
              </div>
              <span style={{ color: '#9CA3AF' }}>
                활성 상황 마스크: {formatContextMaskSummary(archive.contextMaskSummary)}
              </span>
              <span style={{ color: '#9CA3AF' }}>
                의결예산 {archive.expressionBudget || 0} / 지배성향 {archive.dominanceBias || 0} / 망각저항 {archive.decayResistance || 0} / 재활성편향 {archive.reactivationBias || 0} / 복제수 평균 {archive.averageCopyNumber || 0} / 최대 {archive.maxCopyNumber || 0}
              </span>
            </div>
          ))}
        </div>
      )}

      {activeStrategyGenes.length > 0 && typeof handleAidlGeneStateUpdate === 'function' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '6px' }}>
          <strong style={{ color: '#FBBF24', fontSize: '10px' }}>관리자 강제 변경 유전자 제어</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px', scrollbarWidth: 'thin' }}>
            {activeStrategyGenes.map((gene) => (
              <div key={`${gene.memberId}:${gene.geneId}`} style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                    {gene.memberName} / {gene.geneId}{gene.geneScope === 'subgene' ? ` / 부모유전자 ${gene.parentGeneId}` : ''}
                  </span>
                  <strong style={{ color: gene.blackSwanEnabled ? '#F472B6' : '#E5E7EB', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    상태: {gene.state === 'A' ? '활성(A)' : gene.state === 'I' ? '비활성(I)' : gene.state === 'D' ? '노후(D)' : '치명(L)'} / {gene.geneScope === 'subgene' ? '하위유전자' : `하위유전자수 ${gene.subgeneCount}`}
                  </strong>
                </div>
                <span style={{ color: '#9CA3AF' }}>
                  허용 상황 범위: {formatContextMaskSummary(gene.contextMaskSummary)}
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['A', 'I', 'D', 'L'].map((state) => {
                    const actionKey = `${gene.memberId}:${gene.geneId}:${state}`;
                    const disabled = state === gene.state || submittingAidlGeneState === actionKey;
                    const stateLabel = state === 'A' ? 'A (활성)' : state === 'I' ? 'I (비활성)' : state === 'D' ? 'D (노후)' : 'L (치명)';
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
                        {submittingAidlGeneState === actionKey ? '...' : stateLabel}
                      </button>
                    );
                  })}
                </div>
                {gene.contextOverrideEligible && typeof handleAidlGeneContextUpdate === 'function' && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { label: '블랙스완 허용 활성화 (BLACK_SWAN ON)', enabled: true },
                      { label: '블랙스완 허용 차단 (BLACK_SWAN OFF)', enabled: false },
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
        </div>
      )}


      {['BUY', 'SELL', 'HOLD'].map((decision) => {
        const item = decisions[decision] || { count: 0, accuracy: 0 };
        const decisionLabel = decision === 'BUY' ? '매수 (BUY)' : decision === 'SELL' ? '매도 (SELL)' : '관망 (HOLD)';
        return (
          <Metric
            key={decision}
            label={`${decisionLabel} 의정 검증 정확도`}
            value={`${item.accuracy || 0}% (${item.count || 0}건)`}
          />
        );
      })}

      {latest ? (
        <>
          <Metric label="검증 데이터셋 정확도" value={`${latest.validationScore.toFixed(2)}%`} color="#60A5FA" />
          <Metric label="홀드아웃 데이터셋 정확도" value={`${latest.holdoutScore.toFixed(2)}%`} color="#34D399" />
          <Metric label="관망(HOLD) 기준 수익비율" value={`${latest.benchmarkScore.toFixed(2)}%`} />
          <Metric label="의회 세대 / 엔진 상태" value={`G${latest.generation}세대 / ${latest.status === 'SHADOW_CHALLENGER' ? '후보군 검증완료' : latest.status}`} />
          <div style={{ color: latest.promotionEligible ? '#34D399' : '#FBBF24', lineHeight: '1.5' }}>
            {latest.promotionEligible
              ? '의회 승격 기준 통과. 실제 가동 엔진을 바꾸려면 관리자 페이지 상단에서 수동으로 모드를 변경하셔야 합니다.'
              : `승격 보류 사유: ${(latest.promotionReasons || []).map((reason) => reasonLabels[reason] || reason).join(', ') || '검증 연산 실행 중'}`}
          </div>
        </>
      ) : (
        <div style={{ color: '#FBBF24' }}>
          진행 완료된 신규 의회 검증 이력이 아직 존재하지 않습니다.
        </div>
      )}

      {(stats?.invalid || 0) > 0 && (
        <div style={{ color: '#F87171', lineHeight: '1.5' }}>
          {stats.invalid}건의 이전 즉시채점(구버전) 데이터는 결함이 복구되기 전까지 기계 학습 과정에서 자동 제외됩니다.
        </div>
      )}
    </div>
  );
}
