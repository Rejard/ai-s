import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Calendar,
  Clock,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Users,
  Plus,
  Bot,
  ArrowLeft,
  Home
} from 'lucide-react';
import { getAuthToken } from '../lib/authSession';
import { API_BASE } from '../App';

function getUserRoleEmoji(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (clean === 'lemaiiisk@gmail.com') {
    return <span style={{ marginRight: 6, fontSize: 16 }}>🌟</span>;
  }
  return <span style={{ marginRight: 6, fontSize: 16 }}>👤</span>;
}

function sortAssets(assetsList) {
  return [...assetsList].sort((a, b) => {
    const emailA = String(a.email || '').trim().toLowerCase();
    const emailB = String(b.email || '').trim().toLowerCase();
    const getRank = (email) => {
      if (email === 'lemaiiisk@gmail.com') return 0;
      return 1;
    };
    const rankA = getRank(emailA);
    const rankB = getRank(emailB);
    if (rankA !== rankB) return rankA - rankB;
    const dateA = a.joined_at ? new Date(a.joined_at).getTime() : 0;
    const dateB = b.joined_at ? new Date(b.joined_at).getTime() : 0;
    return dateA - dateB;
  });
}

export default function PayAdminDashboard() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [processingEmail, setProcessingEmail] = useState(null);
  const [customDates, setCustomDates] = useState({});
  const [message, setMessage] = useState(null);

  const fetchAssets = useCallback(async () => {
    setLoadingAssets(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/admin/assets`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets || []);
      } else {
        setMessage({ type: 'error', text: data.message || '매니저 목록을 불러오지 못했습니다.' });
      }
    } catch (err) {
      console.error('PayAdmin assets error:', err);
      setMessage({ type: 'error', text: '서버 통신 오류가 발생했습니다.' });
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleUpdateSubscription = async (targetEmail, months, customDate = null) => {
    setProcessingEmail(targetEmail);
    setMessage(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/admin/user-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetEmail, months, customDate })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        fetchAssets();
      } else {
        setMessage({ type: 'error', text: data.message || '이용 기간 변경 실패' });
      }
    } catch (err) {
      console.error('Update subscription error:', err);
      setMessage({ type: 'error', text: '이용 기간 설정 중 오류가 발생했습니다.' });
    } finally {
      setProcessingEmail(null);
    }
  };

  const handleCustomDateChange = (email, dateStr) => {
    setCustomDates(prev => ({ ...prev, [email]: dateStr }));
  };

  const activeCount = assets.filter(a => a.subscriptionStatus && !a.subscriptionStatus.isExpired).length;
  const expiringCount = assets.filter(a => a.subscriptionStatus && a.subscriptionStatus.dDay).length;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 일반 사용자 페이지 이동 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
        <button
          className="btn-primary"
          onClick={() => navigate('/')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}
        >
          <ArrowLeft size={18} />
          일반 사용자 페이지
        </button>
      </div>

      {/* 대시보드 헤더 */}
      <section className="glass-card" style={{ padding: 24, borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={26} color="#3b82f6" />
              <h1 style={{ margin: 0, color: '#fff', fontSize: 22, fontWeight: 700 }}>
                구매 관리 페이지 <span style={{ fontSize: 14, color: '#3b82f6', fontWeight: 500 }}>(pay-admin)</span>
              </h1>
            </div>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
              Ai S 매니저들의 이용 기간을 개별 설정하고 관리합니다. 모든 이용 기간의 만료 시간은 <strong>자정 0시(00:00:00)</strong> 기준입니다.
            </p>
          </div>
          <div>
            <button
              className="btn-secondary"
              onClick={fetchAssets}
              disabled={loadingAssets}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, fontSize: 13 }}
            >
              <RefreshCw size={15} className={loadingAssets ? 'spin' : ''} />
              새로고침
            </button>
          </div>
        </div>

        {/* 요약 통계 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 20 }}>
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserCheck size={14} color="#a855f7" /> 전체 관리 매니저
            </div>
            <strong style={{ display: 'block', color: '#fff', marginTop: 8, fontSize: 20 }}>{assets.length}명</strong>
          </div>
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.15)' }}>
            <div style={{ color: '#10b981', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} /> 이용 승인 매니저
            </div>
            <strong style={{ display: 'block', color: '#10b981', marginTop: 8, fontSize: 20 }}>{activeCount}명</strong>
          </div>
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)' }}>
            <div style={{ color: '#f59e0b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} /> 만료 임박 (7일 이하)
            </div>
            <strong style={{ display: 'block', color: '#f59e0b', marginTop: 8, fontSize: 20 }}>{expiringCount}명</strong>
          </div>
        </div>
      </section>

      {/* 상태 메시지 토스트 */}
      {message && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 500,
            background: message.type === 'success' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
            border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
            color: message.type === 'success' ? '#34d399' : '#f87171'
          }}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* 매니저별 이용 기간 관리 리스트 */}
      <section className="glass-card" style={{ padding: 24, borderRadius: 16 }}>
        <h2 style={{ margin: '0 0 16px', color: '#fff', fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CreditCard size={18} color="#3b82f6" /> 매니저별 구독 및 이용 기간 설정
        </h2>

        {loadingAssets ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Loader2 className="spin" size={28} color="#3b82f6" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>매니저 데이터를 불러오는 중입니다...</p>
          </div>
        ) : assets.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 32 }}>관리 대상 매니저가 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sortAssets(assets).map(asset => {
              const sub = asset.subscriptionStatus || {};
              const isProcessing = processingEmail === asset.email;

              return (
                <article
                  key={asset.email}
                  style={{
                    padding: 20,
                    borderRadius: 12,
                    background: 'rgba(0,0,0,.25)',
                    border: sub.dDay ? '1px solid rgba(245,158,11,.4)' : '1px solid rgba(255,255,255,.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16
                  }}
                >
                  {/* 상단 회원 정보 & 상태 뱃지 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong style={{ color: '#fff', fontSize: 16, display: 'inline-flex', alignItems: 'center' }}>
                          {getUserRoleEmoji(asset.email)}
                          {asset.name}
                        </strong>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({asset.email})</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                        지갑: {asset.wallet_address || '지갑 미등록'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* D-Day 뱃지 */}
                      {sub.dDay && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 999,
                            background: 'rgba(245,158,11,.2)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245,158,11,.4)'
                          }}
                        >
                          ⏳ {sub.dDay}
                        </span>
                      )}

                      {/* 상태 뱃지 */}
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: sub.isExpired ? 'rgba(239,68,68,.15)' : 'rgba(16,185,129,.15)',
                          color: sub.isExpired ? '#f87171' : '#34d399',
                          border: `1px solid ${sub.isExpired ? 'rgba(239,68,68,.3)' : 'rgba(16,185,129,.3)'}`
                        }}
                      >
                        {sub.statusLabel}
                      </span>
                    </div>
                  </div>

                  {/* 만료일 표시 */}
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,.03)',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      fontSize: 13
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={15} color="#3b82f6" /> 현재 이용 만료 예정시각 (자정 0시 기준):
                    </span>
                    <strong style={{ color: sub.isExpired ? '#f87171' : '#38bdf8' }}>
                      {sub.expiresAt ? sub.expiresAt : '설정 안됨 (주문 비활성)'}
                    </strong>
                  </div>

                  {/* 이용 기간 추가/지정 컨트롤러 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                      paddingTop: 8,
                      borderTop: '1px dashed rgba(255,255,255,.08)'
                    }}
                  >
                    {/* 기간 신속 버튼 (+1개월, +3개월, +1년) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>신속 부여:</span>
                      <button
                        className="btn-secondary"
                        disabled={isProcessing}
                        onClick={() => handleUpdateSubscription(asset.email, 1)}
                        style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}
                      >
                        +1개월
                      </button>
                      <button
                        className="btn-secondary"
                        disabled={isProcessing}
                        onClick={() => handleUpdateSubscription(asset.email, 3)}
                        style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}
                      >
                        +3개월
                      </button>
                      <button
                        className="btn-secondary"
                        disabled={isProcessing}
                        onClick={() => handleUpdateSubscription(asset.email, 12)}
                        style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, color: '#60a5fa' }}
                      >
                        +1년
                      </button>
                    </div>

                    {/* 직접 날짜 지정 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="date"
                        value={customDates[asset.email] || ''}
                        onChange={e => handleCustomDateChange(asset.email, e.target.value)}
                        style={{
                          background: 'rgba(0,0,0,.4)',
                          border: '1px solid rgba(255,255,255,.15)',
                          color: '#fff',
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          colorScheme: 'dark'
                        }}
                      />
                      <button
                        className="btn-primary"
                        disabled={isProcessing || !customDates[asset.email]}
                        onClick={() => handleUpdateSubscription(asset.email, null, customDates[asset.email])}
                        style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        {isProcessing ? <Loader2 size={12} className="spin" /> : <Plus size={12} />}
                        지정일 저장 (0시)
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
