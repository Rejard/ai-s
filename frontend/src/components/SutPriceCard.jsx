import React from 'react';
import SutPriceChart from './SutPriceChart';

function SutPriceCard({ sutPrice, sutChange24h, krwRate, priceHistory, sutHigh24h, sutLow24h, isMobile = false }) {
  const containerPadding = isMobile ? '20px 20px 10px 20px' : '24px 24px 10px 24px';
  const titleSize = isMobile ? '12px' : '13px';
  const priceSize = isMobile ? '24px' : '28px';
  const usdSize = isMobile ? '14px' : '16px';
  const changeSize = isMobile ? '11px' : '13px';
  const krwSize = isMobile ? '13px' : '14px';
  const chartHeight = isMobile ? 110 : 160;
  const chartWrapperHeight = isMobile ? '120px' : '180px';
  
  return (
    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ padding: containerPadding, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: '10px' }}>
          <span style={{ fontSize: titleSize, fontWeight: '700', color: 'var(--text-muted)', display: 'block' }}>📊 SUT 실시간 시세 (Gate.io)</span>
          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: priceSize, fontWeight: '800', color: '#F3F4F6', fontFamily: 'var(--font-title)' }}>
              ${(sutPrice || 0).toFixed(4)} <span style={{ fontSize: usdSize, fontWeight: '500', color: 'var(--text-muted)' }}>USD</span>
            </span>

            <span style={{
              fontSize: changeSize,
              fontWeight: '700',
              color: sutChange24h >= 0 ? 'var(--success-color)' : 'var(--danger-color)',
              background: sutChange24h >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              padding: '4px 8px',
              borderRadius: '8px',
              border: sutChange24h >= 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              whiteSpace: 'nowrap'
            }}>
              {sutChange24h >= 0 ? '▲' : '▼'} {sutChange24h >= 0 ? '+' : ''}{(sutChange24h || 0).toFixed(2)}%
            </span>

            <span style={{ fontSize: krwSize, color: 'var(--success-color)', fontWeight: '600', whiteSpace: 'nowrap' }}>
              (≈ {((sutPrice || 0) * (krwRate || 1400)).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} KRW)
            </span>
          </div>
          {(sutHigh24h !== undefined && sutLow24h !== undefined) && (
            <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', flexWrap: 'wrap' }}>
              <span style={{ whiteSpace: 'nowrap' }}>24H 고점: <span style={{ color: 'var(--success-color)', fontFamily: 'var(--font-title)', fontSize: '12px' }}>${sutHigh24h.toFixed(4)}</span></span>
              <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
              <span style={{ whiteSpace: 'nowrap' }}>24H 저점: <span style={{ color: 'var(--danger-color)', fontFamily: 'var(--font-title)', fontSize: '12px' }}>${sutLow24h.toFixed(4)}</span></span>
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, marginTop: '2px' }}>
          <span className="glow-active" style={{ fontSize: '10px', color: 'var(--success-color)', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '10px', fontWeight: '700', border: '1px solid rgba(16, 185, 129, 0.2)', whiteSpace: 'nowrap', display: 'inline-block' }}>
            ● LIVE
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: chartWrapperHeight, position: 'relative', display: 'block', padding: isMobile ? '0 10px 10px 10px' : '10px 20px 20px 20px' }}>
        <SutPriceChart data={priceHistory} height={chartHeight} gradientId={`grad-${isMobile ? 'm' : 'pc'}`} lineGradientId={`line-${isMobile ? 'm' : 'pc'}`} />
      </div>
    </div>
  );
}

export default SutPriceCard;
