import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../App';
import {
  ShieldAlert, ShieldCheck, Users, Wallet, Trash2, UserPlus,
  ArrowLeft, BarChart3, Loader2, Home, Settings, Receipt
} from 'lucide-react';
import { useAdminLogic } from '../hooks/useAdminLogic';
import AisTrainingEvidence from '../components/AisTrainingEvidence';
import { formatKoreanDateTime } from '../lib/dateTime';
import { downloadAuthenticatedFile } from '../lib/authSession';

function AdminDashboard({ walletAddress, managerEmail }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');
  const [historyFilter, setHistoryFilter] = useState('ALL');

  const {
    managers,
    loading,
    promoteWallet,
    setPromoteWallet,
    submittingPromote,
    submittingDelete,
    globalAiModel,
    setGlobalAiModel,
    globalGeminiApiKey,
    setGlobalGeminiApiKey,
    globalAiInterval,
    setGlobalAiInterval,
    globalAiIntervalAuto,
    setGlobalAiIntervalAuto,
    savingAiConfig,
    isAdmin,
    handlePromoteManager,
    handleDeleteManager,
    handleSaveAiConfig,
    vaultSutBalance,
    stats,
    aiLogs,
    globalAiEngine,
    trainingDataCount,
    aisLastTrainedAt,
    aisModelAccuracy,
    aisTrainingStats,
    savingAiEngine,
    handleSaveAiEngine,
    councilStats,
    loadingCouncilStats
  } = useAdminLogic(managerEmail);




  if (!isAdmin) {
    return (
      <div className="app-frame" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div className="glass-card" style={{ width: '100%', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', marginBottom: '20px' }}>
            <ShieldAlert size={48} color="var(--danger-color)" />
          </div>
          <h2 style={{ fontSize: '20px', color: '#FFF', fontWeight: '800', marginBottom: '12px' }}>접근 권한 보안 제한 (보안 통제 구역)</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
            본 화면은 플랫폼 총괄 관리자(Admin)만 진입할 수 있는 통제구역입니다. 등록된 관리자 이메일(lemaiiisk@gmail.com)로 연동해 주십시오.
          </p>
          <button className="btn-secondary" onClick={() => navigate('/dashboard')} style={{ width: '100%', padding: '12px' }}>
            대시보드로 복귀
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-frame">

      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px', borderBottom: '1px solid var(--glass-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: 0 }}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#FFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
            👑 최고 관리자(Admin) 제어 센터
          </h1>
        </div>
      </header>

      <main style={{ flex: 1, padding: '20px', paddingBottom: '85px', overflowY: 'auto' }}>

        <div className="glass-card" style={{ padding: '16px', marginBottom: '20px', background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.1) 0%, transparent 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-gradient)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '16px', fontWeight: 'bold', color: '#FFF' }}>
              A
            </div>
            <div>
              <h4 style={{ fontSize: '15px', color: '#FFF', margin: 0 }}>이명학 총괄 관리자 (Platform Owner)</h4>
              <span style={{ fontSize: '11px', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontWeight: '700' }}>
                <ShieldCheck size={12} /> 보안 인증 가동 중
              </span>
            </div>
          </div>
        </div>

        {activeTab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div className="glass-card" style={{ padding: '16px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <h3 style={{ fontSize: '15px', color: '#FFF', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                🏢 본사 SUT 자산 현황
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>본사 보유 자산 (수익 - 실시간):</span>
                  <span style={{ color: '#10B981', fontWeight: '700' }}>{(vaultSutBalance - (stats ? stats.totalDistributed : 0)).toFixed(2)} SUT</span>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '15px', color: '#FFF', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                <BarChart3 size={18} color="#EF4444" />
                활성 매니저 자산 현황
              </h3>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <Loader2 size={24} className="spin" style={{ margin: '0 auto 10px', color: 'var(--primary-color)' }} />
                </div>
              ) : managers.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>등록된 매니저가 존재하지 않습니다.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {managers.map((m) => {
                    const isMaster = m.wallet_address.toLowerCase() === '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase();
                    return (
                      <div key={m.wallet_address} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isMaster ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '14px' }}>
                              {isMaster ? '⭐' : '👤'}
                            </div>
                            <div>
                              <div style={{ fontSize: '14px', color: '#FFF', fontWeight: 'bold' }}>{m.name}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{m.email}</div>
                            </div>
                          </div>
                          <div style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#A78BFA', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                            {m.userCount}명 소속
                          </div>
                        </div>

                        <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>매니저 SUT (온체인)</div>
                            <div style={{ fontSize: '13px', color: '#10B981', fontWeight: 'bold' }}>{parseFloat(m.onchainBalance || 0).toLocaleString()} SUT</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>회원 총 자산 (온체인)</div>
                            <div style={{ fontSize: '13px', color: '#FFF', fontWeight: 'bold' }}>{parseFloat(m.performance || 0).toLocaleString()} SUT</div>
                          </div>
                        </div>

                        {!isMaster && (
                          <button
                            onClick={() => handleDeleteManager(m.wallet_address, m.name)}
                            disabled={submittingDelete === m.wallet_address}
                            style={{ marginTop: '12px', width: '100%', padding: '10px', fontSize: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                          >
                            {submittingDelete === m.wallet_address ? <Loader2 size={14} className="spin" /> : <><Trash2 size={14} /> 계정 삭제 및 이관</>}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
              <h4 style={{ fontSize: '15px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} color="#8B5CF6" />
                신규 매니저 승격
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                승격할 회원은 반드시 가입된 정회원이어야 합니다.
              </p>

              <form onSubmit={handlePromoteManager} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="text"
                  value={promoteWallet}
                  onChange={(e) => setPromoteWallet(e.target.value)}
                  placeholder="지갑 주소 (0x...)"
                  className="form-input"
                  style={{ padding: '14px', fontSize: '13px' }}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingPromote}
                  style={{ width: '100%', padding: '14px', fontSize: '14px' }}
                >
                  {submittingPromote ? <Loader2 size={16} className="spin" /> : '🚀 정식 매니저 승격'}
                </button>
              </form>
            </div>

          </div>
        )}

        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
              <h4 style={{ fontSize: '15px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🤖</span> 글로벌 AI 엔진 제어
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                모든 매니저 오토 봇의 공동 판단 두뇌가 되는 AI 모델의 설정을 관리합니다.
              </p>

              <form onSubmit={handleSaveAiConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>사용할 AI 모델</label>
                  <select
                    className="form-select"
                    value={globalAiModel}
                    onChange={(e) => setGlobalAiModel(e.target.value)}
                    style={{ padding: '14px', fontSize: '13px' }}
                  >
                    <option value="Gemini 3.5 Flash">Gemini 3.5 Flash (입력 $0.075 / 출력 $0.30 / 1M 토큰)</option>
                    <option value="Gemini 2.5 Pro">Gemini 2.5 Pro (입력 $1.25 / 출력 $5.00 / 1M 토큰)</option>
                    <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (입력 $0.075 / 출력 $0.30 / 1M 토큰)</option>
                    <option value="Gemini 3.1 Flash Lite">Gemini 3.1 Flash Lite (입력 $0.0375 / 출력 $0.15 / 1M 토큰)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>Gemini API Key</label>
                  <input
                    type="password"
                    value={globalGeminiApiKey}
                    onChange={(e) => setGlobalGeminiApiKey(e.target.value)}
                    placeholder="AI_..."
                    className="form-input"
                    style={{ padding: '14px', fontSize: '13px' }}
                  />
                  <div style={{ fontSize: '10px', color: 'var(--danger-color)', marginTop: '6px' }}>
                    * 보안 유지를 위해 서버 DB에 영구 저장됩니다.
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>AI 분석 주기 (의미 인식 간격)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', opacity: globalAiIntervalAuto === 'ON' ? 0.4 : 1, pointerEvents: globalAiIntervalAuto === 'ON' ? 'none' : 'auto' }}>
                    {['1', '3', '5', '10', '15', '30', '60'].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        disabled={globalAiIntervalAuto === 'ON'}
                        onClick={() => setGlobalAiInterval(mins)}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: globalAiIntervalAuto === 'ON' ? 'not-allowed' : 'pointer',
                          border: globalAiInterval === mins ? '1px solid #3B82F6' : '1px solid rgba(255,255,255,0.1)',
                          background: globalAiInterval === mins ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.2)',
                          color: globalAiInterval === mins ? '#60A5FA' : '#9CA3AF',
                          transition: 'all 0.2s'
                        }}
                      >
                        {mins}분
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '12px' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '12px', color: '#FFF', fontWeight: 'bold' }}>⚡ AI 분석 주기 자동 최적화</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>시장 변동성에 맞춰 5m/15m/30m 자동 전환</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={globalAiIntervalAuto === 'ON'}
                      onChange={(e) => setGlobalAiIntervalAuto(e.target.checked ? 'ON' : 'OFF')}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3B82F6' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingAiConfig}
                  style={{ width: '100%', padding: '14px', fontSize: '14px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
                >
                  {savingAiConfig ? <Loader2 size={16} className="spin" /> : '💾 글로벌 AI 설정 저장'}
                </button>
              </form>
            </div>

            <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(139, 92, 246, 0.25)', marginTop: '20px' }}>
              <h4 style={{ fontSize: '15px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🧠</span> AiS 엔진 모드 및 학습 관리
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 16px 0', textAlign: 'left' }}>
                매매를 집행할 메인 AI 엔진 모드를 지정하고 백그라운드 학습용 데이터셋(SQLite 및 CSV) 상태를 모니터링합니다.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>작동 엔진 선택</label>
                  <select
                    value={globalAiEngine}
                    onChange={(e) => handleSaveAiEngine(e.target.value)}
                    disabled={savingAiEngine}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#FFF', outline: 'none' }}
                  >
                    <option value="GEMINI_ONLY" style={{ background: '#1A1825', color: '#FFF' }}>Gemini 단독 가동 모드</option>
                    <option value="GEMINI_AIS_SHADOW" style={{ background: '#1A1825', color: '#FFF' }}>Gemini (매매) + AiS (Shadow 학습) [기본]</option>
                    <option value="HYBRID_COOP" style={{ background: '#1A1825', color: '#FFF' }}>Gemini + AiS 공동 합의 매매 모드</option>
                    <option value="AIS_ONLY" style={{ background: '#1A1825', color: '#FFF' }}>AiS 독자 모델 매매 모드 (성능 테스트)</option>
                  </select>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><b>학습 데이터셋 누적 건수:</b></span>
                    <span style={{ color: '#A78BFA', fontWeight: 'bold', fontSize: '12px' }}>{trainingDataCount.toLocaleString()} 건</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><b>최근 자동 학습 완료 시각:</b></span>
                    <span style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: '11px' }}>{aisLastTrainedAt ? aisLastTrainedAt : '학습 전 (대기 중)'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><b>AiS 모델 검증 정확도:</b></span>
                    <span style={{ color: '#10B981', fontWeight: 'bold', fontSize: '11px' }}>{aisModelAccuracy}%</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dark)', marginTop: '4px' }}>
                    * 매 5분 틱마다 시장 지표(RSI_14, SMA_5/20) 및 사후 채점(next_price) 피드백이 실시간 자동 빌드되어 SQLite DB에 무제한 누적됩니다.
                  </div>
                </div>

                <AisTrainingEvidence stats={aisTrainingStats} />

                <button
                  type="button"
                  onClick={() => downloadAuthenticatedFile(
                    `${API_BASE}/admin/export-training-csv`,
                    'ais_training_dataset.csv'
                  )}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '6px',
                    width: '100%',
                    padding: '14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                    color: '#FFF',
                    textDecoration: 'none',
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)'
                  }}
                >
                  📥 AI 학습용 CSV 데이터셋 다운로드
                </button>
              </div>
            </div>

            {/* 🤖 AI 틱 결정 히스토리 내역 섹션 */}
            <div className="glass-card" style={{ padding: '16px', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.02) 0%, rgba(20, 16, 45, 0.3) 100%)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ padding: '6px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)' }}>
                    <Receipt size={16} color="#A78BFA" />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ fontSize: '13px', color: '#F3F4F6', margin: 0, fontWeight: '700' }}>🤖 AI 틱별 결정 히스토리 (최대 50개)</h3>
                    <p style={{ fontSize: '9px', color: 'var(--text-muted)', margin: '1px 0 0 0' }}>AI 엔진이 매 틱마다 판단한 세부 의사결정 이력입니다.</p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.3)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  {['ALL', 'BUY', 'SELL', 'HOLD'].map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setHistoryFilter(filter)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        background: historyFilter === filter ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                        color: historyFilter === filter ? '#A78BFA' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {filter === 'ALL' ? '전체' : filter === 'BUY' ? '매수' : filter === 'SELL' ? '매도' : '관망'}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const filteredLogs = aiLogs.filter(log => {
                  if (historyFilter === 'ALL') return true;
                  return log.decision === historyFilter;
                });

                if (filteredLogs.length === 0) {
                  return (
                    <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '11px' }}>
                      📭 선택한 필터 조건에 해당하는 AI 결정 내역이 없습니다.
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                    {filteredLogs.map((log, index) => {
                      let badgeColor = 'var(--text-muted)';
                      let badgeBg = 'rgba(255,255,255,0.05)';
                      let borderCol = 'rgba(255,255,255,0.05)';

                      if (log.decision === 'BUY') {
                        badgeColor = 'var(--success-color)';
                        badgeBg = 'rgba(16, 185, 129, 0.1)';
                        borderCol = 'rgba(16, 185, 129, 0.15)';
                      } else if (log.decision === 'SELL') {
                        badgeColor = 'var(--danger-color)';
                        badgeBg = 'rgba(239, 68, 68, 0.1)';
                        borderCol = 'rgba(239, 68, 68, 0.15)';
                      } else if (log.decision === 'HOLD') {
                        badgeColor = '#F59E0B';
                        badgeBg = 'rgba(245, 158, 11, 0.1)';
                        borderCol = 'rgba(245, 158, 11, 0.15)';
                      }

                      return (
                        <div
                          key={log.id || index}
                          style={{
                            background: 'rgba(0,0,0,0.2)',
                            border: `1px solid ${borderCol}`,
                            borderRadius: '8px',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            textAlign: 'left',
                            transition: 'transform 0.2s, background 0.2s',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.03)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                fontSize: '9px',
                                fontWeight: 'bold',
                                color: badgeColor,
                                background: badgeBg,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                border: `1px solid ${borderCol}`
                              }}>
                                {log.decision === 'BUY' ? '🟢 매수' : log.decision === 'SELL' ? '🔴 매도' : '🟡 관망'}
                              </span>
                              
                              {log.decision !== 'HOLD' && (
                                <span style={{ fontSize: '10px', color: '#E5E7EB', fontWeight: 'bold' }}>
                                  {log.proposed_price.toFixed(4)} USDT / {log.proposed_amount.toFixed(2)} SUT 추천
                                </span>
                              )}
                            </div>
                            
                            <span style={{ fontSize: '8px', color: 'var(--text-dark)', fontFamily: 'monospace' }}>
                              {formatKoreanDateTime(log.created_at)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px', fontSize: '10px' }}>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '9px' }}>
                              <div>추천 밴드 범위: <span style={{ color: '#E5E7EB', fontWeight: '600' }}>{(log.proposed_lower || 0.15).toFixed(4)} ~ {(log.proposed_upper || 0.30).toFixed(4)} USDT</span></div>
                            </div>
                            <div style={{ fontSize: '10px', color: '#D1D5DB', lineHeight: '1.4', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '6px' }}>
                              {log.reason}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

          </div>
        )}

        {activeTab === 'council' && (
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
                  
                  {/* 1. 게이지 */}
                  <div>
                    <h4 style={{ fontSize: '12px', color: '#FFF', margin: '0 0 10px 0', fontWeight: '700' }}>
                      📊 500인 후보군 분파별 점유율
                    </h4>
                    <div style={{ display: 'flex', height: '20px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {councilStats.factionStats.map((f) => {
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
                              transition: 'width 0.5s ease-in-out'
                            }}
                            title={`${f.faction}: ${f.count}석 (${f.percentage}%)`}
                          >
                            {f.percentage >= 12 ? `${f.percentage}%` : ''}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* 범례 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                      {[
                        { key: 'TREND_FOLLOWER', label: '추세추종파 (SMA/모멘텀)', color: '#EF4444' },
                        { key: 'VALUE_SEEKER', label: '기술반등파 (RSI/역추세)', color: '#3B82F6' },
                        { key: 'CONSERVATIVE_WATCHER', label: '변동성방어파 (안정지향)', color: '#10B981' },
                        { key: 'MUTANT_ROOKIE', label: '돌연변이 혁신파 (알고리즘)', color: '#8B5CF6' }
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

                  {/* 500인 후보군의 특징 분석 */}
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
                      <div style={{ wordBreak: 'keep-all', whiteSpace: 'pre-line' }}>{councilStats.briefing}</div>
                    </div>
                  )}

                  {/* 2. 탑 11인 */}
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
                          borderCol = 'rgba(239, 68, 68, 0.2)';
                          badgeBg = 'rgba(239, 68, 68, 0.05)';
                          factionColor = '#EF4444';
                          factionName = '추세추종';
                        } else if (member.faction === 'VALUE_SEEKER') {
                          borderCol = 'rgba(59, 130, 246, 0.2)';
                          badgeBg = 'rgba(59, 130, 246, 0.05)';
                          factionColor = '#3B82F6';
                          factionName = '기술반등';
                        } else if (member.faction === 'CONSERVATIVE_WATCHER') {
                          borderCol = 'rgba(16, 185, 129, 0.2)';
                          badgeBg = 'rgba(16, 185, 129, 0.05)';
                          factionColor = '#10B981';
                          factionName = '변동방어';
                        } else if (member.faction === 'MUTANT_ROOKIE') {
                          borderCol = 'rgba(139, 92, 246, 0.2)';
                          badgeBg = 'rgba(139, 92, 246, 0.05)';
                          factionColor = '#8B5CF6';
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

                  {/* 3. 최근 의결 투표 흐름 */}
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
          </div>
        )}

      </main>

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        background: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '12px 0 24px 0',
        zIndex: 100
      }}>
        <button
          onClick={() => setActiveTab('home')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'home' ? '#8B5CF6' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Home size={22} />
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>자산관제</span>
        </button>

        <button
          onClick={() => setActiveTab('council')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'council' ? '#8B5CF6' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Users size={22} />
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>AI 의회</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'settings' ? '#8B5CF6' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Settings size={22} />
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>AI 제어</span>
        </button>
      </div>
    </div>
  );
}

export default AdminDashboard;
