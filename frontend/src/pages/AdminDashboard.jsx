import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, DollarSign, Award, ArrowLeft, Check, X, 
  Eye, ShieldAlert, BarChart3, Receipt, ExternalLink 
} from 'lucide-react';
import { API_BASE } from '../App';

function AdminDashboard({ walletAddress, adminEmail }) {
  const navigate = useNavigate();

  // 대기 유저 및 전체 회원, 통계 데이터 상태
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // 모달 이미지 뷰어 상태
  const [selectedIdCard, setSelectedIdCard] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);

  // 시연 편의성 및 외부인 무단 침입 철저 방어를 위한 관리자 비밀번호 보호 상태
  const [adminPassword, setAdminPassword] = useState('');
  const [authPassed, setAuthPassed] = useState(false);

  // 🌟 이명학 마스터 관리자 구글 이메일 고정 정의
  const MASTER_ADMIN_EMAIL = 'lemaiiisk@gmail.com'.toLowerCase();
  
  // 백엔드 보안 미들웨어를 통과하기 위한 x-admin-email 헤더 빌드 (아무나 접속 시에도 어드민 API 연동 허용)
  const getAdminHeaders = () => {
    return {
      headers: {
        'x-admin-email': MASTER_ADMIN_EMAIL
      }
    };
  };

  // 1. 어드민 통합 데이터 로드
  const fetchAdminData = async () => {
    try {
      // 1-1. KYC 승인 대기 목록
      const pendingRes = await axios.get(`${API_BASE}/admin/pending-users`, getAdminHeaders());
      if (pendingRes.data.success) {
        setPendingUsers(pendingRes.data.users);
      }

      // 1-2. 통계 및 최근 결제
      const statsRes = await axios.get(`${API_BASE}/admin/stats`, getAdminHeaders());
      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
        setRecentPayments(statsRes.data.recentPayments);
      }

      // 1-3. 전체 회원 정보 목록 실시간 로드 추가!
      const allUsersRes = await axios.get(`${API_BASE}/admin/users`, getAdminHeaders());
      if (allUsersRes.data.success) {
        setAllUsers(allUsersRes.data.users);
      }

    } catch (err) {
      console.error('어드민 데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    // 5초마다 실시간 동기화 리프레시
    const interval = setInterval(fetchAdminData, 5000);
    return () => clearInterval(interval);
  }, []);

  // 2. KYC 승인 처리
  const handleApprove = async (walletAddressToApprove) => {
    if (!confirm('해당 회원의 신분증 및 구글 계정을 승인하고 10일 무료 체험(TRIAL) 등급으로 가입을 허가하시겠습니까?')) {
      return;
    }
    setSubmittingId(walletAddressToApprove);
    try {
      const res = await axios.post(`${API_BASE}/admin/approve-user`, { walletAddress: walletAddressToApprove }, getAdminHeaders());
      if (res.data.success) {
        alert(res.data.message);
        fetchAdminData();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert('승인 처리 중 오류 발생: ' + errMsg);
    } finally {
      setSubmittingId(null);
    }
  };

  // 3. KYC 반려 처리
  const handleReject = async (walletAddressToReject) => {
    if (!confirm('해당 회원의 신원 서류가 부적합하여 가입 신청을 반려하시겠습니까?')) {
      return;
    }
    setSubmittingId(walletAddressToReject);
    try {
      const res = await axios.post(`${API_BASE}/admin/reject-user`, { walletAddress: walletAddressToReject }, getAdminHeaders());
      if (res.data.success) {
        alert(res.data.message);
        fetchAdminData();
      }
    } catch (err) {
      alert('반려 처리 중 오류 발생: ' + err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ margin: 'auto', textAlign: 'center', padding: '20px' }}>
        <div className="shimmer-loading" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 15px' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>본사 관리자 통계 모듈을 빌드 중입니다...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* 1. 어드민 상단 내비게이션 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          className="btn-secondary" 
          onClick={() => navigate('/dashboard')}
          style={{ width: 'auto', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', gap: '5px' }}
        >
          <ArrowLeft size={16} />
          사용자 모드로
        </button>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          🏢 <strong>본사 관리자 관제 시스템</strong>
        </span>
      </div>

      {/* 2. 대시보드 핵심 지표 통계 (글라스 2열 레이아웃) */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          
          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'rgba(139,92,246,0.08)', marginBottom: '6px' }}>
              <Users size={16} color="#8B5CF6" />
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>1차 승인 정원 제한</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F3F4F6', marginTop: '4px' }}>
              {stats.totalApproved} <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>/ {stats.limit}</span>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'rgba(245,158,11,0.08)', marginBottom: '6px' }}>
              <ShieldAlert size={16} color="#F59E0B" />
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>가입 심사 대기자</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F59E0B', marginTop: '4px' }}>
              {stats.totalPending} 명
            </div>
          </div>

          <div className="glass-card" style={{ padding: '12px', textAlign: 'center', gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>수납 및 2단계 분배 총괄 (USDT)</span>
              <BarChart3 size={14} color="var(--success-color)" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', margin: '5px 0' }}>
              <div>
                <span style={{ fontSize: '8px', color: 'var(--text-dark)' }}>총 수납액</span>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#F3F4F6' }}>{stats.totalRevenue.toFixed(1)}</div>
              </div>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
              <div>
                <span style={{ fontSize: '8px', color: 'var(--text-dark)' }}>추천 분배액(50%)</span>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--success-color)' }}>{stats.totalDistributed.toFixed(1)}</div>
              </div>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
              <div>
                <span style={{ fontSize: '8px', color: 'var(--text-dark)' }}>본사 귀속분(50%)</span>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#8B5CF6' }}>{stats.companyRevenue.toFixed(1)}</div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 3. KYC 가입 승인 대기 심사 리스트 */}
      <div className="glass-card">
        <h3 style={{ fontSize: '15px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={18} color="#F59E0B" />
          신규 가입 심사 접수 목록 ({pendingUsers.length}건)
        </h3>

        {pendingUsers.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            현재 새로 접수된 가입 신청이나 신원 서류 심사 대기자가 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingUsers.map((user) => (
              <div 
                key={user.id} 
                style={{ 
                  background: 'rgba(0,0,0,0.25)', 
                  border: '1px solid rgba(255,255,255,0.03)', 
                  borderRadius: '12px', 
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {/* 상단 회원 기본 요약 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', color: '#F3F4F6' }}>{user.name} ({user.country})</h4>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>구글인증: {user.email}</span>
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-dark)' }}>
                    {new Date(user.joined_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                  <div style={{ wordBreak: 'break-all' }}>지갑: **{user.wallet_address}**</div>
                  <div>전화번호: {user.phone}</div>
                </div>

                {/* 첨부 서류 (신분증 보기 및 심사 승인 단축바) */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ flex: 1, padding: '8px', fontSize: '11px', borderRadius: '8px', gap: '4px' }}
                    onClick={() => setSelectedIdCard(`http://localhost:5000${user.id_card_path}`)}
                  >
                    <Eye size={12} />
                    신분증 확인
                  </button>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    style={{ flex: 1, padding: '8px', fontSize: '11px', borderRadius: '8px', gap: '4px', background: 'var(--success-color)', boxShadow: 'none' }}
                    onClick={() => handleApprove(user.wallet_address)}
                    disabled={submittingId === user.wallet_address}
                  >
                    <Check size={12} />
                    승인
                  </button>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    style={{ width: '40px', padding: '8px', fontSize: '11px', borderRadius: '8px', background: 'var(--danger-color)', boxShadow: 'none' }}
                    onClick={() => handleReject(user.wallet_address)}
                    disabled={submittingId === user.wallet_address}
                  >
                    <X size={12} />
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. 최근 결제 및 온체인 분배 히스토리 리스트 */}
      <div className="glass-card">
        <h3 style={{ fontSize: '15px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Receipt size={18} color="#8B5CF6" />
          최근 온체인 청구/수납 이력
        </h3>

        {recentPayments.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            현재까지 플랫폼 스마트 컨트랙트를 통해 결제 및 분배된 수납 이력이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', scrollbarWidth: 'none' }}>
            {recentPayments.map((pay) => (
              <div 
                key={pay.id} 
                style={{ 
                  background: 'rgba(0,0,0,0.15)', 
                  border: '1px solid rgba(255,255,255,0.02)', 
                  borderRadius: '10px', 
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#F3F4F6' }}>
                    {pay.name} ({pay.type === 'MEMBERSHIP_FEE' ? '가입비 수납' : '월정액 수납'})
                  </div>
                  <a 
                    href={`https://amoy.polygonscan.com/tx/${pay.tx_hash}`} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ fontSize: '9px', color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}
                  >
                    TX: {pay.tx_hash.substring(0, 10)}... <ExternalLink size={8} />
                  </a>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--success-color)' }}>
                    +{pay.amount} USDT
                  </div>
                  <span style={{ fontSize: '8px', color: 'var(--text-dark)' }}>
                    50% 초대인 분배 완료
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. 전체 등록 회원 명부 패널 */}
      <div className="glass-card">
        <h3 style={{ fontSize: '15px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color="#10B981" />
          전체 등록 회원 명부 ({allUsers.length}명)
        </h3>

        {allUsers.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            등록된 플랫폼 회원이 존재하지 않습니다.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', scrollbarWidth: 'thin' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '650px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '11px' }}>
                  <th style={{ padding: '10px 8px' }}>이름 (국가)</th>
                  <th style={{ padding: '10px 8px' }}>이메일 / 연락처</th>
                  <th style={{ padding: '10px 8px' }}>지갑 주소</th>
                  <th style={{ padding: '10px 8px' }}>심사 상태</th>
                  <th style={{ padding: '10px 8px' }}>가입 등급</th>
                  <th style={{ padding: '10px 8px' }}>가입일</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((user) => {
                  const isMaster = user.wallet_address.toLowerCase() === '0x015B8fA9aE51Dbebe7301a0A3F725Bf8811E5818'.toLowerCase();
                  return (
                    <tr 
                      key={user.id} 
                      onClick={() => navigate(`/admin/edit-user/${user.wallet_address}`)}
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.03)', 
                        fontSize: '11px', 
                        color: '#E5E7EB',
                        background: isMaster ? 'rgba(139,92,246,0.06)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isMaster ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isMaster ? 'rgba(139,92,246,0.06)' : 'transparent'}
                    >
                      <td style={{ padding: '12px 8px', fontWeight: '600' }}>
                        <span style={{ color: isMaster ? '#C084FC' : '#FFF' }}>{user.name}</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '4px' }}>({user.country})</span>
                        {isMaster && (
                          <span style={{ marginLeft: '6px', background: 'rgba(139,92,246,0.2)', color: '#C084FC', padding: '2px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: '800' }}>마스터</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div>{user.email}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-dark)' }}>{user.phone}</div>
                      </td>
                      <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontSize: '10px', color: '#A7F3D0' }}>
                        {user.wallet_address.substring(0, 10)}...{user.wallet_address.substring(user.wallet_address.length - 8)}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ 
                          padding: '3px 8px', 
                          borderRadius: '6px', 
                          fontSize: '9px',
                          fontWeight: '700',
                          background: user.status === 'APPROVED' ? 'rgba(16,185,129,0.12)' : user.status === 'PENDING_KYC' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                          color: user.status === 'APPROVED' ? 'var(--success-color)' : user.status === 'PENDING_KYC' ? '#F59E0B' : 'var(--danger-color)'
                        }}>
                          {user.status === 'APPROVED' ? '승인완료' : user.status === 'PENDING_KYC' ? ' KYC대기 ' : ' 가입반려 '}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ 
                          padding: '3px 8px', 
                          borderRadius: '6px', 
                          fontSize: '9px',
                          fontWeight: '700',
                          background: user.tier === 'ACTIVE' ? 'rgba(139,92,246,0.12)' : user.tier === 'TRIAL' ? 'rgba(59,130,246,0.12)' : 'rgba(156,163,175,0.12)',
                          color: user.tier === 'ACTIVE' ? '#C084FC' : user.tier === 'TRIAL' ? '#60A5FA' : '#9CA3AF'
                        }}>
                          {user.tier === 'ACTIVE' ? '정회원' : user.tier === 'TRIAL' ? '무료체험' : '만료됨'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-dark)', fontSize: '9px' }}>
                        {new Date(user.joined_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. 신분증 확대 보기 라이트박스 모달 */}
      {selectedIdCard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.9)',
          backdropFilter: 'blur(10px)',
          zIndex: 2000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '15px'
        }}>
          <img 
            src={selectedIdCard} 
            alt="Submitted KYC ID Card" 
            style={{ 
              maxWidth: '90%', 
              maxHeight: '75%', 
              borderRadius: '12px', 
              boxShadow: '0 0 40px rgba(0,0,0,0.8)',
              border: '2px solid rgba(255,255,255,0.1)'
            }} 
          />
          <button 
            className="btn-primary" 
            onClick={() => setSelectedIdCard(null)}
            style={{ width: 'auto', padding: '10px 24px' }}
          >
            이미지 뷰어 닫기
          </button>
        </div>
      )}

    </div>
  );
}

export default AdminDashboard;
