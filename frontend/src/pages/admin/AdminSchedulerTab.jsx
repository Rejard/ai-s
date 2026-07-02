import React, { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const STATUS_CONFIG = {
  ALIVE:     { dot: '🟢', color: '#10B981', label: '정상 가동' },
  WARNING:   { dot: '🟡', color: '#F59E0B', label: '주의 필요' },
  OVERDUE:   { dot: '🔴', color: '#EF4444', label: '지연/이상' },
  NEVER_RUN: { dot: '⚪', color: '#9CA3AF', label: '미실행' },
  DORMANT:   { dot: '🔵', color: '#60A5FA', label: '대기(휴면)' }
};

const TYPE_BADGE_COLORS = {
  timer:       { bg: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', border: 'rgba(139, 92, 246, 0.3)' },
  conditional: { bg: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24', border: 'rgba(245, 158, 11, 0.3)' },
  event:       { bg: 'rgba(96, 165, 250, 0.15)', color: '#93C5FD', border: 'rgba(96, 165, 250, 0.3)' }
};

const TYPE_LABELS = {
  timer: '자동 반복',
  conditional: '조건 실행',
  event: '요청 실행'
};

function formatRelativeTime(epochMs) {
  if (!epochMs) return 'N/A';
  const now = Date.now();
  const diffMs = now - epochMs;
  const absDiffMs = Math.abs(diffMs);
  const suffix = diffMs >= 0 ? '전' : '후';

  if (absDiffMs < 60000) return `${Math.floor(absDiffMs / 1000)}초 ${suffix}`;
  if (absDiffMs < 3600000) return `${Math.floor(absDiffMs / 60000)}분 ${suffix}`;
  if (absDiffMs < 86400000) return `${Math.floor(absDiffMs / 3600000)}시간 ${suffix}`;
  return `${Math.floor(absDiffMs / 86400000)}일 ${suffix}`;
}

function SchedulerCard({ scheduler }) {
  const statusCfg = STATUS_CONFIG[scheduler.status] || STATUS_CONFIG.NEVER_RUN;
  const typeBadge = TYPE_BADGE_COLORS[scheduler.type] || TYPE_BADGE_COLORS.timer;
  const hasConsecutiveFails = scheduler.consecutiveFails > 0;

  return (
    <div style={{
      background: 'rgba(9, 6, 22, 0.45)',
      border: `1px solid ${hasConsecutiveFails ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.12)'}`,
      borderRadius: '14px',
      padding: '16px',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
      transition: 'border-color 0.2s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>{statusCfg.dot}</span>
          <span style={{ fontSize: '12px', color: '#FFF', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {scheduler.name}
          </span>
        </div>
        <span style={{
          fontSize: '8px',
          fontWeight: '800',
          color: statusCfg.color,
          background: `${statusCfg.color}15`,
          border: `1px solid ${statusCfg.color}30`,
          padding: '2px 7px',
          borderRadius: '4px',
          flexShrink: 0,
          letterSpacing: '0.3px'
        }}>
          {statusCfg.label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
        <span style={{
          fontSize: '8px',
          fontWeight: '700',
          color: typeBadge.color,
          background: typeBadge.bg,
          border: `1px solid ${typeBadge.border}`,
          padding: '2px 6px',
          borderRadius: '4px'
        }}>
          {TYPE_LABELS[scheduler.type] || scheduler.type}
        </span>
        {scheduler.intervalDesc && (
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
            {scheduler.intervalDesc}
          </span>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '8px',
        padding: '10px'
      }}>
        <div>
          <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: '600' }}>마지막 실행</div>
          <div style={{ fontSize: '11px', color: '#E4E4E7', fontWeight: '700' }}>
            {formatRelativeTime(scheduler.lastRunAt)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: '600' }}>다음 예상</div>
          <div style={{ fontSize: '11px', color: '#E4E4E7', fontWeight: '700' }}>
            {formatRelativeTime(scheduler.nextExpectedAt)}
          </div>
        </div>
      </div>

      {(scheduler.successCount != null || scheduler.failCount != null) && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '10px' }}>
          {scheduler.successCount != null && (
            <span style={{ color: '#10B981', fontWeight: '700' }}>
              ✓ 성공 {scheduler.successCount.toLocaleString()}회
            </span>
          )}
          {scheduler.failCount != null && (
            <span style={{ color: scheduler.failCount > 0 ? '#EF4444' : 'var(--text-muted)', fontWeight: '700' }}>
              ✗ 실패 {scheduler.failCount.toLocaleString()}회
            </span>
          )}
        </div>
      )}

      {hasConsecutiveFails && (
        <div style={{
          marginTop: '10px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '6px',
          padding: '6px 10px',
          fontSize: '9px',
          color: '#FCA5A5',
          fontWeight: '700'
        }}>
          ⚠️ 연속 실패 {scheduler.consecutiveFails}회
        </div>
      )}

      {scheduler.isOverdue && scheduler.overdueMinutes > 0 && (
        <div style={{
          marginTop: hasConsecutiveFails ? '6px' : '10px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '6px',
          padding: '6px 10px',
          fontSize: '9px',
          color: '#F87171',
          fontWeight: '700'
        }}>
          🔴 {scheduler.overdueMinutes}분 지연 중
        </div>
      )}

      {scheduler.details && (
        <div style={{
          marginTop: '10px',
          fontSize: '9px',
          color: 'var(--text-muted)',
          lineHeight: '1.4',
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          paddingTop: '8px'
        }}>
          {scheduler.details}
        </div>
      )}
    </div>
  );
}

function AdminSchedulerTab({ schedulerData, loadingScheduler, fetchSchedulerHealth }) {
  useEffect(() => {
    fetchSchedulerHealth();
  }, []);

  if (loadingScheduler) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="glass-card" style={{
          padding: '40px 20px',
          background: 'rgba(9, 6, 22, 0.45)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px',
          backdropFilter: 'blur(8px)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
            ⏳ 스케줄러 상태를 불러오는 중...
          </div>
        </div>
      </div>
    );
  }

  if (!schedulerData || !schedulerData.schedulers) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="glass-card" style={{
          padding: '40px 20px',
          background: 'rgba(9, 6, 22, 0.45)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px',
          backdropFilter: 'blur(8px)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            스케줄러 데이터가 아직 로드되지 않았습니다.
          </div>
          <button
            type="button"
            onClick={fetchSchedulerHealth}
            style={{
              padding: '8px 16px',
              fontSize: '11px',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              color: '#FFF',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 0 10px rgba(139, 92, 246, 0.3)'
            }}
          >
            <RefreshCw size={12} />
            데이터 불러오기
          </button>
        </div>
      </div>
    );
  }

  const schedulers = schedulerData.schedulers;
  const aliveCount = schedulers.filter(s => s.status === 'ALIVE').length;
  const totalCount = schedulers.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-card" style={{
        padding: '20px',
        background: 'rgba(9, 6, 22, 0.45)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        backdropFilter: 'blur(8px)',
        borderRadius: '16px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          paddingBottom: '14px',
          marginBottom: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '14px', color: '#FFF', margin: 0, fontWeight: '800' }}>
              🕐 스케줄러 모니터링
            </h3>
            <span style={{
              fontSize: '9px',
              fontWeight: '800',
              color: aliveCount === totalCount ? '#10B981' : '#F59E0B',
              background: aliveCount === totalCount ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
              border: `1px solid ${aliveCount === totalCount ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              padding: '3px 8px',
              borderRadius: '6px',
              letterSpacing: '0.3px'
            }}>
              {aliveCount}/{totalCount} ALIVE
            </span>
          </div>

          <button
            type="button"
            onClick={fetchSchedulerHealth}
            style={{
              width: 'auto',
              padding: '6px 12px',
              fontSize: '9px',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              color: '#FFF',
              border: 'none',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
              fontWeight: '700',
              boxShadow: '0 0 10px rgba(139, 92, 246, 0.3)'
            }}
          >
            <RefreshCw size={10} />
            새로고침
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '14px'
        }}>
          {schedulers.map(scheduler => (
            <SchedulerCard key={scheduler.id} scheduler={scheduler} />
          ))}
        </div>

        {schedulerData.timestamp && (
          <div style={{
            marginTop: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
            paddingTop: '10px',
            fontSize: '8px',
            color: 'var(--text-dark)',
            textAlign: 'right'
          }}>
            마지막 갱신: {new Date(schedulerData.timestamp).toLocaleString('ko-KR')}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminSchedulerTab;
