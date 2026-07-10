import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, AlertTriangle, Users, ChevronRight } from 'lucide-react';
import { API_BASE } from '../App';

function UserConsent({ walletAddress, onLogout }) {
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

  const allAgreed = agreements.lossLiability && agreements.withdrawalAuth && agreements.agreements !== false && agreements.kycInfo;

  if (loading) {
    return (
      <div style={{ margin: 'auto', textAlign: 'center', padding: '20px' }}>
        <div className="shimmer-loading" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 15px' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>정원 한도 및 보안 세션을 확인 중입니다...</p>
      </div>
    );
  }

  if (!isAvailable) {
    return (
      <div className="glass-card" style={{ margin: 'auto 20px', border: '1px solid var(--danger-color)', padding: '30px 20px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', marginBottom: '20px' }}>
          <AlertTriangle size={48} color="var(--danger-color)" />
        </div>
        <h2 style={{ fontSize: '20px', color: '#F9FAFB', marginBottom: '12px', fontFamily: 'var(--font-title)' }}>
          1차 선착순 모집 마감
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', marginBottom: '25px' }}>
          죄송합니다. 본 플랫폼은 안정적인 시스템 투자 및 어드민 운영 관리를 위해 1차 모집 인원을 **{limit}명** 한정으로 제한하고 있습니다.
          현재 정원이 가득 찬 상태이므로 신규 회원 가입이 불가능합니다. 다음 모집 회차에 신청해 주시기 바랍니다.
        </p>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)',
          padding: '12px',
          borderRadius: '12px',
          fontSize: '13px',
          color: 'var(--text-muted)'
        }}>
          👥 현재 활성 인원: <span style={{ color: 'var(--danger-color)', fontWeight: '700' }}>{totalCount}</span> / {limit} 명
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>



      <div style={{ textAlign: 'center', margin: '10px 0', position: 'relative' }}>
        <h2 style={{ fontSize: '20px', color: '#F3F4F6' }}>Investment Intent and Terms of Service Agreement</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
          안전하고 원활한 자동 투자 플랫폼 이용을 위해 아래 사항을 자세히 읽고 동의해 주십시오.
        </p>
        <button
          onClick={onLogout}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '12px',
            textDecoration: 'underline',
            marginTop: '15px',
            cursor: 'pointer'
          }}
        >
          계정 초기화 (로그아웃 하고 처음으로 돌아가기)
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              id="lossLiability"
              checked={agreements.lossLiability}
              onChange={() => handleCheckboxChange('lossLiability')}
              style={{ width: '20px', height: '20px', accentColor: 'var(--accent-color)', cursor: 'pointer', marginTop: '2px' }}
            />
            <label htmlFor="lossLiability" style={{ fontSize: '14px', fontWeight: '600', color: '#F3F4F6', cursor: 'pointer' }}>
              [필수] 고위험 자동 시스템 투자 손실 면책 및 원금 비보장 동의
            </label>
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'rgba(0,0,0,0.2)',
            padding: '10px',
            borderRadius: '8px',
            lineHeight: '1.6',
            maxHeight: '80px',
            overflowY: 'auto'
          }}>
            본 서비스는 인공지능 알고리즘 및 트레이딩 전략 시뮬레이션을 활용한 시스템 자동 투자 정보를 제공합니다. 암호화폐 시장은 24시간 높은 가격 변동성으로 인해 예치 원금의 손실이 언제든 발생할 수 있습니다. 플랫폼은 절대 투자 수익률을 보장하거나 원금을 보장하지 않으며, 투자자 본인의 판단과 자율적 선택에 기반하여 실행된 모든 투자 결과(수익 및 손실)에 대한 민형사상 전적인 책임은 투자자 본인에게 귀속됨을 강력히 확인합니다.
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              id="withdrawalAuth"
              checked={agreements.withdrawalAuth}
              onChange={() => handleCheckboxChange('withdrawalAuth')}
              style={{ width: '20px', height: '20px', accentColor: 'var(--accent-color)', cursor: 'pointer', marginTop: '2px' }}
            />
            <label htmlFor="withdrawalAuth" style={{ fontSize: '14px', fontWeight: '600', color: '#F3F4F6', cursor: 'pointer' }}>
              [필수] 자산 예치 및 AI 자동 거래 (SUT Approve) 위임 동의
            </label>
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'rgba(0,0,0,0.2)',
            padding: '10px',
            borderRadius: '8px',
            lineHeight: '1.6',
            maxHeight: '80px',
            overflowY: 'auto'
          }}>
            본 서비스의 가입 및 시뮬레이션 투자는 안전하게 이루어집니다. 사용자가 설정한 가상 자동 투자 자금의 유동적 정산 및 거래 시뮬레이션을 위해, 플랫폼 스마트 컨트랙트에 사용자 지갑 내 SUT 자산의 특정 한도(Approve) 권한을 스마트 서명으로 위임하는 것에 전적으로 동의합니다. 이 권한을 활용해 플랫폼은 AI 트레이딩 및 자산 정산을 안전하게 연동 및 관리합니다.
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              id="kycInfo"
              checked={agreements.kycInfo}
              onChange={() => handleCheckboxChange('kycInfo')}
              style={{ width: '20px', height: '20px', accentColor: 'var(--accent-color)', cursor: 'pointer', marginTop: '2px' }}
            />
            <label htmlFor="kycInfo" style={{ fontSize: '14px', fontWeight: '600', color: '#F3F4F6', cursor: 'pointer' }}>
              [필수] KYC 인증 절차 및 본사 수동 승인 약관 동의
            </label>
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'rgba(0,0,0,0.2)',
            padding: '10px',
            borderRadius: '8px',
            lineHeight: '1.6',
            maxHeight: '80px',
            overflowY: 'auto'
          }}>
            본 플랫폼은 자금세탁 방지 및 불법 자금 차단을 위해 가입 신청 시 회원 실명, 전화번호, 국가 및 공식 신분증(여권/주민등록증 등) 제출을 통한 철저한 KYC 인증 절차를 요구합니다. 외국인 등 자동 데이터베이스 식별 불능 회원의 경우 플랫폼 본사 매니저 배심단이 직접 신원 대조를 거치는 수동 승인(Approved)을 진행하며, 승인이 보류되거나 반려된 상태에서는 서비스 전체 기능 이용이 일절 제한될 수 있음에 완전히 동의합니다.
          </div>
        </div>

      </div>

      <button
        className="btn-primary"
        style={{ marginTop: '10px', padding: '16px' }}
        disabled={!allAgreed}
        onClick={() => navigate('/register')}
      >
        <ShieldCheck size={20} />
        의사동의 완료 및 회원정보 작성
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export default UserConsent;
