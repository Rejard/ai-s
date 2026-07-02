import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { formatKoreanDateTime } from '../../lib/dateTime';
import { TOTAL_DIAGNOSTIC_NODE_COUNT } from '../../lib/adminDiagnosticsSections';

function AdminDiagnosticsTab({
  diagnosticsData,
  loadingDiagnostics,
  runningDiagnostics,
  runDiagnostics
}) {
  const [expandedSection, setExpandedSection] = useState('algorithm');
  const [terminalLogs, setTerminalLogs] = useState([]);

  useEffect(() => {
    if (runningDiagnostics) {
      setTerminalLogs([
        "> [SYSTEM] 전체 진단 노드 무결성 검증 패킷 로딩...",
        "> [SYSTEM] 하드웨어 자원 및 디스크 잔여 대역 검사...",
        "> [SYSTEM] API 벤치마킹 소켓 개방 중...",
        "> [SYSTEM] DB I/O 스트레스 연산 및 HHI 다양성 체크..."
      ]);
    } else if (diagnosticsData) {
      const logs = [
        `> 자가 진단 점검 완료 (${diagnosticsData.timestamp ? diagnosticsData.timestamp.split('T')[1].slice(0, 8) : ''})`,
        `> 종합 판정: ${diagnosticsData.overallStatus || 'UNKNOWN'}`
      ];
      (diagnosticsData.diagnostics || []).forEach(d => {
        logs.push(`> [${d.status === 'OK' ? 'PASS' : d.status}] ${d.name} -> ${d.details}`);
      });
      setTerminalLogs(logs);
    } else {
      setTerminalLogs([
        "> 자가 진단 대기 중. 상단의 진단 버튼을 터치해 주십시오."
      ]);
    }
  }, [runningDiagnostics, diagnosticsData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div className="glass-card" style={{ padding: '20px', background: 'rgba(9, 6, 22, 0.45)', border: '1px solid rgba(139, 92, 246, 0.15)', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)', backdropFilter: 'blur(8px)', borderRadius: '16px', textAlign: 'left' }}>


        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', textShadow: '0 0 8px rgba(139, 92, 246, 0.6)' }}>⚡</span>
            <h3 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: '800' }}>⚡ 시스템 무결성 점검</h3>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={runningDiagnostics || loadingDiagnostics}
            onClick={runDiagnostics}
            style={{
              width: 'auto',
              padding: '6px 12px',
              fontSize: '9px',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              border: 'none',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              fontWeight: '700',
              boxShadow: '0 0 10px rgba(139, 92, 246, 0.3)'
            }}
          >
            {runningDiagnostics ? <Loader2 size={10} className="spin" /> : '⚡ 정밀 진단'}
          </button>
        </div>


        {(() => {
          const items = diagnosticsData?.diagnostics || [];
          const okCount = items.filter(d => d.status === 'OK').length;
          const total = items.length || 25;
          const score = Math.round((okCount / total) * 100);
          const strokeColor = score === 100 ? '#10B981' : (score >= 70 ? '#FBBF24' : '#EF4444');
          const glowColor = score === 100 ? 'rgba(16,185,129,0.3)' : (score >= 70 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)');
          const radius = 45;
          const strokeWidth = 6;
          const normalizedRadius = radius - strokeWidth * 2;
          const circumference = normalizedRadius * 2 * Math.PI;
          const strokeDashoffset = circumference - (score / 100) * circumference;

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)', marginBottom: '16px' }}>
              <div style={{ position: 'relative', width: '90px', height: '90px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <svg height="90" width="90" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    stroke="rgba(255, 255, 255, 0.04)"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    r={normalizedRadius}
                    cx="45"
                    cy="45"
                  />
                  <circle
                    stroke={strokeColor}
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.8s ease-in-out', filter: `drop-shadow(0 0 4px ${glowColor})` }}
                    r={normalizedRadius}
                    cx="45"
                    cy="45"
                  />
                </svg>
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '18px', fontWeight: '950', color: '#FFF', textShadow: `0 0 8px ${glowColor}` }}>
                    {score}%
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '11px', color: '#FFF', fontWeight: '800' }}>종합 상태: <span style={{ color: strokeColor }}>{diagnosticsData?.overallStatus || 'UNKNOWN'}</span></div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                  {(diagnosticsData?.diagnostics || []).length}개 진단 노드 중 {(diagnosticsData?.diagnostics || []).filter(d => d.status === 'OK').length}개 무결성 테스트 통과 완료.
                  {diagnosticsData?.timestamp && (
                    <span style={{ display: 'block', color: '#10B981', marginTop: '2px', fontSize: '8px' }}>
                      (마지막 자가진단: {diagnosticsData.timestamp})
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}


        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { id: 'algorithm', name: '🧠 핵심 알고리즘 모듈 (9)', startIdx: 0, endIdx: 9 },
            { id: 'infrastructure', name: '🌐 외부 인프라 연동 (5)', startIdx: 9, endIdx: 14 },
            { id: 'security', name: '🛠️ 보안 및 벤치마크 (5)', startIdx: 14, endIdx: 19 },
            { id: 'council', name: '🏛️ 의회 하위 작업 (19)', startIdx: 19, endIdx: 38 },
            { id: 'shadow', name: '🏎️ Shadow Racing (5)', startIdx: 38, endIdx: 43 },
            { id: 'engine_protection', name: '🛡️ 거래 엔진 보호 (4)', startIdx: 43, endIdx: 47 },
            { id: 'db_training', name: '💾 DB 및 학습 파이프라인 (8)', startIdx: 47, endIdx: 55 },
            { id: 'eval_security', name: '🔐 평가 및 보안 (10)', startIdx: 55, endIdx: 65 },
            { id: 'ops_monitoring', name: '📊 운영 모니터링 (11)', startIdx: 65, endIdx: 76 }
          ].map(section => {
            const isOpen = expandedSection === section.id;
            const sectionItems = (diagnosticsData?.diagnostics || []).slice(section.startIdx, section.endIdx);

            return (
              <div key={section.id} style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.03)' }}>
                <button
                  type="button"
                  onClick={() => setExpandedSection(isOpen ? '' : section.id)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: isOpen ? 'rgba(139, 92, 246, 0.08)' : 'rgba(0,0,0,0.15)',
                    border: 'none',
                    color: isOpen ? '#C084FC' : '#E4E4E7',
                    fontSize: '11px',
                    fontWeight: '700',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {section.name}
                    {(() => {
                      const errCount = sectionItems.filter(d => d.status === 'ERROR').length;
                      const warnCount = sectionItems.filter(d => d.status === 'WARNING').length;
                      return (
                        <>
                          {errCount > 0 && (
                            <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#FFF', background: '#EF4444', padding: '1px 5px', borderRadius: '4px', lineHeight: '1.4' }}>
                              ERROR {errCount}
                            </span>
                          )}
                          {warnCount > 0 && (
                            <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#000', background: '#FBBF24', padding: '1px 5px', borderRadius: '4px', lineHeight: '1.4' }}>
                              WARN {warnCount}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </span>
                  <span style={{ fontSize: '8px' }}>{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div style={{ background: 'rgba(5, 3, 12, 0.2)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {sectionItems.length === 0 ? (
                      <div style={{ padding: '12px', fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        진단 데이터가 없습니다.
                      </div>
                    ) : (
                      sectionItems.map((item, idx) => {
                        const sColor = item.status === 'OK' ? '#10B981' : (item.status === 'WARNING' ? '#FBBF24' : '#EF4444');
                        const sBg = item.status === 'OK' ? 'rgba(16,185,129,0.05)' : (item.status === 'WARNING' ? 'rgba(245,158,11,0.05)' : 'rgba(239,68,68,0.05)');
                        const sBorder = item.status === 'OK' ? 'rgba(16,185,129,0.15)' : (item.status === 'WARNING' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)');

                        return (
                          <div key={idx} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '6px', padding: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '10px', color: '#FFF', fontWeight: '800' }}>{item.name}</span>
                              <span style={{ fontSize: '8px', color: sColor, background: sBg, border: `1px solid ${sBorder}`, padding: '1px 5px', borderRadius: '3px', fontWeight: '900' }}>
                                {item.status} ({item.percentage}%)
                              </span>
                            </div>
                            <p style={{ fontSize: '9px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.3' }}>
                              {item.details}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>


        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '9px', color: '#8B5CF6', fontWeight: '800', letterSpacing: '0.5px' }}>
              REALTIME CONSOLE STREAM
            </span>
            <button
              onClick={() => {
                const text = terminalLogs.join('\n');
                navigator.clipboard.writeText(text).then(() => {
                  const btn = document.getElementById('console-copy-btn');
                  if (btn) {
                    btn.textContent = '✓ COPIED';
                    setTimeout(() => { btn.textContent = '⧉ COPY'; }, 1500);
                  }
                });
              }}
              id="console-copy-btn"
              style={{
                fontSize: '8px',
                color: '#8B5CF6',
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '4px',
                padding: '2px 8px',
                cursor: 'pointer',
                fontWeight: '700',
                letterSpacing: '0.5px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => { e.target.style.background = 'rgba(139, 92, 246, 0.18)'; e.target.style.borderColor = 'rgba(139, 92, 246, 0.4)'; }}
              onMouseLeave={e => { e.target.style.background = 'rgba(139, 92, 246, 0.08)'; e.target.style.borderColor = 'rgba(139, 92, 246, 0.2)'; }}
            >
              ⧉ COPY
            </button>
          </div>
          <div
            style={{
              background: 'rgba(5, 3, 12, 0.95)',
              border: '1px solid rgba(139, 92, 246, 0.1)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontFamily: 'Consolas, monospace',
              fontSize: '8px',
              color: '#A78BFA',
              maxHeight: '270px',
              overflowY: 'auto',
              lineHeight: '1.5',
              textAlign: 'left'
            }}
          >
            {terminalLogs.map((log, idx) => (
              <div key={idx} style={{
                color: log.includes('[ERROR]') || log.includes('[FAIL]') ? '#EF4444' : (log.includes('[WARNING]') ? '#FBBF24' : (log.includes('[PASS]') ? '#10B981' : '#A78BFA'))
              }}>
                {log}
              </div>
            ))}
          </div>
        </div>


        <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'var(--text-dark)' }}>
          <span>노드 스캔율: {(diagnosticsData?.diagnostics || []).length}/{TOTAL_DIAGNOSTIC_NODE_COUNT}개 완료</span>
          <span>최근 갱신: {diagnosticsData ? formatKoreanDateTime(diagnosticsData.timestamp).split(' ')[1] : 'N/A'}</span>
        </div>

      </div>
    </div>
  );
}

export default AdminDiagnosticsTab;
