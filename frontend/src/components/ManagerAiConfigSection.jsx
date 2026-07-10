import React from 'react';
import { BarChart3, ShieldAlert, ShieldCheck, ArrowUpDown, Settings } from 'lucide-react';

function ManagerAiConfigSection({
  gridSettings,
  setGridSettings,
  handleToggleAutoRangePreview,
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
  setShowSendSutModal,
  handleApproveOperator,
  approvingOperator,
  operatorApproved,
  handleTabChange
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
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
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#F3F4F6', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={gridSettings.ai_grid_auto_range === 'ON'}
                onChange={(e) => handleToggleAutoRangePreview(e.target.checked)}
              />
              <span>상한가/하한가 자동 적용</span>
            </label>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '6px 0 0 0', textAlign: 'left' }}>
              기본은 체크 해제입니다. 체크하면 AI 추천 범위를 다음 실행부터 자동 반영합니다.
            </p>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>하한가 (최저)</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px', fontWeight: 'bold' }}>USDT</span>
              <input
                type="number"
                value={gridSettings.ai_grid_lower}
                onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_lower: e.target.value })}
                disabled={gridSettings.ai_grid_auto_range === 'ON'}
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
                disabled={gridSettings.ai_grid_auto_range === 'ON'}
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

      <div className="glass-card" style={{ 
        padding: '16px', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'space-between', 
        border: gateioBalance ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(245, 158, 11, 0.3)', 
        background: gateioBalance 
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(6, 78, 59, 0.03) 100%)' 
          : 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(120, 53, 4, 0.03) 100%)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: gateioBalance ? '0 4px 20px rgba(16, 185, 129, 0.08)' : '0 4px 20px rgba(245, 158, 11, 0.05)'
      }}>
        <div style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: gateioBalance ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 158, 11, 0.15)',
          filter: 'blur(15px)',
          pointerEvents: 'none'
        }} />

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                padding: '6px', 
                borderRadius: '50%', 
                background: gateioBalance ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Settings size={14} color={gateioBalance ? '#10B981' : '#F59E0B'} />
              </span>
              Gate.io API 실거래 연동 현황
            </h4>

            <span style={{
              fontSize: '10px',
              fontWeight: '800',
              padding: '3px 8px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: gateioBalance ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: gateioBalance ? '#10B981' : '#F59E0B',
              border: gateioBalance ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)'
            }}>
              <span className="pulse-indicator" style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                background: gateioBalance ? '#10B981' : '#F59E0B',
                display: 'inline-block',
                boxShadow: gateioBalance ? '0 0 8px #10B981' : '0 0 8px #F59E0B'
              }} />
              {gateioBalance ? '실거래 정상 가동' : '가상 데모 모드'}
            </span>
          </div>

          {gateioBalance ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
              {localApiKey && (
                <div style={{ 
                  background: 'rgba(0, 0, 0, 0.2)', 
                  padding: '6px 10px', 
                  borderRadius: '6px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                  marginBottom: '2px'
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>🔑 연동 키:</span>
                  <span style={{ fontFamily: 'monospace', color: '#D1D5DB', fontWeight: '500' }}>
                    {`${localApiKey.slice(0, 6)}****************${localApiKey.slice(-4)}`}
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  padding: '10px', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SUT 보유 잔고</span>
                  <span style={{ color: '#10B981', fontSize: '14px', fontWeight: '800' }}>
                    {parseFloat(gateioBalance.SUT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '10px', color: '#34D399', fontWeight: '700' }}>SUT</span>
                  </span>
                </div>

                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  padding: '10px', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>USDT 보유 잔고</span>
                  <span style={{ color: '#FBBF24', fontSize: '14px', fontWeight: '800' }}>
                    {parseFloat(gateioBalance.USDT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '10px', color: '#FCD34D', fontWeight: '700' }}>USDT</span>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ 
              textAlign: 'left', 
              fontSize: '11px', 
              lineHeight: '1.6',
              background: 'rgba(245, 158, 11, 0.03)',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid rgba(245, 158, 11, 0.15)'
            }}>
              <span style={{ color: '#F59E0B', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px', fontSize: '11.5px' }}>
                ⚠️ API 연동 키 미등록 상태
              </span>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '10.5px' }}>
                실거래 체결을 가동하고 거래소 SUT/USDT 자금을 실시간 동기화하려면 설정 페이지에서 API 정보를 안전하게 입력해 주세요.
              </p>
            </div>
          )}
        </div>

        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowSendSutModal(true)}
            style={{ 
              width: '100%', 
              padding: '10px 12px', 
              fontSize: '11px', 
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', 
              border: 'none', 
              borderRadius: '8px', 
              fontWeight: '800', 
              color: '#FFF', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
              transition: 'all 0.2s'
            }}
          >
            <ArrowUpDown size={13} /> 내 지갑에서 Gate.io로 SUT 송금
          </button>
          
          {operatorApproved ? (
            <div style={{ 
              width: '100%', 
              padding: '10px 12px', 
              fontSize: '11px', 
              background: 'rgba(16, 185, 129, 0.08)', 
              border: '1px solid rgba(16, 185, 129, 0.25)', 
              borderRadius: '8px', 
              fontWeight: '800', 
              color: '#10B981', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px'
            }}>
              <ShieldCheck size={13} /> ✅ 서버 대행 출금 승인 완료
            </div>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={handleApproveOperator}
              disabled={approvingOperator}
              style={{ 
                width: '100%', 
                padding: '10px 12px', 
                fontSize: '11px', 
                background: 'linear-gradient(135deg, #10B981 0%, #047857 100%)', 
                border: 'none', 
                borderRadius: '8px', 
                fontWeight: '800', 
                color: '#FFF', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '6px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
                transition: 'all 0.2s'
              }}
            >
              <ShieldCheck size={13} /> {approvingOperator ? '출금 권한 승인 처리 중...' : '🔐 서버 대행 출금 권한 승인(1회)'}
            </button>
          )}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
        <h4 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>💰</span> SUT 자산 통합 관리 현황
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>👤 매니저 SUT 총 보유 (지갑 + 거래소):</span>
              <span style={{ color: '#60A5FA', fontWeight: '700' }}>{(walletSutBalance + (gateioBalance ? parseFloat(gateioBalance.SUT || 0) : 0)).toFixed(2)} SUT</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px', borderLeft: '2px solid rgba(96, 165, 250, 0.3)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              <div>• 개인 지갑: <span style={{ color: '#FFF', fontWeight: '600' }}>{walletSutBalance.toFixed(2)} SUT</span></div>
              <div>• 거래소 (Gate.io): <span style={{ color: '#FFF', fontWeight: '600' }}>{(gateioBalance ? parseFloat(gateioBalance.SUT || 0) : 0).toFixed(2)} SUT</span></div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59,130,246,0.08)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.18)' }}>
            <span style={{ color: '#BFDBFE' }}>👤 매니저 본인 입금:</span>
            <span style={{ color: '#60A5FA', fontWeight: '700' }}>{stats ? Number(stats.managerSelfDeposited || 0).toFixed(2) : '0.00'} SUT</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>👥 회원 누적 예치금 (누적 입금액):</span>
            <span style={{ color: '#3B82F6', fontWeight: '700' }}>{stats ? stats.totalDeposited.toFixed(2) : '0.00'} SUT</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>👥 회원 누적 배분액 (출금 완료):</span>
            <span style={{ color: '#F59E0B', fontWeight: '700' }}>{stats ? stats.totalDistributed.toFixed(2) : '0.00'} SUT</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>👥 회원 총 운용 자산 (볼트 잔고):</span>
            <span style={{ color: '#A78BFA', fontWeight: '700' }}>{vaultSutBalance.toFixed(2)} SUT</span>
          </div>
        </div>
      </div>



    </div>
  );
}

export default ManagerAiConfigSection;
