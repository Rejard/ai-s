import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { API_BASE } from '../App';

function CouncilPage() {
  const navigate = useNavigate();
  const [councilStats, setCouncilStats] = useState(null);
  const [loadingCouncilStats, setLoadingCouncilStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCouncilStats = async () => {
    try {
      setRefreshing(true);
      const res = await axios.get(`${API_BASE}/investment/council-stats`);
      if (res.data.success) {
        setCouncilStats({
          factionStats: res.data.factionStats,
          activeMembers: res.data.activeMembers,
          recentVotes: res.data.recentVotes,
          briefing: res.data.briefing || ''
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
    }, 5000);
    return () => clearInterval(refreshTimer);
  }, []);

  return (
    <div style={{ padding: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100vh', backgroundColor: 'var(--bg-app)', overflowX: 'hidden' }}>
      
      {/* 상단 네비게이션 헤더 */}
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
          
          {/* 1. 500인 전체 의회 분파 점유율 게이지 */}
          <div className="glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, rgba(20, 16, 45, 0.3) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '750', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📊</span> 500인 후보군 분파별 점유율 (의석)
            </h4>
            <div style={{ display: 'flex', height: '22px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
              {councilStats.factionStats.map((f, idx) => {
                let color = '#6B7280';
                if (f.faction === 'TREND_FOLLOWER') color = '#EF4444';
                if (f.faction === 'VALUE_SEEKER') color = '#3B82F6';
                if (f.faction === 'CONSERVATIVE_WATCHER') color = '#10B981';
                if (f.faction === 'MUTANT_ROOKIE') color = '#8B5CF6';

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
            
            {/* 범례 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
              {[
                { key: 'TREND_FOLLOWER', label: '추세추종 (SMA)', color: '#EF4444' },
                { key: 'VALUE_SEEKER', label: '기술반등 (RSI)', color: '#3B82F6' },
                { key: 'CONSERVATIVE_WATCHER', label: '변동방어 (안정)', color: '#10B981' },
                { key: 'MUTANT_ROOKIE', label: '돌연변이 (진화)', color: '#8B5CF6' }
              ].map(item => {
                const stat = councilStats.factionStats.find(s => s.faction === item.key) || { count: 0, percentage: 0 };
                return (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      <b>{item.label}:</b> {stat.count}석 ({stat.percentage}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI 의회 실시간 여론 동향 브리핑 */}
          {councilStats.briefing && (
            <div className="glass-card" style={{
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(20, 16, 45, 0.3) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              fontSize: '11px',
              lineHeight: '1.6',
              color: '#E5E7EB',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60A5FA', fontWeight: 'bold', marginBottom: '6px', fontSize: '11.5px' }}>
                <span>🎙️</span>
                <span>AI 의원 여론 동향 브리핑</span>
              </div>
              <div style={{ wordBreak: 'keep-all' }}>{councilStats.briefing}</div>
            </div>
          )}

          {/* 2. 최근 의결 투표 흐름 */}
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
                      <span style={{ fontSize: '8px', color: 'var(--text-dark)' }}>{v.faction === 'TREND_FOLLOWER' ? '추세' : v.faction === 'VALUE_SEEKER' ? '기술' : v.faction === 'CONSERVATIVE_WATCHER' ? '방어' : '변동'}</span>
                      <span style={{ fontSize: '9px', color: voteColor, background: voteBg, padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>{v.decision_vote}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. 현재 당선된 11인의 ACTIVE 의원 명부 */}
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

                if (member.faction === 'TREND_FOLLOWER') {
                  borderCol = 'rgba(239, 68, 68, 0.15)';
                  badgeBg = 'rgba(239, 68, 68, 0.03)';
                  factionColor = '#EF4444';
                  factionName = '추세추종';
                } else if (member.faction === 'VALUE_SEEKER') {
                  borderCol = 'rgba(59, 130, 246, 0.15)';
                  badgeBg = 'rgba(59, 130, 246, 0.03)';
                  factionColor = '#3B82F6';
                  factionName = '기술반등';
                } else if (member.faction === 'CONSERVATIVE_WATCHER') {
                  borderCol = 'rgba(16, 185, 129, 0.15)';
                  badgeBg = 'rgba(16, 185, 129, 0.03)';
                  factionColor = '#10B981';
                  factionName = '변동방어';
                } else if (member.faction === 'MUTANT_ROOKIE') {
                  borderCol = 'rgba(139, 92, 246, 0.15)';
                  badgeBg = 'rgba(139, 92, 246, 0.03)';
                  factionColor = '#8B5CF6';
                  factionName = '돌연변이';
                }

                // 특별 직책 및 스타일링 계산
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
                      <span>지분: <b style={{ color: '#FFF' }}>{member.voting_power.toFixed(2)}표</b></span>
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

export default CouncilPage;
