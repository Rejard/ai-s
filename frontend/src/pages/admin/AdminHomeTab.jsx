import React, { useState } from 'react';
import { BarChart3, Loader2, UserPlus } from 'lucide-react';
import EditUserModal from '../../components/EditUserModal';

function AdminHomeTab({
  vaultSutBalance,
  stats,
  loading,
  managers,
  fetchManagers,
  managerEmail,
  submittingDelete,
  handleDeleteManager,
  promoteWallet,
  setPromoteWallet,
  handlePromoteManager,
  submittingPromote
}) {
  const [selectedManagerWallet, setSelectedManagerWallet] = useState(null);
  const [selectedManagerEmail, setSelectedManagerEmail] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div className="glass-card" style={{ padding: '16px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
        <h3 style={{ fontSize: '15px', color: '#FFF', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
          🏢 본사 SUT 자산 현황
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>본사 보유 자산 (수익 - 실시간):</span>
            <span style={{ color: '#10B981', fontWeight: '700' }}>{(vaultSutBalance - (stats ? stats.totalDistributed : 0)).toFixed(2)} SUT</span>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '15px', color: '#FFF', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
          <BarChart3 size={18} color="#EF4444" />
          활성 매니저 자산 현황
        </h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <Loader2 size={24} className="spin" style={{ margin: '0 auto 10px', color: 'var(--primary-color)' }} />
          </div>
        ) : managers.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>등록된 매니저가 존재하지 않습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {managers.map((m) => {
              const isMaster = m.wallet_address.toLowerCase() === '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase();
              const isHovered = hoveredCard === m.wallet_address;
              return (
                <div
                  key={m.wallet_address}
                  onClick={() => {
                    setSelectedManagerWallet(m.wallet_address);
                    setSelectedManagerEmail(m.email);
                  }}
                  onMouseEnter={() => setHoveredCard(m.wallet_address)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    background: isHovered ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.25)',
                    border: isHovered ? '1px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'pointer',
                    transform: isHovered ? 'translateY(-2px)' : 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isMaster ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '14px' }}>
                        {isMaster ? '⭐' : '👤'}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', color: '#FFF', fontWeight: 'bold' }}>{m.name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{m.email}</div>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#A78BFA', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                      {m.userCount}명 소속
                    </div>
                  </div>

                  <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>매니저 Gate.io 자산</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                        <span style={{ color: '#10B981' }}>{parseFloat(m.gateioSut || 0).toLocaleString()} SUT</span>
                        <span style={{ color: 'rgba(255, 255, 255, 0.15)', fontSize: '10px', fontWeight: 'normal' }}>|</span>
                        <span style={{ color: '#6EE7B7' }}>{parseFloat(m.gateioUsdt || 0).toLocaleString()} USDT</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>회원 총 자산 (온체인)</div>
                      <div style={{ fontSize: '13px', color: '#FFF', fontWeight: 'bold' }}>{parseFloat(m.performance || 0).toLocaleString()} SUT</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
        <h4 style={{ fontSize: '15px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={18} color="#8B5CF6" />
          신규 매니저 승격
        </h4>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
          승격할 회원은 반드시 가입된 정회원이어야 합니다.
        </p>

        <form onSubmit={handlePromoteManager} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            value={promoteWallet}
            onChange={(e) => setPromoteWallet(e.target.value)}
            placeholder="지갑 주소 (0x...)"
            className="form-input"
            style={{ padding: '14px', fontSize: '13px' }}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={submittingPromote}
            style={{ width: '100%', padding: '14px', fontSize: '14px' }}
          >
            {submittingPromote ? <Loader2 size={16} className="spin" /> : '🚀 정식 매니저 승격'}
          </button>
        </form>
      </div>

      {selectedManagerWallet && (
        <EditUserModal
          isOpen={!!selectedManagerWallet}
          onClose={() => {
            setSelectedManagerWallet(null);
            setSelectedManagerEmail(null);
            if (fetchManagers) fetchManagers();
          }}
          walletAddress={selectedManagerWallet}
          targetEmail={selectedManagerEmail}
          isManagerEdit={true}
          onDeleteManager={handleDeleteManager}
          submittingDelete={submittingDelete}
        />
      )}

    </div>
  );
}

export default AdminHomeTab;
