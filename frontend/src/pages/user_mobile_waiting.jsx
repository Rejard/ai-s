import React, { useEffect } from 'react';
import axios from 'axios';
import { Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { API_BASE } from '../App';

function UserMobileWaiting({ walletAddress, onApproved }) {
  useEffect(() => {
    const checkInterval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/auth/status/${walletAddress}`);
        if (res.data.success && res.data.registered) {
          if (res.data.user.status === 'APPROVED') {
            clearInterval(checkInterval);
            alert('🎉 회원님의 KYC 심사가 최종 통과되었습니다! 플랫폼 메인 대시보드로 진입합니다.');
            onApproved();
          }
        }
      } catch (err) {
        console.error('실시간 승인 감지 오류:', err);
      }
    }, 300000);

    return () => clearInterval(checkInterval);
  }, [walletAddress, onApproved]);

  return (
    <div style={{ margin: 'auto 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div className="glass-card glow-active" style={{ padding: '40px 20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>

        <div style={{
          position: 'absolute',
          top: '-20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100px',
          height: '100px',
          background: 'rgba(139,92,246,0.15)',
          filter: 'blur(30px)',
          borderRadius: '50%'
        }}></div>

        <div style={{ display: 'inline-flex', position: 'relative', marginBottom: '24px' }}>
          <div className="shimmer-loading" style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            border: '3px solid rgba(139,92,246,0.15)',
            borderTopColor: 'var(--accent-color)',
            animation: 'spin 1.5s linear infinite'
          }}></div>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'var(--accent-color)'
          }}>
            <Clock size={32} />
          </div>
        </div>

        <h2 style={{ fontSize: '20px', color: '#F3F4F6', marginBottom: '10px' }}>Platform Owner KYC Identity Review in Progress</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
          회원님의 구글 인증 정보, 국가 식별 명칭, 신분증(ID Card) 이미지 대조 심사가 본사 매니저 측에 안전하게 접수되었습니다.
        </p>

        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--card-border)',
          padding: '12px 16px',
          borderRadius: '12px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success-color)' }}></div>
            <span>구글 OAuth 계정 데이터베이스 등록 완료</span>
          </div>
          <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }}></div>
            </div>
            <span>SUT 수납 스마트 컨트랙트(Approve) 승인 완료</span>
          </li>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warning-color)' }}></div>
            <span style={{ color: '#F3F4F6' }}>Precise identity review for foreigners and manual data jury in progress</span>
          </div>
        </div>

      </div>

      <div className="glass-card" style={{
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(16, 185, 129, 0.05)',
        borderColor: 'rgba(16, 185, 129, 0.15)'
      }}>
        <CheckCircle2 size={24} color="var(--success-color)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          <strong style={{ color: 'var(--text-main)' }}>[실시간 동기화 활성화]</strong><br />
          본사 전용 심사단 검토 및 승인이 최종 완료되는 즉시 페이지 새로고침 없이 메인 대시보드로 자동 리다이렉트 처리됩니다. 잠시만 대기해 주십시오.
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
}

export default UserMobileWaiting;
