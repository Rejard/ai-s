import React from 'react';
import { ExternalLink, Receipt } from 'lucide-react';

function ManagerSelfDepositHistory({ payments = [], totalDeposited = 0, isMobile = false }) {
  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: isMobile ? '16px' : '20px',
        padding: isMobile ? '18px' : '22px',
        marginBottom: isMobile ? '16px' : '24px',
        boxShadow: 'var(--shadow-card)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
        <h3 style={{ margin: 0, color: '#F9FAFB', fontSize: isMobile ? '15px' : '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Receipt size={isMobile ? 16 : 18} color="var(--accent-color)" />
          Manager self deposit history
        </h3>
        <span style={{ color: '#3B82F6', fontSize: isMobile ? '12px' : '13px', fontWeight: '800', whiteSpace: 'nowrap' }}>
          {Number(totalDeposited || 0).toFixed(2)} SUT
        </span>
      </div>

      {payments.length === 0 ? (
        <p style={{ color: 'var(--text-dark)', fontSize: isMobile ? '12px' : '13px', textAlign: 'center', padding: isMobile ? '18px 0' : '26px 0', margin: 0 }}>
          No manager self deposits from the user page yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: isMobile ? '220px' : '200px', overflowY: 'auto', scrollbarWidth: 'none' }}>
          {payments.map((pay) => (
            <div
              key={pay.id}
              style={{
                background: 'rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.02)',
                borderRadius: '10px',
                padding: isMobile ? '10px 12px' : '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '700', color: '#FFF' }}>
                  {pay.name || 'Manager self'}
                </div>
                {pay.tx_hash && pay.tx_hash.length === 66 && pay.tx_hash.startsWith('0x') ? (
                  <a
                    href={`https://polygonscan.com/tx/${pay.tx_hash}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '9px', color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}
                  >
                    TX: {pay.tx_hash.substring(0, isMobile ? 10 : 12)}... <ExternalLink size={isMobile ? 8 : 10} />
                  </a>
                ) : (
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Internal or pending TX record
                  </span>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '800', color: '#3B82F6' }}>
                  +{Number(pay.amount || 0).toFixed(2)} SUT
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {pay.created_at ? new Date(pay.created_at).toLocaleString() : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ManagerSelfDepositHistory;
