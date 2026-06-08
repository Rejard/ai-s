import React from 'react';

function SutPriceChart({ data = [], height = 160, gradientId = 'sutPriceGrad', lineGradientId = 'sutPriceLineGrad' }) {
  const chartData = data.length > 0 ? data : [0.19];
  const minVal = Math.min(...chartData) * 0.999;
  const maxVal = Math.max(...chartData) * 1.001;
  const valRange = maxVal - minVal || 0.01;
  
  const points = chartData.map((val, idx) => {
    const x = chartData.length > 1 ? (idx / (chartData.length - 1)) * 500 : 250;
    const y = height - 20 - ((val - minVal) / valRange) * (height - 40);
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
    dArea = `${dPath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  }

  return (
    <svg width="100%" height={height} viewBox={`0 0 500 ${height}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
        </linearGradient>
        <linearGradient id={lineGradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>

      <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.08)" strokeDasharray="4,4" />
      <line x1="0" y1={height / 2} x2="500" y2={height / 2} stroke="rgba(255,255,255,0.15)" />
      <line x1="0" y1={height - 30} x2="500" y2={height - 30} stroke="rgba(255,255,255,0.08)" strokeDasharray="4,4" />

      {dArea && <path d={dArea} fill={`url(#${gradientId})`} style={{ transition: 'all 0.5s ease' }} />}
      {dPath && <path d={dPath} fill="none" stroke={`url(#${lineGradientId})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.5s ease' }} />}
      
      {points.length > 0 && (
        <circle 
          cx={points[points.length - 1].x} 
          cy={points[points.length - 1].y} 
          r="5" 
          fill="var(--success-color)" 
          stroke="#FFF" 
          strokeWidth="2" 
          style={{ transition: 'all 0.5s ease' }} 
        />
      )}
    </svg>
  );
}

export default SutPriceChart;
