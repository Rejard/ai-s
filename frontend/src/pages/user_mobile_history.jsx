import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Clock, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { API_BASE } from '../App';

function UserMobileHistory({ walletAddress }) {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_BASE}/investment/history/${walletAddress}`);
        if (res.data.success) {
          setHistory(res.data.history);
        }
      } catch (err) {
        console.error('거래 내역 조회 실패:', err);
      } finally {
        setLoading(false);
      }
    };
    if (walletAddress) {
      fetchHistory();
    }
  }, [walletAddress]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS': return <span className="badge badge-approved">완료됨</span>;
      case 'PENDING': return <span className="badge badge-pending">대기 중</span>;
      case 'FAILED': return <span className="badge badge-rejected">실패</span>;
      default: return null;
    }
  };

  return (
    <div style={{ padding: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <button 
          onClick={() => navigate('/dashboard')}
          style={{ background: 'transparent', border: 'none', color: '#F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '5px' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ fontSize: '20px', margin: 0 }}>전체 거래 내역</h2>
      </div>

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            불러오는 중...
          </div>
        ) : history.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Clock size={40} style={{ margin: '0 auto 15px', opacity: 0.5 }} />
            거래 내역이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {history.map((tx, idx) => (
              <div key={tx.id} style={{ 
                padding: '16px 20px', 
                borderBottom: idx < history.length - 1 ? '1px solid var(--glass-border)' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: tx.type === 'WITHDRAW_REQUEST' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    color: tx.type === 'WITHDRAW_REQUEST' ? '#EF4444' : '#10B981'
                  }}>
                    {tx.type === 'WITHDRAW_REQUEST' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#F3F4F6', marginBottom: '2px' }}>
                      {tx.type === 'WITHDRAW_REQUEST' ? '인출 (출금)' : '예치 (입금)'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {formatDate(tx.createdAt)}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-title)',
                    color: tx.type === 'WITHDRAW_REQUEST' ? 'var(--danger-color)' : 'var(--success-color)',
                    marginBottom: '4px'
                  }}>
                    {tx.type === 'WITHDRAW_REQUEST' ? '-' : '+'}{parseFloat(tx.amount).toFixed(2)} SUT
                  </div>
                  {getStatusBadge(tx.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default UserMobileHistory;
