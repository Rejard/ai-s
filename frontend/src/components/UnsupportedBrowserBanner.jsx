import React, { useState } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export default function UnsupportedBrowserBanner({ browserName, reason }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const appStoreUrl = 'https://apps.apple.com/app/trust-crypto-bitcoin-wallet/id1288339409';
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp';
  const storeUrl = isIOS ? appStoreUrl : playStoreUrl;
  const storeName = isIOS ? 'App Store' : 'Play Store';

  return (
    <div style={{
      background: 'rgba(245, 158, 11, 0.08)',
      border: '1px solid rgba(245, 158, 11, 0.25)',
      borderRadius: '14px',
      padding: '16px',
      marginBottom: '16px',
      position: 'relative',
    }}>
      <button
        onClick={() => setDismissed(true)}
        aria-label="닫기"
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '4px',
          lineHeight: 0,
        }}
      >
        <X size={16} />
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
        <AlertTriangle size={20} color="#F59E0B" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div>
          <div style={{
            fontSize: '13px',
            fontWeight: '700',
            color: '#F59E0B',
            marginBottom: '4px',
            fontFamily: 'var(--font-title)',
          }}>
            {browserName} 브라우저 지갑 연동 안내
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            lineHeight: '1.5',
          }}>
            {reason}
          </div>
        </div>
      </div>

      <div style={{
        background: 'rgba(99, 102, 241, 0.06)',
        border: '1px solid rgba(99, 102, 241, 0.15)',
        borderRadius: '10px',
        padding: '12px',
        marginBottom: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <Info size={16} color="#8B5CF6" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div style={{ fontSize: '11px', color: '#C7D2FE', lineHeight: '1.6' }}>
            <strong style={{ color: '#A78BFA' }}>이용 방법:</strong> 이 브라우저에서 Google 로그인을 먼저 완료해 주세요.
            이후 "트러스트 월렛 연결" 버튼을 누르면 <strong>자동으로 Trust Wallet 앱으로 이동</strong>되며, 로그인 상태가 유지됩니다.
          </div>
        </div>
      </div>

      <a
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '10px 16px',
          color: 'var(--text-muted)',
          fontSize: '12px',
          fontWeight: '500',
          fontFamily: 'var(--font-title)',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        Trust Wallet 미설치 시 다운로드 ({storeName})
      </a>
    </div>
  );
}
