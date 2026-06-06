import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, ShieldCheck, Users, Wallet, Trash2, UserPlus,
  ArrowLeft, BarChart3, Loader2, Home, Settings
} from 'lucide-react';
import { useAdminLogic } from '../hooks/useAdminLogic';

function AdminDashboard({ walletAddress, managerEmail }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');

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
    stats
  } = useAdminLogic(managerEmail);


  if (!isAdmin) {
    return (
      <div className="app-frame" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div className="glass-card" style={{ width: '100%', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', marginBottom: '20px' }}>
            <ShieldAlert size={48} color="var(--danger-color)" />
          </div>
          <h2 style={{ fontSize: '20px', color: '#FFF', fontWeight: '800', marginBottom: '12px' }}>Access Permission Security Restriction</h2>
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
            👑 어드민 센터
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
              <h4 style={{ fontSize: '15px', color: '#FFF', margin: 0 }}>Platform Owner</h4>
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
                🏢 본사 SUT 자산 통합 통제 보드
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>회원 총 운용 자산 (수납 - 온체인):</span>
                  <span style={{ color: '#A78BFA', fontWeight: '700' }}>{vaultSutBalance.toFixed(2)} SUT</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>본사 보유 자산 (수익 - 실시간):</span>
                  <span style={{ color: '#10B981', fontWeight: '700' }}>{(vaultSutBalance - (stats ? stats.totalDistributed : 0)).toFixed(2)} SUT</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>회원 누적 배분액 (출금 완료):</span>
                  <span style={{ color: '#F59E0B', fontWeight: '700' }}>{stats ? stats.totalDistributed.toFixed(2) : '0.00'} SUT</span>
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
                    <option value="Gemini 2.0 Flash">Gemini 2.0 Flash (최신/초고속)</option>
                    <option value="Gemini 1.5 Pro">Gemini 1.5 Pro (고성능 추론)</option>
                    <option value="Gemini 3.5 Flash">Gemini 3.5 Flash (예상 모델)</option>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {['1', '3', '5', '10', '15', '30', '60'].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setGlobalAiInterval(mins)}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          fontSize: '13px',
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
                  style={{ width: '100%', padding: '14px', fontSize: '14px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
                >
                  {savingAiConfig ? <Loader2 size={16} className="spin" /> : '💾 글로벌 AI 설정 저장'}
                </button>
              </form>
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
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'home' ? '#8B5CF6' : 'var(--text-muted)', background: 'none', border: 'none' }}
        >
          <Home size={22} />
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>자산관제</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'settings' ? '#8B5CF6' : 'var(--text-muted)', background: 'none', border: 'none' }}
        >
          <Settings size={22} />
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>AI 제어</span>
        </button>
      </div>
    </div>
  );
}

export default AdminDashboard;
