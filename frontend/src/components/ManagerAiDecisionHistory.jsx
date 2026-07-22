import React from 'react';
import { formatKoreanDateTime } from '../lib/dateTime';
import { formatAiDecisionReason } from '../lib/aiDecisionReason';

function formatNumber(value, digits) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : '-';
}

function getDecisionStyle(decision) {
  if (decision === 'BUY') {
    return {
      label: '매수',
      color: 'var(--success-color)',
      background: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.2)',
    };
  }

  if (decision === 'SELL') {
    return {
      label: '매도',
      color: 'var(--danger-color)',
      background: 'rgba(239, 68, 68, 0.1)',
      border: 'rgba(239, 68, 68, 0.2)',
    };
  }

  return {
    label: '관망',
    color: '#F59E0B',
    background: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.2)',
  };
}

function ManagerAiDecisionHistory({ logs = [], isMobile = false }) {
  const visibleLogs = logs.slice(0, 50);

  return (
    <div
      className="glass-card"
      style={{
        padding: isMobile ? '12px' : '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '10px' : '16px',
        background: 'rgba(59, 130, 246, 0.03)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px' }}>
          <span style={{ fontSize: isMobile ? '14px' : '20px' }}>🤖</span>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontSize: isMobile ? '12px' : '16px', color: '#F3F4F6', margin: 0, fontWeight: '700' }}>
              AI 틱별 결정 히스토리
            </h4>
            <p style={{ fontSize: isMobile ? '9px' : '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              AI 엔진이 매 틱마다 판단한 매매 의사결정 이력입니다.
            </p>
          </div>
        </div>
        <span style={{ fontSize: isMobile ? '9px' : '11px', color: '#3B82F6', fontWeight: '700', whiteSpace: 'nowrap' }}>
          최근 50개
        </span>
      </div>

      {visibleLogs.length === 0 ? (
        <div style={{ padding: isMobile ? '20px 0' : '40px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: isMobile ? '11px' : '13px' }}>
          AI 엔진의 결정 이력이 아직 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '12px', maxHeight: isMobile ? '280px' : '520px', overflowY: 'auto', paddingRight: '4px' }}>
          {visibleLogs.map((log, index) => {
            const decisionStyle = getDecisionStyle(log.decision);
            const hasOrderProposal = log.decision !== 'HOLD';
            const hasRange = Number.isFinite(Number(log.proposed_lower)) && Number.isFinite(Number(log.proposed_upper));

            return (
              <div
                key={log.id || `${log.created_at}-${index}`}
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: `1px solid ${decisionStyle.border}`,
                  borderRadius: isMobile ? '8px' : '12px',
                  padding: isMobile ? '10px' : '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isMobile ? '6px' : '9px',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: isMobile ? '9px' : '11px',
                        fontWeight: '800',
                        color: decisionStyle.color,
                        background: decisionStyle.background,
                        border: `1px solid ${decisionStyle.border}`,
                        padding: isMobile ? '1px 6px' : '2px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      {decisionStyle.label}
                    </span>
                    {hasOrderProposal && (
                      <span style={{ fontSize: isMobile ? '9px' : '11px', color: '#E5E7EB', fontWeight: '700' }}>
                        추천가 {formatNumber(log.proposed_price, 4)} USDT · 수량 {formatNumber(log.proposed_amount, 2)} SUT
                      </span>
                    )}
                    {hasRange && (
                      <span style={{ fontSize: isMobile ? '9px' : '10px', color: '#9CA3AF', fontWeight: '600' }}>
                        범위 {formatNumber(log.proposed_lower, 4)} ~ {formatNumber(log.proposed_upper, 4)} USDT
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: isMobile ? '8px' : '10px', color: 'var(--text-dark)', fontFamily: 'monospace' }}>
                    {formatKoreanDateTime(log.created_at)}
                  </span>
                </div>

                <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#D1D5DB', lineHeight: '1.5', background: 'rgba(0, 0, 0, 0.15)', padding: isMobile ? '8px' : '10px', borderRadius: '8px', overflowWrap: 'anywhere' }}>
                  <strong style={{ color: '#E5E7EB' }}>판단 근거:</strong> {formatAiDecisionReason(log.reason)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ManagerAiDecisionHistory;
