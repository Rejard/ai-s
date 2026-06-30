import React from 'react';
import { Receipt, ExternalLink } from 'lucide-react';
import SutPriceCard from '../components/SutPriceCard';

function ManagerAssetTab({
  sutPrice, sutChange24h, portfolio, priceHistory, performance,
  gateioBalance, yieldHistory, vaultSutBalance, walletSutBalance, stats
}) {
  const statCards = [
    { label: '👥 회원 총 예치', value: `${stats?.totalDeposited || 0} SUT`, color: '#3B82F6' },
    { label: '👥 회원 총 지급액', value: `${stats?.totalDistributed || 0} SUT`, color: '#F59E0B' },
    { label: '👥 회원 위탁 SUT', value: `${vaultSutBalance?.toFixed ? vaultSutBalance.toFixed(2) : '0'} SUT`, color: '#8B5CF6' },
    { label: '👤 매니저 본인 입금', value: `${Number(stats?.managerSelfDeposited || 0).toFixed(2)} SUT`, color: '#60A5FA' },
    { label: '👤 Gate.io SUT', value: `${gateioBalance ? parseFloat(gateioBalance.SUT || 0).toFixed(2) : '0'} SUT`, color: '#60A5FA' },
    { label: '👤 월렛지갑 SUT', value: `${walletSutBalance?.toFixed ? walletSutBalance.toFixed(2) : '0'} SUT`, color: '#A78BFA' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SutPriceCard
        sutPrice={sutPrice}
        sutChange24h={sutChange24h}
        krwRate={portfolio?.krwRate}
        priceHistory={priceHistory}
        sutHigh24h={performance?.sutHigh24h || portfolio?.sutHigh24h}
        sutLow24h={performance?.sutLow24h || portfolio?.sutLow24h}
        isMobile={true}
      />

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden', position: 'relative', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <div style={{ padding: '16px 16px 10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>📈 Gate.io 실시간 투자 수익률 (원금 대비)</span>
            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '20px',
                fontWeight: '800',
                color: performance ? (performance.yieldPercent >= 0 ? 'var(--success-color)' : 'var(--danger-color)') : '#FFF',
                fontFamily: 'var(--font-title)'
              }}>
                {performance ? `${performance.yieldPercent >= 0 ? '+' : ''}${performance.yieldPercent.toFixed(2)}%` : '0.00%'}
              </span>
              {performance && (
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  (원금: {performance.totalBuyUsdt.toFixed(2)} USDT / 보유 USDT: {gateioBalance ? parseFloat(gateioBalance.USDT).toFixed(2) : '0.00'} USDT)
                </span>
              )}
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <span className="glow-active" style={{ fontSize: '9px', color: performance ? 'var(--success-color)' : 'var(--text-dark)', background: performance ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '8px', fontWeight: '700', whiteSpace: 'nowrap' }}>
              ● {performance ? '실거래 수익률' : '가상 데모'}
            </span>
          </div>
        </div>

        <div style={{ width: '100%', height: '100px', position: 'relative', display: 'block', padding: '10px 16px 12px 16px' }}>
          <svg width="100%" height="80" viewBox="0 0 500 80" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
              <linearGradient id="assetTabYieldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="assetTabYieldLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
            </defs>

            <line x1="0" y1="15" x2="500" y2="15" stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
            <line x1="0" y1="40" x2="500" y2="40" stroke="rgba(255,255,255,0.08)" />
            <line x1="0" y1="65" x2="500" y2="65" stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />

            {(() => {
              const dummyYield = [0.0, 0.12, 0.08, 0.25, 0.38, 0.31, 0.45, 0.58, 0.52, 0.68, 0.82, 0.75, 0.95, 1.12, 1.05, 1.28, 1.42, 1.35, 1.55, 1.72];
              const data = (performance && yieldHistory && yieldHistory.length > 0) ? yieldHistory : dummyYield;
              const height = 80;
              const minVal = Math.min(...data) - 0.5;
              const maxVal = Math.max(...data) + 0.5;
              const valRange = maxVal - minVal || 1;
              const points = data.map((val, idx) => {
                const x = data.length > 1 ? (idx / (data.length - 1)) * 500 : 250;
                const y = height - 10 - ((val - minVal) / valRange) * (height - 20);
                return { x, y, val };
              });
              let dPath = '';
              let dArea = '';
              if (points.length > 0) {
                dPath = `M ${points[0].x} ${points[0].y}`;
                for (let i = 0; i < points.length - 1; i++) {
                  const p0 = points[i];
                  const p1 = points[i + 1];
                  const cpX1 = p0.x + (p1.x - p0.x) / 2;
                  const cpY1 = p0.y;
                  const cpX2 = p0.x + (p1.x - p0.x) / 2;
                  const cpY2 = p1.y;
                  dPath += ` C ${cpX1} ${cpY1} ${cpX2} ${cpY2} ${p1.x} ${p1.y}`;
                }
                dArea = `${dPath} L ${points[points.length - 1].x} 80 L ${points[0].x} 80 Z`;
              }
              return (
                <>
                  {dArea && <path d={dArea} fill="url(#assetTabYieldGrad)" style={{ transition: 'all 0.5s ease' }} />}
                  {dPath && <path d={dPath} fill="none" stroke="url(#assetTabYieldLineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.5s ease' }} />}
                  {points.length > 0 && (
                    <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill="var(--success-color)" stroke="#FFF" strokeWidth="1.5" style={{ transition: 'all 0.5s ease' }} />
                  )}
                </>
              );
            })()}
          </svg>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
        <h4 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>💰</span> SUT 자산 통합 관리 현황
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {statCards.map((card, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255,255,255,0.02)',
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                gridColumn: idx === statCards.length - 1 && statCards.length % 2 !== 0 ? 'span 2' : undefined
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>{card.label}</span>
              <span style={{ fontSize: '13px', color: card.color, fontWeight: '700', fontFamily: 'var(--font-title)' }}>{card.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <h3 style={{ fontSize: '15px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Receipt size={18} color="#10B981" />
          최근 Gate.io 실거래 체결 내역 (수동/자동 통합)
        </h3>

        {(!performance || !performance.trades || performance.trades.length === 0) ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>
            API가 연동되지 않았거나 최근 체결된 거래 내역이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {performance.trades.map((trade, idx) => {
              const isBuy = trade.side === 'buy';
              const formattedTime = (() => {
                try {
                  const ts = parseFloat(trade.create_time_ms || (trade.create_time * 1000));
                  const date = new Date(ts);
                  return date.toLocaleString();
                } catch (e) {
                  return '-';
                }
              })();
              const amount = parseFloat(trade.amount).toFixed(2);
              const price = parseFloat(trade.price).toFixed(4);
              const total = (parseFloat(trade.amount) * parseFloat(trade.price)).toFixed(4);
              const fee = trade.fee ? `${parseFloat(trade.fee).toFixed(4)} ${trade.fee_currency}` : '0';

              return (
                <div key={trade.id || idx} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      color: isBuy ? 'var(--success-color)' : 'var(--danger-color)',
                      background: isBuy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      fontSize: '10px'
                    }}>
                      {isBuy ? '🟢 매수' : '🔴 매도'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-dark)', fontFamily: 'monospace' }}>{formattedTime}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>단가:</span> <strong style={{ color: '#FFF' }}>{price} USDT</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>수량:</span> <strong style={{ color: '#FFF' }}>{amount} SUT</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px', marginTop: '2px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>총액:</span> <strong style={{ color: isBuy ? 'var(--success-color)' : 'var(--danger-color)' }}>{total} USDT</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dark)' }}>수수료:</span> <span style={{ color: 'var(--text-muted)' }}>{fee}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ManagerAssetTab;
