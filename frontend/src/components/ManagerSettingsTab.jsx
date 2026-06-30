import React from 'react';
import { Settings, Wallet, ShieldCheck, Copy, Check } from 'lucide-react';

const inputStyle = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '8px',
  padding: '10px',
  fontSize: '11px',
  color: '#FFF',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box'
};

const statBadgeStyle = {
  background: 'rgba(255,255,255,0.04)',
  padding: '8px 12px',
  borderRadius: '8px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '11px'
};

function ManagerSettingsTab({
  walletAddress,
  managerEmail,
  localApiKey,
  setLocalApiKey,
  localApiSecret,
  setLocalApiSecret,
  localDepositAddress,
  setLocalDepositAddress,
  handleSaveApiKeys,
  isSavingCredentials,
  handleClearApiKeys,
  setShowSendSutModal,
  stats
}) {
  const [copied, setCopied] = React.useState(false);
  const truncatedWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '-';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)' }}>
            <Wallet size={20} color="#A78BFA" />
          </div>
          <h4 style={{ fontSize: '14px', color: '#F3F4F6', margin: 0, fontWeight: '700' }}>
            👤 매니저 프로필
          </h4>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={statBadgeStyle}>
            <span style={{ color: 'var(--text-muted)' }}>이메일:</span>
            <span style={{ color: '#F3F4F6', fontWeight: '600', fontSize: '11px' }}>
              {managerEmail || '-'}
            </span>
          </div>
          <div style={statBadgeStyle}>
            <span style={{ color: 'var(--text-muted)' }}>지갑 주소:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#A78BFA', fontWeight: '700', fontFamily: 'monospace', fontSize: '11px' }}>
                {truncatedWallet}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(walletAddress);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{
                  background: copied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s'
                }}
              >
                {copied
                  ? <Check size={12} color="#10B981" />
                  : <Copy size={12} color="#A78BFA" />
                }
              </button>
            </div>
          </div>

          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.15)',
                borderRadius: '8px',
                padding: '10px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--success-color)', display: 'block', fontFamily: 'var(--font-title)' }}>
                  {stats.approvedCount || 0}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>승인 회원</span>
              </div>
              <div style={{
                background: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.15)',
                borderRadius: '8px',
                padding: '10px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#F59E0B', display: 'block', fontFamily: 'var(--font-title)' }}>
                  {stats.pendingCount || 0}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>가입 대기</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)' }}>
            <Settings size={20} color="#A78BFA" />
          </div>
          <div>
            <h4 style={{ fontSize: '14px', color: '#F3F4F6', margin: 0, fontWeight: '700' }}>
              🔑 Gate.io API 키 및 입금 주소 설정
            </h4>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: '1.5' }}>
              🔒 입력하신 API 키는 서버에 <strong style={{ color: '#10B981' }}>AES-256 군사급 암호화</strong>로 저장됩니다.
              기기(브라우저)에는 보관되지 않으므로 해킹 위험이 없습니다.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="password"
            value={localApiKey}
            onChange={(e) => setLocalApiKey(e.target.value)}
            placeholder="Gate.io API Key"
            style={inputStyle}
          />
          <input
            type="password"
            value={localApiSecret}
            onChange={(e) => setLocalApiSecret(e.target.value)}
            placeholder="Gate.io API Secret"
            style={inputStyle}
          />
          <input
            type="text"
            value={localDepositAddress}
            onChange={(e) => setLocalDepositAddress(e.target.value)}
            placeholder="0x..."
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveApiKeys}
            disabled={isSavingCredentials}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '11px',
              background: isSavingCredentials ? '#4b5563' : 'var(--primary-gradient)',
              fontWeight: 'bold',
              cursor: isSavingCredentials ? 'not-allowed' : 'pointer',
              opacity: isSavingCredentials ? 0.7 : 1
            }}
          >
            {isSavingCredentials ? '⏳ 저장 중...' : '💾 저장'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClearApiKeys}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '11px',
              color: 'var(--danger-color)',
              borderColor: 'rgba(239,68,68,0.2)',
              fontWeight: 'bold'
            }}
          >
            🗑️ 초기화
          </button>
        </div>


      </div>

      <div className="glass-card" style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(6, 78, 59, 0.06) 100%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)' }}>
            <ShieldCheck size={20} color="var(--success-color)" />
          </div>
          <h4 style={{ fontSize: '14px', color: '#F3F4F6', margin: 0, fontWeight: '700' }}>
            🛡️ 고급 보안 및 양자 알고리즘 탑재
          </h4>
        </div>

        <div style={{ textAlign: 'left', fontSize: '11px', lineHeight: '1.6', color: 'var(--text-muted)' }}>
          <p style={{ margin: '0 0 8px 0' }}>
            본 플랫폼은 <strong style={{ color: 'var(--success-color)' }}>Zero Trust 보안 아키텍처</strong>를 기반으로 운영됩니다.
            모든 API 통신은 AES-256-GCM 군사급 암호화로 보호되며, 세션 토큰은 요청마다 검증됩니다.
          </p>
          <p style={{ margin: 0 }}>
            AI 그리드 트레이딩 엔진에는 <strong style={{ color: '#A78BFA' }}>QAOA(Quantum Approximate Optimization Algorithm)</strong> 영감의
            최적화 로직이 적용되어, 시장 변동성에 대한 적응형 그리드 배치와 리스크 관리를 수행합니다.
          </p>
        </div>
      </div>

    </div>
  );
}

export default ManagerSettingsTab;
