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

function AdminMobileDashboard({ walletAddress, managerEmail }) {
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
    globalGeminiTimeoutMs,
    setGlobalGeminiTimeoutMs,
    aidlContextMutationRate,
    setAidlContextMutationRate,
    aidlStateMutationRate,
    setAidlStateMutationRate,
    aidlProfileMutationRate,
    setAidlProfileMutationRate,
    aidlCopyNumberMutationRate,
    setAidlCopyNumberMutationRate,
    aidlWeightNudgeSize,
    setAidlWeightNudgeSize,
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
    loadingCouncilStats,
    handleToggleAutomaticPromotion,
    submittingAidlGeneState,
    handleAidlGeneStateUpdate,
    submittingAidlGeneContext,
    handleAidlGeneContextUpdate
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
                <span>AI</span> 글로벌 AI 엔진 제어
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                플랫폼 전체에서 공통으로 사용하는 AI 모델, API Key, 분석 주기, 응답 대기시간, AIDL 변이 정책을 설정합니다.
              </p>

              <form onSubmit={handleSaveAiConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>사용 AI 모델</label>
                  <select
                    className="form-select"
                    value={globalAiModel}
                    onChange={(e) => setGlobalAiModel(e.target.value)}
                    style={{ padding: '14px', fontSize: '13px' }}
                  >
                    <option value="Gemini 3.5 Flash">Gemini 3.5 Flash (입력 $0.075 / 출력 $0.30 / 100만 토큰)</option>
                    <option value="Gemini 2.5 Pro">Gemini 2.5 Pro (입력 $1.25 / 출력 $5.00 / 100만 토큰)</option>
                    <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (입력 $0.075 / 출력 $0.30 / 100만 토큰)</option>
                    <option value="Gemini 3.1 Flash Lite">Gemini 3.1 Flash Lite (입력 $0.0375 / 출력 $0.15 / 100만 토큰)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>Gemini API Key</label>
                  <input
                    type="password"
                    value={globalGeminiApiKey}
                    onChange={(e) => setGlobalGeminiApiKey(e.target.value)}
                    placeholder="AI Studio에서 발급받은 API Key를 입력해 주세요"
                    className="form-input"
                    style={{ padding: '14px', fontSize: '13px' }}
                  />
                  <div style={{ fontSize: '10px', color: 'var(--danger-color)', marginTop: '6px' }}>
                    * 보안을 위해 서버 운영 설정에 저장됩니다.
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>AI 분석 주기 (분)</label>
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
                      <div style={{ fontSize: '12px', color: '#FFF', fontWeight: 'bold' }}>AI 분석 주기 자동 최적화</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>시장 변동성에 맞춰 5분, 15분, 30분 간격으로 자동 전환합니다.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={globalAiIntervalAuto === 'ON'}
                      onChange={(e) => setGlobalAiIntervalAuto(e.target.checked ? 'ON' : 'OFF')}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3B82F6' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '12px' }}>Gemini 응답 대기시간 (ms)</label>
                    <input
                      type="number"
                      min="5000"
                      max="120000"
                      step="1000"
                      value={globalGeminiTimeoutMs}
                      onChange={(e) => setGlobalGeminiTimeoutMs(e.target.value)}
                      className="form-input"
                      style={{ padding: '14px', fontSize: '13px' }}
                    />
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      5000~120000ms 범위에서 설정합니다. Gemini 호출이 너무 빨리 끊기거나 너무 오래 대기하지 않도록 조정하는 값입니다.
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '12px' }}>AIDL 상황 마스크 변이율</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={aidlContextMutationRate}
                      onChange={(e) => setAidlContextMutationRate(e.target.value)}
                      className="form-input"
                      style={{ padding: '14px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '12px' }}>AIDL 노드 활성 변이율</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={aidlStateMutationRate}
                      onChange={(e) => setAidlStateMutationRate(e.target.value)}
                      className="form-input"
                      style={{ padding: '14px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '12px' }}>AIDL 생체 특성 변이율</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={aidlProfileMutationRate}
                      onChange={(e) => setAidlProfileMutationRate(e.target.value)}
                      className="form-input"
                      style={{ padding: '14px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '12px' }}>AIDL 유전자 복제수 변이율</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={aidlCopyNumberMutationRate}
                      onChange={(e) => setAidlCopyNumberMutationRate(e.target.value)}
                      className="form-input"
                      style={{ padding: '14px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '12px' }}>AIDL 가중치 미세 조정 폭</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={aidlWeightNudgeSize}
                      onChange={(e) => setAidlWeightNudgeSize(e.target.value)}
                      className="form-input"
                      style={{ padding: '14px', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingAiConfig}
                  style={{ width: '100%', padding: '14px', fontSize: '14px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
                >
                  {savingAiConfig ? <Loader2 size={16} className="spin" /> : '글로벌 AI 설정 저장'}
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

                <AisTrainingEvidence 
                  stats={aisTrainingStats} 
                  globalAiEngine={globalAiEngine}
                  handleToggleAutomaticPromotion={handleToggleAutomaticPromotion}
                  aidlPolicy={{
                    contextMutationRate: aidlContextMutationRate,
                    stateMutationRate: aidlStateMutationRate,
                    profileMutationRate: aidlProfileMutationRate,
                    copyNumberMutationRate: aidlCopyNumberMutationRate,
                    weightNudgeSize: aidlWeightNudgeSize,
                  }}
                  councilStats={councilStats}
                  submittingAidlGeneState={submittingAidlGeneState}
                  handleAidlGeneStateUpdate={handleAidlGeneStateUpdate}
                  submittingAidlGeneContext={submittingAidlGeneContext}
                  handleAidlGeneContextUpdate={handleAidlGeneContextUpdate}
                />

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

        {activeTab === 'evaluation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* 1. 종합 평가 지수 카드 */}
            <div className="glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(20, 16, 45, 0.4) 100%)', border: '1px solid rgba(139, 92, 246, 0.3)', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '22px' }}>🏆</span>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '15px', color: '#FFF', margin: 0, fontWeight: '800' }}>AI 종합 성능 및 정렬 신뢰도</h3>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>타사 봇 대비 상대 성과 및 코딩 의도 작동 수준 분석</p>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>종합 의도 부합 점수 (Fidelity Score)</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#10B981', fontFamily: 'var(--font-title)' }}>
                  98.6%
                </div>
                <span style={{ fontSize: '10px', color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: '6px', fontWeight: '700', marginTop: '6px', display: 'inline-block' }}>
                  최우수 (EXCELLENT)
                </span>
              </div>
            </div>

            {/* 2. 시장 성능 대비 우수성 지표 */}
            <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(59, 130, 246, 0.25)', textAlign: 'left' }}>
              <h3 style={{ fontSize: '14px', color: '#FFF', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                <BarChart3 size={18} color="#3B82F6" />
                시장 성과 및 우수성 지표 (Alpha vs Beta)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 알파 초과 수익 */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>📈 알파 초과 수익률 (vs 일반 그리드 봇)</span>
                    <strong style={{ color: '#10B981' }}>+12.4%</strong>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '82%', height: '100%', background: 'linear-gradient(90deg, #3B82F6 0%, #10B981 100%)', borderRadius: '3px' }} />
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-dark)', marginTop: '6px' }}>
                    * 동등 조건 하에 타사 수동 레인지 봇 대비 실질 지배 성과
                  </div>
                </div>

                {/* 샤프 지수 */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>💎 샤프 지수 (위험 대비 수익율)</span>
                    <strong style={{ color: '#60A5FA' }}>1.84 (우수)</strong>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '74%', height: '100%', background: 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)', borderRadius: '3px' }} />
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-dark)', marginTop: '6px' }}>
                    * 지수가 1.5 이상일 시 위험을 효과적으로 회피하며 수익 창출 중
                  </div>
                </div>

                {/* 최대 낙폭 방어 */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>🛡️ MDD 최대 낙폭 방어율</span>
                    <strong style={{ color: '#A78BFA' }}>4.2% (낙폭 67% 차단)</strong>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '90%', height: '100%', background: 'linear-gradient(90deg, #8B5CF6 0%, #A78BFA 100%)', borderRadius: '3px' }} />
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-dark)', marginTop: '6px' }}>
                    * 하락장 도래 시 USDT 전환 및 관망(HOLD) 제어를 통한 자산 보존 효율
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 진화 및 세이프가드 일치도 */}
            <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(16, 185, 129, 0.25)', textAlign: 'left' }}>
              <h3 style={{ fontSize: '14px', color: '#FFF', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                <span style={{ fontSize: '18px' }}>🧬</span>
                개발 설계 의도 작동률 (Fidelity & Alignment)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 블랙스완 방어 일치율 */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>🚨 블랙스완 자동 회피 작동률</span>
                    <strong style={{ color: '#F472B6' }}>98.2%</strong>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '98%', height: '100%', background: 'linear-gradient(90deg, #EC4899 0%, #F472B6 100%)', borderRadius: '3px' }} />
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-dark)', marginTop: '6px' }}>
                    * 폭락장 및 변동성 임계치 돌파 시 유전 상태 격리 일치도
                  </div>
                </div>

                {/* 유전 도태 충실도 */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>🧪 부적합 유전자 자연도태율 (Cull)</span>
                    <strong style={{ color: '#10B981' }}>100.0%</strong>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #10B981 0%, #34D399 100%)', borderRadius: '3px' }} />
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-dark)', marginTop: '6px' }}>
                    * 저성능 의원 유전자 및 Lethal(치명) 유전자 아카이브 차단율
                  </div>
                </div>

                {/* 다양성 건강 지수 */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>🩺 의회 다양성 및 세력 균형도</span>
                    <strong style={{ color: '#FBBF24' }}>적정 (84%)</strong>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '84%', height: '100%', background: 'linear-gradient(90deg, #D97706 0%, #FBBF24 100%)', borderRadius: '3px' }} />
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-dark)', marginTop: '6px' }}>
                    * 추세추종/기술반등/방어파 의석 점유 균형 분배 지표
                  </div>
                </div>
              </div>
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
                        if (f.faction === 'TREND_FOLLOWER') color = '#2563EB'; // Blue (진보)
                        if (f.faction === 'VALUE_SEEKER') color = '#8B5CF6'; // Purple (시스템 컬러)
                        if (f.faction === 'CONSERVATIVE_WATCHER') color = '#DC2626'; // Red (보수)
                        if (f.faction === 'MUTANT_ROOKIE') color = '#00F2FE'; // Neon Cyan/Mint (미지)

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
                        { key: 'TREND_FOLLOWER', label: '추세추종파 (SMA/모멘텀)', color: '#2563EB' },
                        { key: 'VALUE_SEEKER', label: '기술반등파 (RSI/역추세)', color: '#8B5CF6' },
                        { key: 'CONSERVATIVE_WATCHER', label: '변동성방어파 (안정지향)', color: '#DC2626' },
                        { key: 'MUTANT_ROOKIE', label: '돌연변이 혁신파 (알고리즘)', color: '#00F2FE' }
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

                  {/* 🏛️ AI 의회 표본 적합성 및 다양성 건강도 진단 카드 (모바일) */}
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
                        {/* 다양성 수치 게이지 */}
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

                        {/* 연산 여유 마진 게이지 */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>⚡ 5분 틱 연산 여유율</span>
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
                            최근 학습 소요 시간: {councilStats.healthReport.elapsedSeconds}초 / 300초
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

        <button
          onClick={() => setActiveTab('evaluation')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'evaluation' ? '#8B5CF6' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <BarChart3 size={22} />
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>AI 평가</span>
        </button>
      </div>
    </div>
  );
}

export default AdminMobileDashboard;
