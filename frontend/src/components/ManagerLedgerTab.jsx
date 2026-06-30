import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Receipt, ExternalLink, Download, FileText, Search } from 'lucide-react';
import { API_BASE } from '../App';

function ManagerLedgerTab({ walletAddress, managerEmail }) {
  const [ledgerData, setLedgerData] = useState(null);
  const [selectedMember, setSelectedMember] = useState('');
  const [memberEntries, setMemberEntries] = useState([]);
  const [memberSummary, setMemberSummary] = useState(null);
  const [memberName, setMemberName] = useState('');
  const [startDate, setStartDate] = useState('2026-07-01');
  const [endDate, setEndDate] = useState(new Date(Date.now() + 9 * 3600000).toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [loadingMember, setLoadingMember] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const getHeaders = () => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('sut_token') || localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchLedgerSummary = async () => {
    try {
      const res = await axios.get(`${API_BASE}/manager/${walletAddress}/ledger`, getHeaders());
      if (res.data.success) {
        setLedgerData(res.data);
      }
    } catch (err) {
      console.error('Ledger summary load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberLedger = async (memberWallet) => {
    setLoadingMember(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await axios.get(
        `${API_BASE}/manager/${walletAddress}/ledger/${memberWallet}?${params.toString()}`,
        getHeaders()
      );
      if (res.data.success) {
        setMemberEntries(res.data.entries);
        setMemberSummary(res.data.summary);
        setMemberName(res.data.memberName || memberWallet.slice(0, 10));
      }
    } catch (err) {
      console.error('Member ledger load failed:', err);
    } finally {
      setLoadingMember(false);
    }
  };

  useEffect(() => {
    fetchLedgerSummary();
  }, []);

  useEffect(() => {
    if (selectedMember) {
      fetchMemberLedger(selectedMember);
    }
  }, [selectedMember, startDate, endDate]);

  const handleDownloadCsv = () => {
    if (!selectedMember) return;
    const token = localStorage.getItem('auth_token') || localStorage.getItem('sut_token') || localStorage.getItem('token');
    window.open(`${API_BASE}/manager/${walletAddress}/ledger/${selectedMember}/csv?token=${token}`, '_blank');
  };

  const handleDownloadPdf = () => {
    if (!selectedMember) return;
    const token = localStorage.getItem('auth_token') || localStorage.getItem('sut_token') || localStorage.getItem('token');
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('token', token);
    window.open(`${API_BASE}/manager/${walletAddress}/ledger/${selectedMember}/pdf?${params.toString()}`, '_blank');
  };

  const typeLabels = { DEPOSIT: '입금', WITHDRAWAL: '출금', AI_PROFIT: 'AI수익', ADJUSTMENT: '조정' };
  const typeColors = {
    DEPOSIT: 'var(--success-color)',
    WITHDRAWAL: 'var(--danger-color)',
    AI_PROFIT: '#3B82F6',
    ADJUSTMENT: '#F59E0B'
  };

  const filteredMembers = ledgerData?.members?.filter(m => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (m.memberName || '').toLowerCase().includes(term) ||
           (m.walletAddress || '').toLowerCase().includes(term);
  }) || [];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div className="shimmer-loading" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 15px' }}></div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>장부 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div className="glass-card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>총 입금</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--success-color)', fontFamily: 'var(--font-title)' }}>
            {(ledgerData?.summary?.totalDeposited || 0).toFixed(1)}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-dark)' }}>SUT</div>
        </div>
        <div className="glass-card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>총 출금</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--danger-color)', fontFamily: 'var(--font-title)' }}>
            {(ledgerData?.summary?.totalWithdrawn || 0).toFixed(1)}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-dark)' }}>SUT</div>
        </div>
        <div className="glass-card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>AI 수익</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#3B82F6', fontFamily: 'var(--font-title)' }}>
            {(ledgerData?.summary?.totalAiProfit || 0).toFixed(1)}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-dark)' }}>SUT</div>
        </div>
        <div className="glass-card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>현재 잔액</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#FFF', fontFamily: 'var(--font-title)' }}>
            {(ledgerData?.summary?.balance || 0).toFixed(1)}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-dark)' }}>SUT</div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px' }}>
        <h4 style={{ fontSize: '14px', color: '#FFF', margin: '0 0 8px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={16} color="#8B5CF6" />
          회원별 장부 조회
        </h4>

        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '8px',
          padding: '8px 10px',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px'
        }}>
          <span style={{ fontSize: '12px', flexShrink: 0 }}>⚠️</span>
          <span style={{ fontSize: '10px', color: '#FBBF24', lineHeight: '1.5' }}>
            AiS 앱을 통한 거래(예치·출금·AI수익)만 조회됩니다. 외부 지갑 간 직접 전송 등 AiS 외부 거래는 기록되지 않습니다.
          </span>
        </div>

        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="회원 이름 또는 지갑 주소 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ fontSize: '12px', padding: '10px 12px' }}
          />
        </div>

        <div style={{ maxHeight: '200px', overflowY: 'auto', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filteredMembers.length === 0 ? (
            <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              {ledgerData?.members?.length === 0 ? '장부에 기록된 회원이 없습니다.' : '검색 결과가 없습니다.'}
            </p>
          ) : (
            filteredMembers.map((m) => (
              <div
                key={m.walletAddress}
                onClick={() => {
                  setSelectedMember(m.walletAddress);
                  setSearchTerm('');
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: selectedMember === m.walletAddress ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                  border: selectedMember === m.walletAddress ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(255,255,255,0.04)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#FFF' }}>{m.memberName || 'Unknown'}</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-dark)', marginLeft: '6px', fontFamily: 'monospace' }}>
                      {m.walletAddress.slice(0, 8)}...{m.walletAddress.slice(-6)}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--success-color)' }}>
                    {m.balance.toFixed(1)} SUT
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '9px', color: 'var(--text-muted)' }}>
                  <span>입금: {m.deposited.toFixed(1)}</span>
                  <span>출금: {m.withdrawn.toFixed(1)}</span>
                  <span>수익: {m.aiProfit.toFixed(1)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedMember && (
        <>
          <div className="glass-card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#FFF', margin: 0, fontWeight: '700' }}>
                📒 {memberName} 거래 내역
              </h4>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={handleDownloadPdf}
                  style={{
                    background: 'rgba(139, 92, 246, 0.15)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    color: '#C084FC',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <FileText size={12} /> PDF
                </button>
                <button
                  onClick={handleDownloadCsv}
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10B981',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Download size={12} /> CSV
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {[
                { label: '1일', days: 1 },
                { label: '1주', days: 7 },
                { label: '1달', days: 30 },
                { label: '3달', days: 90 },
                { label: '반년', days: 180 },
                { label: '1년', days: 365 },
              ].map(({ label, days }) => {
                const end = new Date();
                const start = new Date();
                start.setDate(start.getDate() - days);
                const startStr = new Date(start.getTime() + 9 * 3600000).toISOString().split('T')[0];
                const endStr = new Date(end.getTime() + 9 * 3600000).toISOString().split('T')[0];
                const isActive = startDate === startStr && endDate === endStr;
                return (
                  <button
                    key={label}
                    onClick={() => { setStartDate(startStr); setEndDate(endStr); }}
                    style={{
                      flex: '1 0 auto',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: isActive ? '1px solid #8B5CF6' : '1px solid rgba(255,255,255,0.08)',
                      background: isActive ? 'rgba(139, 92, 246, 0.2)' : 'rgba(0,0,0,0.2)',
                      color: isActive ? '#A78BFA' : 'var(--text-muted)',
                      fontSize: '10px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ flex: 1, fontSize: '11px', padding: '8px' }}
              />
              <span style={{ color: 'var(--text-muted)', alignSelf: 'center', fontSize: '12px' }}>~</span>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ flex: 1, fontSize: '11px', padding: '8px' }}
              />
            </div>

            {memberSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                {[
                  { label: '입금', value: memberSummary.totalDeposited, color: 'var(--success-color)' },
                  { label: '출금', value: memberSummary.totalWithdrawn, color: 'var(--danger-color)' },
                  { label: 'AI수익', value: memberSummary.totalAiProfit, color: '#3B82F6' },
                  { label: '잔액', value: memberSummary.balance, color: '#FFF' },
                ].map((item) => (
                  <div key={item.label} style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{item.label}</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: item.color }}>{(item.value || 0).toFixed(1)}</div>
                  </div>
                ))}
              </div>
            )}

            {loadingMember ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div className="shimmer-loading" style={{ width: '30px', height: '30px', borderRadius: '50%', margin: '0 auto' }}></div>
              </div>
            ) : memberEntries.length === 0 ? (
              <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>
                해당 기간에 거래 내역이 없습니다.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                {memberEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      background: 'rgba(0,0,0,0.15)',
                      border: '1px solid rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          color: typeColors[entry.type],
                          background: `${typeColors[entry.type]}15`
                        }}>
                          {typeLabels[entry.type]}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>
                          {entry.created_at ? entry.created_at.split(' ')[0] : ''}
                        </span>
                        {entry.verified ? (
                          <span style={{ fontSize: '8px', color: 'var(--success-color)', fontWeight: '800' }}>✅</span>
                        ) : (
                          <span style={{ fontSize: '8px', color: 'var(--text-dark)' }}>⏳</span>
                        )}
                      </div>
                      {entry.tx_hash && entry.tx_hash.length === 66 && entry.tx_hash.startsWith('0x') ? (
                        <a
                          href={`https://polygonscan.com/tx/${entry.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '9px', color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}
                        >
                          TX: {entry.tx_hash.slice(0, 12)}... <ExternalLink size={8} />
                        </a>
                      ) : entry.tx_hash ? (
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                          {entry.tx_hash.slice(0, 20)}...
                        </span>
                      ) : null}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '800',
                        color: entry.type === 'WITHDRAWAL' ? 'var(--danger-color)' : 'var(--success-color)'
                      }}>
                        {entry.type === 'WITHDRAWAL' ? '-' : '+'}{entry.amount} SUT
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ManagerLedgerTab;
