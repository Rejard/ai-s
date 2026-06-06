import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, AlertTriangle, ChevronRight, CheckSquare, Square, Shield } from 'lucide-react';
import { API_BASE } from '../App';

function PcConsentPage({ walletAddress, onLogout }) {
  const navigate = useNavigate();
  const [agreements, setAgreements] = useState({
    lossLiability: false,
    withdrawalAuth: false,
    kycInfo: false
  });
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(500);
  const [isAvailable, setIsAvailable] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLimit = async () => {
      try {
        const res = await axios.get(`${API_BASE}/auth/check-limit`);
        if (res.data.success) {
          setTotalCount(res.data.totalCount);
          setLimit(res.data.limit);
          setIsAvailable(res.data.available);
        }
      } catch (err) {
        console.error('정원 제한 조회 실패:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLimit();
  }, []);

  const handleCheckboxChange = (key) => {
    setAgreements(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const allAgreed = agreements.lossLiability && agreements.withdrawalAuth && agreements.kycInfo;

  if (loading) {
    return (
      <div className="pc-layout-wrapper" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="shimmer-loading" style={{ width: '60px', height: '60px', borderRadius: '50%', margin: '0 auto 20px' }}></div>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>정원 한도 및 보안 세션을 확인 중입니다...</p>
        </div>
      </div>
    );
  }

  if (!isAvailable) {
    return (
      <div className="pc-layout-wrapper" style={{ justifyContent: 'center' }}>
        <div className="glass-card glow-active" style={{ maxWidth: '600px', width: '100%', padding: '40px', textAlign: 'center', border: '1px solid var(--danger-color)' }}>
          <div style={{ display: 'inline-flex', padding: '20px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', marginBottom: '25px' }}>
            <AlertTriangle size={56} color="var(--danger-color)" />
          </div>
          <h2 style={{ fontSize: '26px', color: '#F9FAFB', marginBottom: '16px', fontFamily: 'var(--font-title)' }}>
            1차 선착순 모집 마감
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.7', marginBottom: '30px' }}>
            죄송합니다. 본 플랫폼은 안정적인 시스템 투자 및 어드민 운영 관리를 위해 1차 모집 인원을 **{limit}명** 한정으로 제한하고 있습니다.
            현재 정원이 가득 찬 상태이므로 신규 회원 가입이 불가능합니다. 다음 모집 회차에 신청해 주시기 바랍니다.
          </p>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
            padding: '16px',
            borderRadius: '14px',
            fontSize: '15px',
            color: 'var(--text-muted)'
          }}>
            👥 현재 활성 인원: <span style={{ color: 'var(--danger-color)', fontWeight: '700' }}>{totalCount}</span> / {limit} 명
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 60px', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>

      <div className="pc-layout-wrapper" style={{ padding: 0 }}>

      <div className="pc-side-intro" style={{ maxWidth: '480px' }}>
        <div style={{ display: 'inline-flex', padding: '14px', borderRadius: '16px', background: 'rgba(139,92,246,0.1)', marginBottom: '24px', width: 'fit-content' }}>
          <Shield size={40} color="#8B5CF6" />
        </div>
        <h1>투자의사 및 약관 동의</h1>
        <p>
          Ai S 플랫폼에 가입하시기 전에 고위험 자동 트레이딩 서비스의 면책 범위 및 가입 조건 약관에 동의하셔야 온체인 시뮬레이션 지갑 개통이 가능합니다.
        </p>

        <div className="glass-card" style={{ padding: '24px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '12px', color: '#FFF', fontWeight: '600' }}>
            <span>🔥 1차 특별 모집 현황</span>
            <span><strong>{totalCount}</strong> / {limit} 명</span>
          </div>
          <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
            <div style={{
              width: `${(totalCount / limit) * 100}%`,
              height: '100%',
              background: 'var(--primary-gradient)',
              boxShadow: '0 0 15px rgba(139,92,246,0.6)'
            }}></div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            현재 가입 가능한 정원 여유가 있습니다. 약관에 동의하고 본인의 정당한 소유 지갑을 증빙하기 위해 회원가입을 완료해 주십시오.
          </div>
        </div>

        <button
          onClick={onLogout}
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            color: 'var(--danger-color)',
            fontSize: '13px',
            padding: '12px 18px',
            marginTop: '30px',
            cursor: 'pointer',
            fontWeight: '600',
            width: 'fit-content',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
        >
          계정 연동 초기화 (로그아웃)
        </button>
      </div>

      <div style={{ flex: 1, maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{ display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => handleCheckboxChange('lossLiability')}
          >
            {agreements.lossLiability ? (
              <CheckSquare size={24} color="#8B5CF6" style={{ flexShrink: 0 }} />
            ) : (
              <Square size={24} color="var(--text-dark)" style={{ flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#F3F4F6' }}>
              [필수] 고위험 자동 시스템 투자 손실 면책 및 원금 비보장 동의
            </span>
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            background: 'rgba(0,0,0,0.25)',
            padding: '14px',
            borderRadius: '10px',
            lineHeight: '1.7',
            maxHeight: '110px',
            overflowY: 'auto'
          }}>
            본 서비스는 인공지능 알고리즘 및 트레이딩 전략 시뮬레이션을 활용한 시스템 자동 투자 정보를 제공합니다. 암호화폐 시장은 24시간 높은 가격 변동성으로 인해 예치 원금의 손실이 언제든 발생할 수 있습니다. 플랫폼은 절대 투자 수익률을 보장하거나 원금을 보장하지 않으며, 투자자 본인의 판단과 자율적 선택에 기반하여 실행된 모든 투자 결과(수익 및 손실)에 대한 민형사상 전적인 책임은 투자자 본인에게 귀속됨을 강력히 확인합니다.
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{ display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => handleCheckboxChange('withdrawalAuth')}
          >
            {agreements.withdrawalAuth ? (
              <CheckSquare size={24} color="#8B5CF6" style={{ flexShrink: 0 }} />
            ) : (
              <Square size={24} color="var(--text-dark)" style={{ flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#F3F4F6' }}>
              [필수] 가입비 및 월정액 자동 인출 권한(SUT Approve) 위임 동의
            </span>
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            background: 'rgba(0,0,0,0.25)',
            padding: '14px',
            borderRadius: '10px',
            lineHeight: '1.7',
            maxHeight: '110px',
            overflowY: 'auto'
          }}>
            본 서비스의 가입은 온체인 스마트 컨트랙트를 통해 안전하게 이루어집니다. 사용자가 설정한 가상 자동 투자 자금의 유동적 정산을 위해, 플랫폼 스마트 컨트랙트에 사용자 지갑 내 SUT 자산의 특정 한도(Approve) 권한을 스마트 서명으로 위임하는 것에 전적으로 동의합니다. 이 권한을 활용해 백엔드는 서명 없이 월정액을 원격 자동 수납할 수 있습니다.
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{ display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => handleCheckboxChange('kycInfo')}
          >
            {agreements.kycInfo ? (
              <CheckSquare size={24} color="#8B5CF6" style={{ flexShrink: 0 }} />
            ) : (
              <Square size={24} color="var(--text-dark)" style={{ flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#F3F4F6' }}>
              [필수] KYC 인증 절차 및 본사 수동 승인 약관 동의
            </span>
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            background: 'rgba(0,0,0,0.25)',
            padding: '14px',
            borderRadius: '10px',
            lineHeight: '1.7',
            maxHeight: '110px',
            overflowY: 'auto'
          }}>
            본 플랫폼은 자금세탁 방지 및 불법 자금 차단을 위해 가입 신청 시 회원 실명, 전화번호, 국가 및 공식 신분증(여권/주민등록증 등) 제출을 통한 철저한 KYC 인증 절차를 요구합니다. 외국인 등 자동 데이터베이스 식별 불능 회원의 경우 플랫폼 본사 매니저 배심단이 직접 신원 대조를 거치는 수동 승인(Approved)을 진행하며, 승인이 보류되거나 반려된 상태에서는 서비스 전체 기능 이용이 일절 제한될 수 있음에 완전히 동의합니다.
          </div>
        </div>

        <button
          className="btn-primary"
          style={{ padding: '18px 24px', fontSize: '16px', marginTop: '10px' }}
          disabled={!allAgreed}
          onClick={() => navigate('/register')}
        >
          <ShieldCheck size={22} />
          의사동의 완료 및 회원정보 작성
          <ChevronRight size={20} style={{ marginLeft: 'auto' }} />
        </button>

      </div>
    </div>
    </div>
  );
}

export default PcConsentPage;
