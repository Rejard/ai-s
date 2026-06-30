import React from 'react';
import { Loader2 } from 'lucide-react';
import { formatKoreanDateTime } from '../../lib/dateTime';

function AdminCouncilTab({ councilStats, loadingCouncilStats }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, rgba(20, 16, 45, 0.3) 100%)', border: '1px solid rgba(59, 130, 246, 0.25)', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: '18px' }}>🏛️</span>
          </div>
          <div>
            <h3 style={{ fontSize: '14px', color: '#F3F4F6', margin: 0, fontWeight: '800' }}>🏛️ AI Council (의회) 의정 현황</h3>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>500인 후보군과 11인 현역 의원의 정당 분파 및 의결권 현황입니다.</p>
          </div>
        </div>

        {loadingCouncilStats ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <Loader2 size={24} className="spin" style={{ margin: '0 auto 10px', color: '#3B82F6' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>의회 데이터를 불러오는 중...</p>
          </div>
        ) : !councilStats ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>의회 정보를 불러오지 못했습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>


            <div>
              <h4 style={{ fontSize: '12px', color: '#FFF', margin: '0 0 10px 0', fontWeight: '700' }}>
                📊 500인 후보군 분파별 점유율
              </h4>
              <div style={{ display: 'flex', height: '20px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                {councilStats.factionStats.map((f) => {
                  let color = '#6B7280';
                  if (f.faction === 'EXPRESSION_DOMINANT') color = '#8B5CF6';
                  if (f.faction === 'BLACK_SWAN_SENTINEL') color = '#EF4444';
                  if (f.faction === 'DECAY_RESISTANT') color = '#10B981';

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
                        transition: 'width 0.5s ease-in-out'
                      }}
                      title={`${f.faction}: ${f.count}석 (${f.percentage}%)`}
                    >
                      {f.percentage >= 12 ? `${f.percentage}%` : ''}
                    </div>
                  );
                })}
              </div>


              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                {[
                  { key: 'EXPRESSION_DOMINANT', label: '유전자발현파 (Expression)', color: '#8B5CF6' },
                  { key: 'BLACK_SWAN_SENTINEL', label: '위기감시파 (Black Swan)', color: '#EF4444' },
                  { key: 'DECAY_RESISTANT', label: '잔존내성파 (Decay Resist)', color: '#10B981' },
                  { key: 'MUTAGEN_ADAPTIVE', label: '변이적응파 (Mutagen)', color: '#F59E0B' }
                ].map(item => {
                  const stat = councilStats.factionStats.find(s => s.faction === item.key) || { count: 0, percentage: 0 };
                  return (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: item.color }} />
                      <span><b>{item.label}:</b> {stat.count}석 ({stat.percentage}%)</span>
                    </div>
                  );
                })}
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
                boxShadow: 'inset 0 0 10px rgba(139, 92, 246, 0.05)',
                marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px' }}>🔬</span>
                    <h4 style={{ fontSize: '12px', color: '#E4E4E7', margin: 0, fontWeight: '800' }}>
                      AI 의회 표본 및 다양성 진단
                    </h4>
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 'bold',
                    padding: '2px 6px',
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
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
                    <div style={{ fontSize: '8px', color: 'var(--text-dark)', marginTop: '4px', textAlign: 'left' }}>
                      의원별 가중치 표준편차: {councilStats.healthReport.rawStdDev}
                    </div>
                  </div>


                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
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
                    <div style={{ fontSize: '8px', color: 'var(--text-dark)', marginTop: '4px', textAlign: 'left' }}>
                      최근 학습·검증 소요 시간: {councilStats.healthReport.elapsedSeconds}초 / 최대 허용 300초
                    </div>
                  </div>
                </div>

                <div style={{
                  fontSize: '10px',
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
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '11px',
                lineHeight: '1.6',
                color: '#E5E7EB',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60A5FA', fontWeight: 'bold', marginBottom: '6px', fontSize: '11.5px' }}>
                  <span>🎙️</span>
                  <span>500인 후보군의 특징 분석</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {councilStats.briefingGeneratedAt && (
                    <span>분석 일시: {formatKoreanDateTime(councilStats.briefingGeneratedAt)}</span>
                  )}
                  {councilStats.briefingRefreshing && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      color: '#60A5FA'
                    }}>
                      업데이트 중
                    </span>
                  )}
                </div>
                <div style={{ wordBreak: 'keep-all', whiteSpace: 'pre-line' }}>{councilStats.briefing}</div>
              </div>
            )}


            <div>
              <h4 style={{ fontSize: '12px', color: '#FFF', margin: '0 0 10px 0', fontWeight: '700' }}>
                🏛️ 현직 라이브 의원 탑 11인 (ACTIVE)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {councilStats.activeMembers.map((member, i) => {
                  let borderCol = 'rgba(255,255,255,0.06)';
                  let badgeBg = 'rgba(255,255,255,0.05)';
                  let factionColor = '#6B7280';
                  let factionName = '무소속';

                  if (member.faction === 'TREND_FOLLOWER') {
                    borderCol = 'rgba(37, 99, 235, 0.2)';
                    badgeBg = 'rgba(37, 99, 235, 0.05)';
                    factionColor = '#2563EB';
                    factionName = '추세추종';
                  } else if (member.faction === 'VALUE_SEEKER') {
                    borderCol = 'rgba(139, 92, 246, 0.2)';
                    badgeBg = 'rgba(139, 92, 246, 0.05)';
                    factionColor = '#8B5CF6';
                    factionName = '기술반등';
                  } else if (member.faction === 'CONSERVATIVE_WATCHER') {
                    borderCol = 'rgba(220, 38, 38, 0.2)';
                    badgeBg = 'rgba(220, 38, 38, 0.05)';
                    factionColor = '#DC2626';
                    factionName = '변동방어';
                  } else if (member.faction === 'MUTANT_ROOKIE') {
                    borderCol = 'rgba(0, 242, 254, 0.2)';
                    badgeBg = 'rgba(0, 242, 254, 0.05)';
                    factionColor = '#00F2FE';
                    factionName = '돌연변이';
                  }

                  let titleLabel = '🏛️ 의원';
                  let titleColor = '#9CA3AF';
                  let cardBg = 'rgba(0,0,0,0.2)';
                  if (i === 0) {
                    titleLabel = '👑 의장';
                    titleColor = '#F59E0B';
                    cardBg = 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 16, 45, 0.3) 100%)';
                    borderCol = 'rgba(245, 158, 11, 0.3)';
                  } else if (i === 1) {
                    titleLabel = '🥈 부의장';
                    titleColor = '#E5E7EB';
                    cardBg = 'linear-gradient(135deg, rgba(229, 231, 235, 0.08) 0%, rgba(20, 16, 45, 0.3) 100%)';
                    borderCol = 'rgba(229, 231, 235, 0.3)';
                  } else if (i === 2) {
                    titleLabel = '🥉 상임위원장';
                    titleColor = '#B45309';
                    cardBg = 'linear-gradient(135deg, rgba(180, 83, 9, 0.08) 0%, rgba(20, 16, 45, 0.3) 100%)';
                    borderCol = 'rgba(180, 83, 9, 0.3)';
                  }

                  return (
                    <div key={member.member_id} style={{ border: `1px solid ${borderCol}`, background: cardBg, padding: '10px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '9px', color: titleColor, fontWeight: '900' }}>
                          {titleLabel}
                        </span>
                        <span style={{ fontSize: '8px', background: 'rgba(255,255,255,0.06)', color: '#A78BFA', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>
                          🧬 {member.generation || 1}대
                        </span>
                      </div>

                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '11px', color: '#FFF', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {member.name}
                        </div>
                        <div style={{ fontSize: '8px', color: factionColor, marginTop: '2px', fontWeight: 'bold' }}>
                          • {factionName}
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'var(--text-muted)' }}>
                          <span>의결권:</span>
                          <span style={{ color: '#FFF', fontWeight: 'bold' }}>{member.voting_power.toFixed(1)}표</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'var(--text-muted)' }}>
                          <span>정확도:</span>
                          <span style={{ color: '#10B981', fontWeight: 'bold' }}>{member.correct_count}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>


            <div>
              <h4 style={{ fontSize: '12px', color: '#FFF', margin: '0 0 8px 0', fontWeight: '700' }}>
                🔔 최근 매매 의사 결정 11명 AI 의원들의 개별 투표 결과
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
                    <div key={v.id} style={{ flexShrink: 0, width: '110px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                      <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{v.timestamp.substring(11)}</span>
                      <span style={{ fontSize: '10px', color: '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ fontSize: '8px', color: 'var(--text-dark)' }}>{v.faction === 'TREND_FOLLOWER' ? '추세' : v.faction === 'VALUE_SEEKER' ? '기술' : v.faction === 'CONSERVATIVE_WATCHER' ? '방어' : '변동'}</span>
                        <span style={{ fontSize: '9px', color: voteColor, background: voteBg, padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>{v.decision_vote}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>

      {!!(councilStats?.originStats || []).length && (
        <div className="glass-card" style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.18)', textAlign: 'left' }}>
          <h4 style={{ fontSize: '12px', color: '#E4E4E7', margin: '0 0 10px 0', fontWeight: '800' }}>500 Candidate Origin Distribution</h4>
          {(councilStats.originStats || []).map((item) => {
            const label = item.origin === 'crossover_offspring'
              ? 'Crossover Offspring'
              : item.origin === 'seeded_random'
                ? 'Seeded Random'
                : 'Mutated Lineage';
            const color = item.origin === 'crossover_offspring'
              ? '#10B981'
              : item.origin === 'seeded_random'
                ? '#F59E0B'
                : '#38BDF8';
            return (
              <div key={item.origin} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', color: '#E5E7EB', fontWeight: '700', width: '80px', flexShrink: 0 }}>{label}</div>
                <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${item.percentage}%`, height: '100%', background: color, borderRadius: '999px' }} />
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', width: '60px', textAlign: 'right', flexShrink: 0 }}>{item.count} ({item.percentage}%)</div>
              </div>
            );
          })}
          {!!(councilStats.activeOriginStats || []).length && (
            <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(councilStats.activeOriginStats || []).map((item) => {
                const label = item.origin === 'crossover_offspring' ? 'ACTIVE Crossover' : item.origin === 'seeded_random' ? 'ACTIVE Seeded' : 'ACTIVE Mutated';
                return (
                  <div key={`active-${item.origin}`} style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                    <b style={{ color: '#E5E7EB' }}>{label}</b> {item.count} ({item.percentage}%)
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default AdminCouncilTab;
