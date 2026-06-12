import React from 'react';
import { BarChart3, ShieldAlert, ArrowUpDown, Settings } from 'lucide-react';

function ManagerAiConfigSection({
  gridSettings,
  setGridSettings,
  handleToggleAiStatus,
  handleTriggerAIProfit,
  handleSaveGridSettings,
  hasUnsavedChanges,
  gateioBalance,
  vaultSutBalance,
  walletSutBalance,
  stats,
  localApiKey,
  setLocalApiKey,
  localApiSecret,
  setLocalApiSecret,
  localDepositAddress,
  setLocalDepositAddress,
  handleSaveApiKeys,
  isSavingCredentials,
  handleClearApiKeys,
  setShowSendSutModal
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* 🤖 자동화 AI 그리드 트레이딩 봇 설정 카드 */}
      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '8px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)' }}>
              <BarChart3 size={20} color="var(--success-color)" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <h4 style={{ fontSize: '14px', color: '#F3F4F6', margin: 0, fontWeight: '700' }}>🤖 자동화 AI 그리드 트레이딩 봇</h4>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>상/하한가 범위를 설정하면 매일 봇이 수익을 발생시킵니다.</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {gridSettings.ai_grid_status === 'ON' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.2' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--success-color)' }}>LIVE</span>
                <span style={{ fontSize: '9px', color: 'var(--success-color)', fontWeight: 'bold' }}>작동중</span>
              </div>
            ) : (
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>정지됨</span>
            )}
            <button
              onClick={handleToggleAiStatus}
              style={{
                width: '46px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                background: gridSettings.ai_grid_status === 'ON' ? 'var(--success-color)' : 'rgba(255,255,255,0.2)',
                position: 'relative', transition: 'background 0.3s'
              }}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', background: '#FFF', position: 'absolute', top: '2px',
                left: gridSettings.ai_grid_status === 'ON' ? '24px' : '2px', transition: 'left 0.3s'
              }}></div>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px' }}>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>하한가 (최저)</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px', fontWeight: 'bold' }}>USDT</span>
              <input
                type="number"
                value={gridSettings.ai_grid_lower}
                onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_lower: e.target.value })}
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>상한가 (최고)</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px', fontWeight: 'bold' }}>USDT</span>
              <input
                type="number"
                value={gridSettings.ai_grid_upper}
                onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_upper: e.target.value })}
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>그리드 분할 수</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px' }}>
              <input
                type="number"
                value={gridSettings.ai_grid_count}
                onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_count: e.target.value })}
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
              <span style={{ color: 'var(--text-dark)', fontSize: '11px', marginLeft: '4px' }}>개</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>일일 매매 빈도</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px' }}>
              <input
                type="number"
                value={gridSettings.ai_grid_frequency}
                onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_frequency: e.target.value })}
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
              <span style={{ color: 'var(--text-dark)', fontSize: '11px', marginLeft: '4px' }}>회</span>
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          padding: '10px 12px',
          borderRadius: '8px',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start'
        }}>
          <ShieldAlert size={14} color="var(--danger-color)" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ textAlign: 'left' }}>
            <strong style={{ fontSize: '11px', color: 'var(--danger-color)' }}>안전 가이드 (계정 정지 주의)</strong>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: '1.4' }}>
              일일 매매 횟수(Frequency)를 너무 높게 설정하면 거래소(Binance, Gate.io 등)의 API 호출 제한(Rate Limit) 정책에 위반되어 <b>봇 연결 차단 및 계정 정지(Wash Trading 의심)</b> 위험이 있습니다. 안정적인 자산 운용을 위해 기본 설정값(하루 5~15회 내외)을 유지하는 것을 권장합니다.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn-secondary"
            onClick={handleTriggerAIProfit}
            style={{ fontSize: '11px', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', flexShrink: 0, width: 'auto' }}
          >
            수동 수익 정산 배분
          </button>

          {hasUnsavedChanges && (
            <span className="pulse-indicator" style={{ fontSize: '10px', color: '#F59E0B', fontWeight: 'bold', marginRight: 'auto', whiteSpace: 'nowrap' }}>
              ⚠️ 적용 대기중
            </span>
          )}

          <button
            className={hasUnsavedChanges ? "btn-primary glow-active" : "btn-primary"}
            onClick={handleSaveGridSettings}
            style={{
              background: hasUnsavedChanges
                ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              boxShadow: hasUnsavedChanges
                ? '0 0 12px rgba(245, 158, 11, 0.5)'
                : '0 4px 12px rgba(139, 92, 246, 0.25)',
              border: hasUnsavedChanges
                ? '1px solid #F59E0B'
                : '1px solid rgba(255, 255, 255, 0.15)',
              padding: '8px 16px',
              fontSize: '12px',
              width: 'auto',
              borderRadius: '10px',
              color: '#FFF',
              cursor: 'pointer',
              fontWeight: '850',
              flexShrink: 0
            }}
          >
            변경사항 적용
          </button>
        </div>
      </div>

      {/* 📊 Gate.io API 실거래 연동 현황 카드 */}
      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: gateioBalance ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)', background: gateioBalance ? 'rgba(16, 185, 129, 0.02)' : 'rgba(255, 255, 255, 0.02)' }}>
        <div>
          <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 10px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>📊</span> Gate.io API 실거래 연동 현황
          </h4>
          {gateioBalance ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>연동 상태:</span>
                <span style={{ color: 'var(--success-color)', fontWeight: '700' }}>● 실거래 가동 중</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>거래소 보유 SUT:</span>
                <span style={{ color: '#FFF', fontWeight: '700' }}>{parseFloat(gateioBalance.SUT).toFixed(2)} SUT</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>거래소 보유 USDT:</span>
                <span style={{ color: '#FFF', fontWeight: '700' }}>{parseFloat(gateioBalance.USDT).toFixed(2)} USDT</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'left', fontSize: '11px', lineHeight: '1.5' }}>
              <span style={{ color: '#F59E0B', fontWeight: '700', display: 'block', marginBottom: '4px' }}>⚠️ API 키 미등록 (가상 데모 모드)</span>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                아래 로컬 설정을 통해 API 키를 등록하면, 거래소 SUT/USDT 자금 조회 및 소액 자동매매 실거래 연동이 활성화됩니다.
              </p>
            </div>
          )}
        </div>

        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowSendSutModal(true)}
            style={{ width: '100%', padding: '8px 12px', fontSize: '11px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', border: 'none', borderRadius: '6px', fontWeight: '700', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <ArrowUpDown size={12} /> 내 지갑에서 Gate.io로 SUT 송금
          </button>
        </div>
      </div>

      {/* 💰 SUT 자산 통합 관리 현황 카드 */}
      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
        <h4 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>💰</span> SUT 자산 통합 관리 현황
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>매니저 SUT 총 보유 (지갑 + 거래소):</span>
              <span style={{ color: '#60A5FA', fontWeight: '700' }}>{(walletSutBalance + (gateioBalance ? parseFloat(gateioBalance.SUT || 0) : 0)).toFixed(2)} SUT</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px', borderLeft: '2px solid rgba(96, 165, 250, 0.3)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              <div>• 개인 지갑: <span style={{ color: '#FFF', fontWeight: '600' }}>{walletSutBalance.toFixed(2)} SUT</span></div>
              <div>• 거래소 (Gate.io): <span style={{ color: '#FFF', fontWeight: '600' }}>{(gateioBalance ? parseFloat(gateioBalance.SUT || 0) : 0).toFixed(2)} SUT</span></div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>회원 누적 예치금 (누적 입금액):</span>
            <span style={{ color: '#3B82F6', fontWeight: '700' }}>{stats ? stats.totalDeposited.toFixed(2) : '0.00'} SUT</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>회원 누적 배분액 (출금 완료):</span>
            <span style={{ color: '#F59E0B', fontWeight: '700' }}>{stats ? stats.totalDistributed.toFixed(2) : '0.00'} SUT</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>회원 총 운용 자산 (볼트 잔고):</span>
            <span style={{ color: '#A78BFA', fontWeight: '700' }}>{vaultSutBalance.toFixed(2)} SUT</span>
          </div>
        </div>
      </div>

      {/* ⚙️ Gate.io API 키 및 주소 설정 카드 */}
      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <h4 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Settings size={18} color="#A78BFA" />
          로컬 전용 Gate.io API 키 및 주소 설정
        </h4>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
          보안 유지를 위해 입력 정보는 <strong>현재 기기 브라우저에만 저장</strong>되며 서버 DB나 설정 파일에 등록되지 않습니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="password"
            value={localApiKey}
            onChange={(e) => setLocalApiKey(e.target.value)}
            placeholder="Gate.io API Key 입력"
            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#FFF', outline: 'none' }}
          />
          <input
            type="password"
            value={localApiSecret}
            onChange={(e) => setLocalApiSecret(e.target.value)}
            placeholder="Gate.io API Secret Key 입력"
            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#FFF', outline: 'none' }}
          />
          <input
            type="text"
            value={localDepositAddress}
            onChange={(e) => setLocalDepositAddress(e.target.value)}
            placeholder="Gate.io SUT 입금 주소 (Polygon) 입력"
            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#FFF', outline: 'none' }}
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
            {isSavingCredentials ? '⏳ 저장 중...' : '💾 기기 저장'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClearApiKeys}
            style={{ flex: 1, padding: '10px', fontSize: '11px', color: 'var(--danger-color)', borderColor: 'rgba(239,68,68,0.2)', fontWeight: 'bold' }}
          >
            🗑️ 삭제
          </button>
        </div>
      </div>

    </div>
  );
}

export default ManagerAiConfigSection;
