import React from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../App';
import {
  ShieldAlert, ShieldCheck, Users, Wallet, Trash2, UserPlus,
  ArrowLeft, BarChart3, HelpCircle, Loader2, Receipt
} from 'lucide-react';
import { useAdminLogic } from '../hooks/useAdminLogic';

function PcAdminDashboard({ walletAddress, managerEmail }) {
  const navigate = useNavigate();
  const [historyFilter, setHistoryFilter] = React.useState('ALL');

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
    savingAiEngine,
    handleSaveAiEngine
  } = useAdminLogic(managerEmail);




  if (!isAdmin) {
    return (
      <div className="pc-layout-wrapper" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="glass-card" style={{ maxWidth: '480px', padding: '36px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
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
    <div className="pc-layout-wrapper admin-layout-wrapper" style={{ padding: '40px 50px', flexDirection: 'column', gap: '30px', alignItems: 'stretch' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '22px' }}>
            👑
          </div>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ fontSize: '22px', color: '#FFF', margin: 0, fontWeight: '800' }}>👑 최고 관리자(Admin) 제어 센터</h1>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>🔑 플랫폼 전체 매니저 자산 현황 조회 및 승격/삭제 통제소</span>
          </div>
        </div>

        <button
          className="btn-secondary"
          onClick={() => navigate('/dashboard')}
          style={{ width: 'auto', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', gap: '8px', fontWeight: '700' }}
        >
          <ArrowLeft size={18} />
          대시보드로 복귀
        </button>
      </div>

      <div className="admin-content-row" style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', width: '100%' }}>

        <div className="admin-col-left" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '24px', flexShrink: 0 }}>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-gradient)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '16px', fontWeight: 'bold', color: '#FFF' }}>
                A
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: '15px', color: '#FFF', margin: 0 }}>이명학 총괄 관리자 (Platform Owner)</h4>
                <span style={{ fontSize: '11px', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontWeight: '700' }}>
                  <ShieldCheck size={12} /> 최고 보안 인증 가동 중
                </span>
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
              <div><b>어드민 이메일:</b> {managerEmail}</div>
              <div><b>지갑 주소:</b> <span style={{ fontFamily: 'monospace' }}>{walletAddress}</span></div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <h4 style={{ fontSize: '15px', color: '#FFF', margin: '0 0 16px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🏢</span> 본사 SUT 자산 현황
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '8px' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>본사 보유 자산 (수익 - 실시간)</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#10B981', marginTop: '4px' }}>
                    {(vaultSutBalance - (stats ? stats.totalDistributed : 0)).toFixed(2)} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>SUT</span>
                  </div>
                </div>
                <span style={{ fontSize: '10px', color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>실시간 본사 보유고</span>
              </div>
            </div>
          </div>



          <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
            <h4 style={{ fontSize: '15px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🤖</span> 글로벌 AI 엔진 제어
            </h4>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 16px 0', textAlign: 'left' }}>
              플랫폼에 가입된 모든 매니저 오토 봇의 공동 판단 두뇌가 되는 AI 모델의 API Key를 설정합니다. 이 키는 안전하게 서버 DB에 영구 저장됩니다.
            </p>

            <form onSubmit={handleSaveAiConfig} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textAlign: 'left' }}>사용할 AI 모델</label>
                <select
                  value={globalAiModel}
                  onChange={(e) => setGlobalAiModel(e.target.value)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#FFF', outline: 'none' }}
                >
                  <option value="Gemini 3.5 Flash" style={{ background: '#1A1825', color: '#FFF' }}>Gemini 3.5 Flash (Latest/Ultra-fast)</option>
                  <option value="Gemini 2.5 Pro" style={{ background: '#1A1825', color: '#FFF' }}>Gemini 2.5 Pro (Ultra-high Performance/Inference)</option>
                  <option value="Gemini 2.5 Flash" style={{ background: '#1A1825', color: '#FFF' }}>Gemini 2.5 Flash (Basic/Fast)</option>
                  <option value="Gemini 3.1 Flash Lite" style={{ background: '#1A1825', color: '#FFF' }}>Gemini 3.1 Flash Lite (Lightweight/Ultra-fast)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textAlign: 'left' }}>Gemini API Key</label>
                <input
                  type="password"
                  value={globalGeminiApiKey}
                  onChange={(e) => setGlobalGeminiApiKey(e.target.value)}
                  placeholder="AI-Studio에서 발급받은 API Key를 붙여넣으세요"
                  style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#FFF', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textAlign: 'left' }}>AI 분석 주기 (분)</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['1', '3', '5', '10', '15', '30', '60'].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setGlobalAiInterval(mins)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
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
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={savingAiConfig}
                style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 'bold', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
              >
                {savingAiConfig ? <Loader2 size={16} className="spin" /> : '💾 글로벌 AI 설정 저장'}
              </button>
            </form>
          </div>

          <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
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
                  style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#FFF', outline: 'none' }}
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

              <a
                href={`${API_BASE}/admin/export-training-csv?x-admin-email=lemaiiisk@gmail.com`}
                download="ais_training_dataset.csv"
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '12px',
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
              </a>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
            <h4 style={{ fontSize: '15px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={20} color="#8B5CF6" />
              신규 매니저 승격 관리
            </h4>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 16px 0', textAlign: 'left' }}>
              승격할 회원은 반드시 기가입된 정회원(`APPROVED`) 상태여야 합니다. 승격 시 기존 매니저 하위 관계가 끊어지고 독립 매니저가 됩니다.
            </p>

            <form onSubmit={handlePromoteManager} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textAlign: 'left' }}>회원 지갑 주소 (Wallet Address)</label>
                <input
                  type="text"
                  value={promoteWallet}
                  onChange={(e) => setPromoteWallet(e.target.value)}
                  placeholder="0x로 시작하는 지갑 주소 입력"
                  style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#FFF', outline: 'none' }}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={submittingPromote}
                style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 'bold', background: 'var(--primary-gradient)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
              >
                {submittingPromote ? <Loader2 size={16} className="spin" /> : '🚀 정식 매니저로 승격'}
              </button>
            </form>
          </div>

          <div className="glass-card" style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
            <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 8px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={16} color="var(--danger-color)" /> 매니저 통제 안전 가이드
            </h4>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0, textAlign: 'left' }}>
              매니저 강등(Demote)은 지원하지 않습니다. 해지 시에는 계정 삭제(Delete) 처리만 가능하며, 삭제 시 산하 회원들의 이탈 방지를 위해 최초 마스터 지갑으로 이관되도록 구조화되어 있습니다.
            </p>
          </div>

        </div>

        <div className="admin-col-right" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>

          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', color: '#FFF', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '800' }}>
              <BarChart3 size={20} color="#EF4444" />
              활성 매니저 자산 및 회원 관리 보드 ({managers.length}명)
            </h3>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '50px 0' }}>
                <Loader2 size={32} className="spin" style={{ margin: '0 auto 10px', color: 'var(--primary-color)' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>매니저 자금 장부를 확인하는 중입니다...</p>
              </div>
            ) : managers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '50px 0' }}>등록된 매니저가 존재하지 않습니다.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '11px' }}>
                      <th style={{ padding: '12px 8px' }}>매니저 정보</th>
                      <th style={{ padding: '12px 8px' }}>지갑 주소</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>매니저 SUT (온체인)</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>소속 회원 SUT 총액 (온체인)</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>소속 회원</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managers.map((m) => {
                      const isMaster = m.wallet_address.toLowerCase() === '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase();
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '12px', color: '#E5E7EB' }}>
                          <td style={{ padding: '16px 8px' }}>
                            <div style={{ fontWeight: 'bold', color: '#FFF' }}>
                              {m.name} {isMaster && <span style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger-color)', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>MASTER</span>}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{m.email}</div>
                          </td>
                          <td style={{ padding: '16px 8px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-dark)' }}>
                            {m.wallet_address.substring(0, 8)}...{m.wallet_address.substring(34)}
                          </td>
                          <td style={{ padding: '16px 8px', textAlign: 'right', fontWeight: '700', color: 'var(--primary-color)' }}>
                            {parseFloat(m.onchainBalance).toLocaleString()} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SUT</span>
                          </td>
                          <td style={{ padding: '16px 8px', textAlign: 'right', fontWeight: '700', color: 'var(--success-color)' }}>
                            {parseFloat(m.performance).toLocaleString()} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SUT</span>
                          </td>
                          <td style={{ padding: '16px 8px', textAlign: 'center', fontWeight: 'bold' }}>
                            {m.userCount} 명
                          </td>
                          <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                            {isMaster ? (
                              <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>삭제 불가</span>
                            ) : (
                              <button
                                className="btn-secondary"
                                onClick={() => handleDeleteManager(m.wallet_address, m.name)}
                                disabled={submittingDelete === m.wallet_address}
                                style={{ padding: '6px 10px', background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger-color)', width: 'auto', borderRadius: '8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                {submittingDelete === m.wallet_address ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                                삭제
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>

          {/* 🤖 AI 틱 결정 히스토리 내역 섹션 (PC 최적화) */}
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.02) 0%, rgba(20, 16, 45, 0.3) 100%)', border: '1px solid rgba(139, 92, 246, 0.25)', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Receipt size={20} color="#A78BFA" />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', color: '#F3F4F6', margin: 0, fontWeight: '800' }}>🤖 AI 틱별 결정 히스토리 (최대 50개)</h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>AI 엔진이 매 틱마다 분석하여 제안한 가격, 주문 수량 및 매매 의사결정 원인 분석 이력입니다.</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.3)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                {['ALL', 'BUY', 'SELL', 'HOLD'].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setHistoryFilter(filter)}
                    style={{
                      padding: '6px 14px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      borderRadius: '6px',
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
                  <div style={{ padding: '50px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '13px' }}>
                    📭 선택한 필터 조건에 해당하는 AI 결정 내역이 없습니다.
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto', paddingRight: '6px' }}>
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
                          borderRadius: '10px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 'bold',
                              color: badgeColor,
                              background: badgeBg,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: `1px solid ${borderCol}`
                            }}>
                              {log.decision === 'BUY' ? '🟢 매수' : log.decision === 'SELL' ? '🔴 매도' : '🟡 관망'}
                            </span>
                            
                            {log.decision !== 'HOLD' && (
                              <span style={{ fontSize: '12px', color: '#E5E7EB', fontWeight: 'bold' }}>
                                {log.proposed_price.toFixed(4)} USDT / {log.proposed_amount.toFixed(2)} SUT 추천
                              </span>
                            )}
                          </div>
                          
                          <span style={{ fontSize: '10px', color: 'var(--text-dark)', fontFamily: 'monospace' }}>
                            {(() => {
                              const dateStr = String(log.created_at || '').replace(' ', 'T') + 'Z';
                              const dateObj = new Date(dateStr);
                              if (isNaN(dateObj.getTime())) return log.created_at;
                              const kstFormatted = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;
                              return kstFormatted;
                            })()}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px', fontSize: '11px' }}>
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '10px' }}>
                            <div>추천 밴드 범위: <span style={{ color: '#E5E7EB', fontWeight: '600' }}>{(log.proposed_lower || 0.15).toFixed(4)} ~ {(log.proposed_upper || 0.30).toFixed(4)} USDT</span></div>
                          </div>
                          <div style={{ fontSize: '11px', color: '#D1D5DB', lineHeight: '1.5', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px' }}>
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

      </div>

    </div>
  );
}

export default PcAdminDashboard;
