import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, ShieldCheck, Users, Wallet, Trash2, UserPlus,
  ArrowLeft, BarChart3, HelpCircle, Loader2
} from 'lucide-react';
import { useAdminLogic } from '../hooks/useAdminLogic';

function PcAdminDashboard({ walletAddress, managerEmail }) {
  const navigate = useNavigate();

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
    handleSaveAiConfig
  } = useAdminLogic(managerEmail);



  if (!isAdmin) {
    return (
      <div className="pc-layout-wrapper" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="glass-card" style={{ maxWidth: '480px', padding: '36px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
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
    <div className="pc-layout-wrapper admin-layout-wrapper" style={{ padding: '40px 50px', flexDirection: 'column', gap: '30px', alignItems: 'stretch' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '22px' }}>
            👑
          </div>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ fontSize: '22px', color: '#FFF', margin: 0, fontWeight: '800' }}>Top-level Admin Control Center</h1>
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
                <h4 style={{ fontSize: '15px', color: '#FFF', margin: 0 }}>Lee Myung-hak General Manager</h4>
                <span style={{ fontSize: '11px', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontWeight: '700' }}>
                  <ShieldCheck size={12} /> 최고 보안 인증 가동 중
                </span>
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
              <div><b>어드민 이메일:</b> {managerEmail}</div>
              <div style={{ wordBreak: 'break-all' }}><b>지갑 주소:</b> <span style={{ fontFamily: 'monospace' }}>{walletAddress}</span></div>
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

        </div>

      </div>

    </div>
  );
}

export default PcAdminDashboard;
