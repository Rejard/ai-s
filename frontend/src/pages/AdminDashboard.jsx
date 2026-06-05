import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ShieldAlert, ShieldCheck, Users, Wallet, Trash2, UserPlus, 
  ArrowLeft, BarChart3, HelpCircle, Loader2
} from 'lucide-react';
import { API_BASE } from '../App';

function AdminDashboard({ walletAddress, managerEmail }) {
  const navigate = useNavigate();

  // 매니저 목록 및 상태 관리
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoteWallet, setPromoteWallet] = useState('');
  const [submittingPromote, setSubmittingPromote] = useState(false);
  const [submittingDelete, setSubmittingDelete] = useState(null);
  
  // 글로벌 AI 설정 상태 관리
  const [globalAiModel, setGlobalAiModel] = useState('Gemini 2.0 Flash');
  const [globalGeminiApiKey, setGlobalGeminiApiKey] = useState('');
  const [savingAiConfig, setSavingAiConfig] = useState(false);

  // 최종 어드민 권한 고정 계정 정의
  const ADMIN_EMAIL = 'lemaiiisk@gmail.com'.toLowerCase();
  const isAdmin = managerEmail && managerEmail.toLowerCase().trim() === ADMIN_EMAIL;

  // 어드민 연동 헤더 빌드
  const getAdminHeaders = () => {
    return {
      headers: {
        'x-admin-email': ADMIN_EMAIL
      }
    };
  };

  // 매니저 목록 조회
  const fetchManagers = async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API_BASE}/admin/managers`, getAdminHeaders());
      if (res.data.success) {
        setManagers(res.data.managers);
      }
    } catch (err) {
      console.error('매니저 목록 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 글로벌 AI 설정 조회
  const fetchAiConfig = async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API_BASE}/admin/ai-config`, getAdminHeaders());
      if (res.data.success && res.data.config) {
        setGlobalAiModel(res.data.config.model || 'Gemini 3.5 Flash');
        setGlobalGeminiApiKey(res.data.config.apiKey || '');
      }
    } catch (err) {
      console.error('글로벌 AI 설정 로드 실패:', err);
    }
  };

  // 글로벌 AI 설정 저장
  const handleSaveAiConfig = async (e) => {
    if (e) e.preventDefault();
    if (!globalGeminiApiKey.trim()) {
      alert("Gemini API Key를 입력해 주십시오.");
      return;
    }

    setSavingAiConfig(true);
    try {
      const res = await axios.post(`${API_BASE}/admin/save-ai-config`, {
        model: globalAiModel,
        apiKey: globalGeminiApiKey.trim()
      }, getAdminHeaders());

      if (res.data.success) {
        alert("🎉 글로벌 AI 설정이 서버 DB에 정상적으로 저장되었습니다. 이제 모든 매니저 봇이 이 AI 두뇌를 사용해 오토 봇 매매를 실행합니다.");
        fetchAiConfig();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 설정 저장 실패: ${errMsg}`);
    } finally {
      setSavingAiConfig(false);
    }
  };

  useEffect(() => {
    fetchManagers();
    fetchAiConfig();
    // 5초 간격 실시간 갱신
    const interval = setInterval(fetchManagers, 5000);
    return () => clearInterval(interval);
  }, [managerEmail]);

  // 매니저 승격 격발
  const handlePromoteManager = async (e) => {
    if (e) e.preventDefault();
    if (!promoteWallet || promoteWallet.trim().length !== 42) {
      alert("올바른 42자리 지갑 주소를 입력해 주십시오.");
      return;
    }

    if (!confirm(`해당 회원(${promoteWallet.trim()})을 매니저로 정식 승격시키겠습니까?\n\n승격 시 기존 매니저 소속에서 이탈하여 독립 500명 가입 정원을 가집니다.`)) {
      return;
    }

    setSubmittingPromote(true);
    try {
      const res = await axios.post(`${API_BASE}/admin/promote-manager`, {
        walletAddress: promoteWallet.trim()
      }, getAdminHeaders());

      if (res.data.success) {
        alert(`🎉 ${res.data.message}`);
        setPromoteWallet('');
        fetchManagers();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 승격 실패: ${errMsg}`);
    } finally {
      setSubmittingPromote(false);
    }
  };

  // 매니저 계정 삭제 및 이관 격발
  const handleDeleteManager = async (walletAddr, name) => {
    if (!confirm(`⚠️ 경고: [${name}] 매니저 계정을 데이터베이스에서 영구 삭제하시겠습니까?\n\n이 작업은 취소할 수 없으며, 해당 매니저 산하의 모든 회원은 마스터 매니저 밑으로 강제 자동 이관됩니다.`)) {
      return;
    }

    setSubmittingDelete(walletAddr);
    try {
      const res = await axios.post(`${API_BASE}/admin/delete-manager`, {
        walletAddress: walletAddr
      }, getAdminHeaders());

      if (res.data.success) {
        alert(`🗑️ ${res.data.message}`);
        fetchManagers();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 삭제 실패: ${errMsg}`);
    } finally {
      setSubmittingDelete(null);
    }
  };

  // 비인증 사용자 접근 차단 가드 뷰
  if (!isAdmin) {
    return (
      <div className="pc-layout-wrapper" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="glass-card" style={{ maxWidth: '480px', padding: '36px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', marginBottom: '20px' }}>
            <ShieldAlert size={48} color="var(--danger-color)" />
          </div>
          <h2 style={{ fontSize: '20px', color: '#FFF', fontWeight: '800', marginBottom: '12px' }}>접근 권한 보안 제한</h2>
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
    <div className="pc-layout-wrapper" style={{ padding: '40px 50px', flexDirection: 'column', gap: '30px', alignItems: 'stretch' }}>
      
      {/* 1. 상단 타이틀 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '22px' }}>
            👑
          </div>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ fontSize: '22px', color: '#FFF', margin: 0, fontWeight: '800' }}>최상위 관리자(Admin) 관제 센터</h1>
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

      {/* 2. 대시보드 메인 레이아웃 */}
      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', width: '100%' }}>
        
        {/* [좌측 컬럼] 매니저 승격 관리 & 누적 통계 */}
        <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '24px', flexShrink: 0 }}>
          
          {/* 어드민 계정 정보 카드 */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-gradient)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '16px', fontWeight: 'bold', color: '#FFF' }}>
                A
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: '15px', color: '#FFF', margin: 0 }}>이명학 총괄 관리자</h4>
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

          {/* 🤖 글로벌 AI 엔진 제어 카드 */}
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
                  <option value="Gemini 3.5 Flash" style={{ background: '#1A1825', color: '#FFF' }}>Gemini 3.5 Flash (최신/초고속)</option>
                  <option value="Gemini 2.5 Pro" style={{ background: '#1A1825', color: '#FFF' }}>Gemini 2.5 Pro (초고성능/추론)</option>
                  <option value="Gemini 2.5 Flash" style={{ background: '#1A1825', color: '#FFF' }}>Gemini 2.5 Flash (기본/고속)</option>
                  <option value="Gemini 3.1 Flash Lite" style={{ background: '#1A1825', color: '#FFF' }}>Gemini 3.1 Flash Lite (경량/초고속)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textAlign: 'left' }}>Gemini API Key</label>
                <input 
                  type="password" 
                  value={globalGeminiApiKey}
                  onChange={(e) => setGlobalGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy로 시작하는 구글 API Key 입력"
                  style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#FFF', outline: 'none' }}
                />
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

          {/* 🌟 신규 매니저 승격 폼 카드 */}
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

          {/* 정보 박스 */}
          <div className="glass-card" style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
            <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 8px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={16} color="var(--danger-color)" /> 매니저 통제 안전 가이드
            </h4>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0, textAlign: 'left' }}>
              매니저 강등(Demote)은 지원하지 않습니다. 해지 시에는 계정 삭제(Delete) 처리만 가능하며, 삭제 시 산하 회원들의 이탈 방지를 위해 최초 마스터 지갑으로 이관되도록 구조화되어 있습니다.
            </p>
          </div>

        </div>

        {/* [우측 컬럼] 전체 매니저 통계 테이블 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
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

export default AdminDashboard;
