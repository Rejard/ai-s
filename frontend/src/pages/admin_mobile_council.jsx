import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { formatKoreanDateTime } from '../lib/dateTime';
import { API_BASE } from '../App';
import { buildAuthHeaders } from '../lib/authSession';

const ADMIN_EMAIL = 'lemaiiisk@gmail.com';

function AdminMobileCouncil() {
  const navigate = useNavigate();
  const [councilStats, setCouncilStats] = useState(null);
  const [loadingCouncilStats, setLoadingCouncilStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getAdminHeaders = () => ({
    headers: {
      ...buildAuthHeaders(),
      'x-admin-email': ADMIN_EMAIL
    }
  });

  const fetchCouncilStats = async () => {
    try {
      setRefreshing(true);
      const res = await axios.get(`${API_BASE}/admin/council-stats`, getAdminHeaders());
      if (res.data.success) {
        setCouncilStats({
          factionStats: res.data.factionStats || [],
          originStats: res.data.originStats || [],
          activeOriginStats: res.data.activeOriginStats || [],
          activeMembers: res.data.activeMembers || [],
          recentVotes: res.data.recentVotes || [],
          briefing: res.data.briefing || '',
          briefingGeneratedAt: res.data.briefingGeneratedAt || '',
          briefingStatus: res.data.briefingStatus || '',
          briefingRefreshing: Boolean(res.data.briefingRefreshing),
          healthReport: res.data.healthReport || null
        });
      }
    } catch (err) {
      console.error('Failed to load council stats in User Council Page:', err.message);
    } finally {
      setLoadingCouncilStats(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCouncilStats();
    const refreshTimer = setInterval(() => {
      fetchCouncilStats();
    }, 60000);
    return () => clearInterval(refreshTimer);
  }, []);

  return (
    <div style={{ padding: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100vh', backgroundColor: 'var(--bg-app)', overflowX: 'hidden' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--glass-border)' }}>
        <button 
          onClick={() => navigate('/dashboard')}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: '#F3F4F6', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            padding: 0
          }}
        >
          <ArrowLeft size={20} color="#F3F4F6" />
          돌아가기
        </button>
        <h2 style={{ fontSize: '16px', color: '#FFF', margin: 0, fontWeight: '800' }}>🏛️ AI 의회 현황</h2>
        <button 
          onClick={fetchCouncilStats}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: '#A78BFA', 
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center'
          }}
          disabled={refreshing}
        >
          <RefreshCw size={18} className={refreshing ? 'spin-animation' : ''} style={{ transition: 'transform 0.5s' }} />
        </button>
      </div>

      {loadingCouncilStats ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="shimmer-loading" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 15px' }}></div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>의원 명부를 분석 중입니다...</span>
        </div>
      ) : !councilStats ? (
        <div className="glass-card" style={{ padding: '30px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>의회 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, rgba(20, 16, 45, 0.3) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '750', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📊</span> 500인 후보군 분파별 점유율 (의석)
            </h4>
            <div style={{ display: 'flex', height: '22px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
              {councilStats.factionStats.map((f, idx) => {
                let color = '#6B7280';
                if (f.faction === 'EXPRESSION_DOMINANT') color = '#8B5CF6';
                if (f.faction === 'BLACK_SWAN_SENTINEL') color = '#EF4444';
                if (f.faction === 'DECAY_RESISTANT') color = '#10B981';
                if (f.faction === 'MUTAGEN_ADAPTIVE') color = '#F59E0B';
                
                return (
                  <div
                    key={f.faction}
                    style={{
                      width: `${f.percentage}%`,
                      background: color,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      color: '#FFF',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      transition: 'width 0.5s ease'
                    }}
                    title={`${f.faction}: ${f.count}석 (${f.percentage}%)`}
                  >
                    {f.percentage >= 12 ? `${f.percentage}%` : ''}
                  </div>
                );
              })}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
              {[
                { key: 'EXPRESSION_DOMINANT', label: '유전자발현파', desc: '모든 지표를 종합해 확신 시 적극 진입하는 공격형', color: '#8B5CF6' },
                { key: 'BLACK_SWAN_SENTINEL', label: '위기감시파', desc: '블랙스완 감지 시 즉각 방어하는 위기대응형', color: '#EF4444' },
                { key: 'DECAY_RESISTANT', label: '잔존내성파', desc: '전략 변경 없이 일관된 패턴을 고수하는 존버형', color: '#10B981' },
                { key: 'MUTAGEN_ADAPTIVE', label: '변이적응파', desc: '시장 변화에 맞춰 전략을 빠르게 전환하는 적응형', color: '#F59E0B' }
              ].map(item => {
                const stat = councilStats.factionStats.find(s => s.faction === item.key) || { count: 0, percentage: 0 };
                return (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0, alignSelf: 'center' }} />
                    <span>
                      <b>{item.label}:</b> {stat.count}석 ({stat.percentage}%) <span style={{ color: 'var(--text-dark)', fontSize: '9px' }}>— {item.desc}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.18)' }}>
            <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '750', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🧬</span> 500인 후보군 탄생 경로 분포
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(councilStats.originStats || []).map((item) => {
                const label = item.origin === 'crossover_offspring'
                  ? '교차 생산'
                  : item.origin === 'seeded_random'
                    ? '초기 시드'
                    : '돌연변이 계보';
                const color = item.origin === 'crossover_offspring'
                  ? '#10B981'
                  : item.origin === 'seeded_random'
                    ? '#F59E0B'
                    : '#38BDF8';
                return (
                  <div key={item.origin} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ minWidth: '76px', fontSize: '11px', color: '#E5E7EB', fontWeight: '700' }}>{label}</div>
                    <div style={{ flex: 1, height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ width: `${item.percentage}%`, height: '100%', background: color, borderRadius: '999px' }} />
                    </div>
                    <div style={{ minWidth: '74px', textAlign: 'right', fontSize: '10px', color: 'var(--text-muted)' }}>{item.count} ({item.percentage}%)</div>
                  </div>
                );
              })}
            </div>
            {!!(councilStats.activeOriginStats || []).length && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(councilStats.activeOriginStats || []).map((item) => {
                  const label = item.origin === 'crossover_offspring' ? '현역 교차생산' : item.origin === 'seeded_random' ? '현역 초기시드' : '현역 돌연변이';
                  return <div key={`active-${item.origin}`} style={{ fontSize: '9px', color: 'var(--text-muted)' }}><b style={{ color: '#E5E7EB' }}>{label}</b> {item.count} ({item.percentage}%)</div>;
                })}
              </div>
            )}
            <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.5', textAlign: 'left' }}>
              교차생산, 돌연변이, 초기시드 경로의 다양성은 진화적 건강 상태를 나타냅니다.
            </div>
          </div>

          {councilStats.healthReport && (
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: 'inset 0 0 10px rgba(139, 92, 246, 0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px' }}>🔬</span>
                  <h4 style={{ fontSize: '13px', color: '#E4E4E7', margin: 0, fontWeight: '800' }}>
                    AI 의회 표본 및 다양성 진단
                  </h4>
                </div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 'bold',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: councilStats.healthReport.diversityGrade === 'GOOD' ? 'rgba(16, 185, 129, 0.15)' : councilStats.healthReport.diversityGrade === 'WARNING' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: councilStats.healthReport.diversityGrade === 'GOOD' ? '#10B981' : councilStats.healthReport.diversityGrade === 'WARNING' ? '#FBBF24' : '#EF4444',
                  border: councilStats.healthReport.diversityGrade === 'GOOD' ? '1px solid rgba(16, 185, 129, 0.2)' : councilStats.healthReport.diversityGrade === 'WARNING' ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                  {councilStats.healthReport.diversityGrade === 'GOOD' ? '적정 🟢' : councilStats.healthReport.diversityGrade === 'WARNING' ? '경고 🟡' : '위험 🔴'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>🧬 유전적 다양성 지수</span>
                    <strong style={{ color: '#A78BFA' }}>{councilStats.healthReport.diversityScore}%</strong>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${councilStats.healthReport.diversityScore}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #8B5CF6 0%, #A78BFA 100%)',
                      borderRadius: '2px'
                    }} />
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-dark)', marginTop: '4px', textAlign: 'left' }}>
                    의원별 가중치 표준편차: {councilStats.healthReport.rawStdDev}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>⚡ 실시간 위험감지 연산 여유율 (5분 틱)</span>
                    <strong style={{ color: '#3B82F6' }}>{councilStats.healthReport.computationMargin}%</strong>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${councilStats.healthReport.computationMargin}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)',
                      borderRadius: '2px'
                    }} />
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-dark)', marginTop: '4px', textAlign: 'left' }}>
                    최근 학습·검증 소요 시간: {councilStats.healthReport.elapsedSeconds}초 / 최대 허용 300초
                  </div>
                </div>
              </div>

              <div style={{
                fontSize: '11px',
                lineHeight: '1.5',
                color: 'var(--text-muted)',
                padding: '10px 12px',
                borderRadius: '6px',
                background: councilStats.healthReport.diagnosticClass === 'danger' ? 'rgba(239, 68, 68, 0.04)' : councilStats.healthReport.diagnosticClass === 'warning' ? 'rgba(245, 158, 11, 0.04)' : 'rgba(16, 185, 129, 0.04)',
                borderLeft: `3px solid ${councilStats.healthReport.diagnosticClass === 'danger' ? '#EF4444' : councilStats.healthReport.diagnosticClass === 'warning' ? '#FBBF24' : '#10B981'}`,
                textAlign: 'left'
              }}>
                {councilStats.healthReport.recommendationText}
              </div>
            </div>
          )}

          {councilStats.briefing && (
            <div style={{
              background: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#E5E7EB',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60A5FA', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>
                <span style={{ fontSize: '18px' }}>🎙️</span>
                <span>500인 후보군의 특징 분석</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                {councilStats.briefingGeneratedAt && (
                  <span>분석 일시: {formatKoreanDateTime(councilStats.briefingGeneratedAt)}</span>
                )}
                {councilStats.briefingRefreshing && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    color: '#60A5FA',
                    fontSize: '10px'
                  }}>
                    업데이트 중
                  </span>
                )}
              </div>
              <div style={{ wordBreak: 'keep-all', whiteSpace: 'pre-line' }}>{councilStats.briefing}</div>
            </div>
          )}

          <div className="glass-card" style={{ padding: '20px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 10px 0', fontWeight: '750', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🔔</span> 최근 AI 의원 투표 현황
            </h4>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
              {councilStats.recentVotes.map(v => {
                let voteColor = '#6B7280';
                let voteBg = 'rgba(255,255,255,0.05)';
                if (v.decision_vote === 'BUY') {
                  voteColor = 'var(--success-color)';
                  voteBg = 'rgba(16, 185, 129, 0.1)';
                } else if (v.decision_vote === 'SELL') {
                  voteColor = 'var(--danger-color)';
                  voteBg = 'rgba(239, 68, 68, 0.1)';
                } else {
                  voteColor = 'var(--text-muted)';
                  voteBg = 'rgba(255,255,255,0.08)';
                }

                return (
                  <div key={v.id} style={{ flexShrink: 0, width: '115px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.25)', padding: '10px 8px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{v.timestamp.substring(11)}</span>
                    <span style={{ fontSize: '10px', color: '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600' }}>{v.name}</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                      <span style={{ fontSize: '8px', color: 'var(--text-dark)' }}>{v.faction === 'EXPRESSION_DOMINANT' ? '발현' : v.faction === 'BLACK_SWAN_SENTINEL' ? '위기' : v.faction === 'DECAY_RESISTANT' ? '내성' : '적응'}</span>
                      <span style={{ fontSize: '9px', color: voteColor, background: voteBg, padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>{v.decision_vote}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '750', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🏛️</span> 현직 라이브 의원 탑 11 (ACTIVE)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {councilStats.activeMembers.map((member, i) => {
                let borderCol = 'rgba(255,255,255,0.06)';
                let badgeBg = 'rgba(255,255,255,0.05)';
                let factionColor = '#6B7280';
                let factionName = '무소속';

                if (member.faction === 'EXPRESSION_DOMINANT') {
                  borderCol = 'rgba(139, 92, 246, 0.15)';
                  badgeBg = 'rgba(139, 92, 246, 0.03)';
                  factionColor = '#8B5CF6';
                  factionName = '유전자발현';
                } else if (member.faction === 'BLACK_SWAN_SENTINEL') {
                  borderCol = 'rgba(239, 68, 68, 0.15)';
                  badgeBg = 'rgba(239, 68, 68, 0.03)';
                  factionColor = '#EF4444';
                  factionName = '위기감시';
                } else if (member.faction === 'DECAY_RESISTANT') {
                  borderCol = 'rgba(16, 185, 129, 0.15)';
                  badgeBg = 'rgba(16, 185, 129, 0.03)';
                  factionColor = '#10B981';
                  factionName = '잔존내성';
                } else if (member.faction === 'MUTAGEN_ADAPTIVE') {
                  borderCol = 'rgba(245, 158, 11, 0.15)';
                  badgeBg = 'rgba(245, 158, 11, 0.03)';
                  factionColor = '#F59E0B';
                  factionName = '변이적응';
                }


                let titleLabel = '🏛️ 의원';
                let titleColor = '#9CA3AF';
                let cardBg = 'rgba(0,0,0,0.2)';
                if (i === 0) {
                  titleLabel = '👑 의장';
                  titleColor = '#F59E0B';
                  cardBg = 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 16, 45, 0.3) 100%)';
                  borderCol = 'rgba(245, 158, 11, 0.25)';
                } else if (i === 1) {
                  titleLabel = '🥈 부의장';
                  titleColor = '#E5E7EB';
                  cardBg = 'linear-gradient(135deg, rgba(229, 231, 235, 0.08) 0%, rgba(20, 16, 45, 0.3) 100%)';
                  borderCol = 'rgba(229, 231, 235, 0.25)';
                } else if (i === 2) {
                  titleLabel = '🥉 상임위원장';
                  titleColor = '#B45309';
                  cardBg = 'linear-gradient(135deg, rgba(180, 83, 9, 0.08) 0%, rgba(20, 16, 45, 0.3) 100%)';
                  borderCol = 'rgba(180, 83, 9, 0.25)';
                }

                return (
                  <div key={member.member_id} style={{ border: `1px solid ${borderCol}`, background: cardBg, padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: i < 3 ? '0 2px 8px rgba(0,0,0,0.1)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: titleColor, fontWeight: '900', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {titleLabel}
                      </span>
                      <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.06)', color: '#A78BFA', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                        🧬 {member.generation || 1}세대
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                        <span style={{ fontSize: '13px', color: '#FFF', fontWeight: 'bold' }}>{member.name}</span>
                      </div>
                      <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.08)', color: factionColor, padding: '2px 5px', borderRadius: '4px', fontWeight: '800' }}>
                        {factionName}
                      </span>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                      <span>의결권: <b style={{ color: '#FFF' }}>{member.voting_power.toFixed(2)}표</b></span>
                      <span>정확도: <b style={{ color: '#10B981' }}>{member.correct_count}%</b></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default AdminMobileCouncil;
