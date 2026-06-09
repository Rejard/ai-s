import React from 'react';
import { formatKoreanDateTime } from '../lib/dateTime';

function formatNumber(value, digits) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : '-';
}

function getStatusStyle(status) {
  const lowerStatus = String(status || '').toUpperCase();
  if (lowerStatus === 'SUCCESS') {
    return {
      label: '성공',
      color: '#10B981',
      background: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.25)',
    };
  }
  if (lowerStatus === 'SKIPPED') {
    return {
      label: '스킵',
      color: '#F59E0B',
      background: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.25)',
    };
  }
  return {
    label: '실패',
    color: '#EF4444',
    background: 'rgba(239, 68, 68, 0.1)',
    border: 'rgba(239, 68, 68, 0.25)',
  };
}

function getSideStyle(side) {
  const upperSide = String(side || '').toUpperCase();
  if (upperSide === 'BUY') {
    return {
      label: '매수 (BUY)',
      color: '#3B82F6',
      background: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(59, 130, 246, 0.2)',
    };
  }
  return {
    label: '매도 (SELL)',
    color: '#EC4899',
    background: 'rgba(236, 72, 153, 0.1)',
    border: 'rgba(236, 72, 153, 0.2)',
  };
}

function ManagerTradeExecutions({ executions = [], isMobile = false }) {
  const visibleExecs = executions.slice(0, 50);

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
        marginTop: '20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px' }}>
          <span style={{ fontSize: isMobile ? '14px' : '20px' }}>📊</span>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontSize: isMobile ? '12px' : '16px', color: '#F3F4F6', margin: 0, fontWeight: '700' }}>
              매니저 거래 실행 & 시도 내역
            </h4>
            <p style={{ fontSize: isMobile ? '9px' : '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              그리드봇이 각 매니저 계정으로 실제 주문을 시도하거나 스킵한 세부 로그입니다.
            </p>
          </div>
        </div>
        <span style={{ fontSize: isMobile ? '9px' : '11px', color: '#3B82F6', fontWeight: '700', whiteSpace: 'nowrap' }}>
          최근 50개
        </span>
      </div>

      {visibleExecs.length === 0 ? (
        <div style={{ padding: isMobile ? '20px 0' : '40px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: isMobile ? '11px' : '13px' }}>
          거래 실행 시도 내역이 아직 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '12px', maxHeight: isMobile ? '280px' : '520px', overflowY: 'auto', paddingRight: '4px' }}>
          {visibleExecs.map((exec, index) => {
            const statusStyle = getStatusStyle(exec.status);
            const sideStyle = getSideStyle(exec.side);
            const totalValue = (parseFloat(exec.price) || 0) * (parseFloat(exec.amount) || 0);

            return (
              <div
                key={exec.id || `${exec.created_at}-${index}`}
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: `1px solid ${statusStyle.border}`,
                  borderRadius: isMobile ? '8px' : '12px',
                  padding: isMobile ? '10px' : '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isMobile ? '6px' : '9px',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: isMobile ? '8px' : '10px',
                        fontWeight: '800',
                        color: sideStyle.color,
                        background: sideStyle.background,
                        border: `1px solid ${sideStyle.border}`,
                        padding: '1px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {sideStyle.label}
                    </span>
                    <span
                      style={{
                        fontSize: isMobile ? '8px' : '10px',
                        fontWeight: '800',
                        color: statusStyle.color,
                        background: statusStyle.background,
                        border: `1px solid ${statusStyle.border}`,
                        padding: '1px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {statusStyle.label}
                    </span>
                    {parseFloat(exec.amount) > 0 && (
                      <span style={{ fontSize: isMobile ? '9px' : '11px', color: '#E5E7EB', fontWeight: '700' }}>
                        {formatNumber(exec.price, 4)} USDT · {formatNumber(exec.amount, 2)} SUT (약 {formatNumber(totalValue, 4)} USDT)
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: isMobile ? '8px' : '10px', color: 'var(--text-dark)', fontFamily: 'monospace' }}>
                    {formatKoreanDateTime(exec.created_at)}
                  </span>
                </div>

                <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#D1D5DB', lineHeight: '1.5', background: 'rgba(0, 0, 0, 0.15)', padding: isMobile ? '8px' : '10px', borderRadius: '8px', overflowWrap: 'anywhere' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>
                      <strong style={{ color: '#E5E7EB' }}>메시지:</strong> {exec.message || '상세 내용 없음'}
                    </div>
                    {exec.gateio_order_id && (
                      <div style={{ fontSize: isMobile ? '9px' : '11px', color: '#9CA3AF', fontFamily: 'monospace' }}>
                        <strong>Gate.io 주문 ID:</strong> {exec.gateio_order_id}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ManagerTradeExecutions;
