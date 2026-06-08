import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  TrendingUp, TrendingDown, Wallet, Users, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, ShieldCheck, Play, Sparkles, StopCircle, LogOut, Mail, Phone
} from 'lucide-react';
import { API_BASE } from '../App';
import { ethers } from 'ethers';
import {
  loadUserDashboardData,
  loadUserTxHistory,
  submitUserInvestmentTransaction,
} from '../lib/userDashboard';
import { DASHBOARD_COPY } from '../lib/dashboardCopy';
import SutPriceCard from '../components/SutPriceCard';
import SutPriceChart from '../components/SutPriceChart';

function PcDashboard({ walletAddress, userData, onLogout }) {
  const navigate = useNavigate();

  const [portfolio, setPortfolio] = useState(null);
  const [walletSutBalance, setWalletSutBalance] = useState(0);
  const [depositPercent, setDepositPercent] = useState(0);

  const [priceHistory, setPriceHistory] = useState([]);
  const [sutPrice, setSutPrice] = useState(0.19);
  const [sutChange24h, setSutChange24h] = useState(0);

  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('DEPOSIT');
  const [txAmount, setTxAmount] = useState('');
  const [processingTx, setProcessingTx] = useState(false);

  const [txHistory, setTxHistory] = useState([]);

  const [councilStats, setCouncilStats] = useState(null);
  const [loadingCouncilStats, setLoadingCouncilStats] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const data = await loadUserDashboardData({
        apiBase: API_BASE,
        walletAddress,
        axiosClient: axios,
        ethersLib: ethers,
      });
      if (data.portfolio !== undefined) setPortfolio(data.portfolio);
      if (data.sutPrice !== undefined) setSutPrice(data.sutPrice);
      if (data.sutChange24h !== undefined) setSutChange24h(data.sutChange24h);
      if (data.priceHistory !== undefined) {
        setPriceHistory(data.priceHistory);
      }
      if (data.walletSutBalance !== undefined) setWalletSutBalance(data.walletSutBalance);
    } catch (err) {
      console.error('Dashboard data load failed:', err);
    }
  };

  const fetchTxHistory = async () => {
    try {
      const history = await loadUserTxHistory({ apiBase: API_BASE, walletAddress, axiosClient: axios });
      setTxHistory(history);
    } catch (err) {
      console.error('Transaction history load failed:', err);
    }
  };

  const fetchCouncilStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/investment/council-stats`);
      if (res.data.success) {
        setCouncilStats({
          factionStats: res.data.factionStats,
          activeMembers: res.data.activeMembers,
          recentVotes: res.data.recentVotes
        });
      }
    } catch (err) {
      console.error('Failed to load council stats in User PC Dashboard:', err.message);
    } finally {
      setLoadingCouncilStats(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchTxHistory();
    fetchCouncilStats();
    const refreshTimer = setInterval(() => {
      fetchDashboardData();
      fetchCouncilStats();
    }, 5000);
    return () => clearInterval(refreshTimer);
  }, [walletAddress]);

  const handleTxSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!txAmount || parseFloat(txAmount) <= 0) {
      alert('올바른 SUT 수량을 입력해 주세요.');
      return;
    }

    setProcessingTx(true);
    try {
      const result = await submitUserInvestmentTransaction({
        apiBase: API_BASE,
        walletAddress,
        amount: txAmount,
        type: txType,
        portfolio,
        ethereum: window.ethereum,
        userAgent: navigator.userAgent,
        axiosClient: axios,
        ethersLib: ethers,
      });

      if (txType === 'DEPOSIT') {
        if (result.response.data.success) {
          alert(`${txAmount} SUT 입금이 완료되었습니다.\n거래 해시: ${result.txHash}`);
        }
      } else if (result.response.data.success) {
        alert(`${txAmount} SUT 출금 신청이 접수되었습니다.`);
      }

      setShowTxModal(false);
      setTxAmount('');
      fetchDashboardData();
      fetchTxHistory();
    } catch (err) {
      alert('거래 처리에 실패했습니다: ' + err.message);
    } finally {
      setProcessingTx(false);
    }
  };

  return (
    <div className="pc-layout-wrapper" style={{ alignItems: 'stretch', gap: '30px', padding: '40px 60px' }}>

      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>

        <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-gradient)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontSize: '26px', fontWeight: '700', color: '#FFFFFF', margin: '0 auto 16px'
          }}>
            {(userData && userData.name ? userData.name.substring(0, 1).toUpperCase() : '👤')}
          </div>
          <h3 style={{ fontSize: '18px', color: '#F3F4F6', marginBottom: '6px', fontWeight: '700' }}>
            {userData ? userData.name : '테스트 회원'} 님
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '14px' }}>
            {userData ? userData.email : '이메일 정보 없음'}
          </span>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '11px',
            color: 'var(--success-color)',
            fontWeight: '700'
          }}>
            <ShieldCheck size={14} />
            KYC 인증회원
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            🔑 내 연동 지갑 주소
          </span>
          <div style={{
            fontSize: '12px',
            color: '#FFF',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            background: 'rgba(0,0,0,0.2)',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.03)'
          }}>
            {walletAddress}
          </div>
        </div>

        {((userData && userData.email && userData.email.toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase()) ||
          (walletAddress && walletAddress.toLowerCase() === '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase()) ||
          (localStorage.getItem('google_email') && localStorage.getItem('google_email').toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase())) && (
          <div
            className="glass-card glow-active"
            onClick={() => navigate('/manager')}
            style={{
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(20, 16, 45, 0.4) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>👑</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#C084FC' }}>{DASHBOARD_COPY.managerPage}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>회원 관리 화면으로 이동</div>
              </div>
            </div>
            <button className="btn-primary" style={{ padding: '8px', fontSize: '12px' }}>
              {DASHBOARD_COPY.managerPage}
            </button>
          </div>
        )}

        {((userData && userData.email && userData.email.toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase()) ||
          (localStorage.getItem('google_email') && localStorage.getItem('google_email').toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase())) && (
          <div
            className="glass-card glow-active"
            onClick={() => navigate('/admin')}
            style={{
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(20, 16, 45, 0.4) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '10px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🔑</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#F87171' }}>{DASHBOARD_COPY.adminPage}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>시스템 관리 화면으로 이동</div>
              </div>
            </div>
            <button className="btn-primary" style={{ padding: '8px', fontSize: '12px', background: 'linear-gradient(90deg, #EF4444, #DC2626)', border: 'none', color: '#FFF' }}>
              {DASHBOARD_COPY.adminPage}
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn-secondary"
          style={{
            padding: '14px',
            fontSize: '13px',
            color: 'var(--danger-color)',
            borderColor: 'rgba(239, 68, 68, 0.15)',
            background: 'rgba(239, 68, 68, 0.02)',
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px'
          }}
          onClick={onLogout}
        >
          <LogOut size={16} /> {DASHBOARD_COPY.logout}
        </button>

      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {portfolio ? (
        <SutPriceCard 
          sutPrice={sutPrice}
          sutChange24h={sutChange24h}
          krwRate={portfolio.krwRate}
          priceHistory={priceHistory}
          sutHigh24h={portfolio.sutHigh24h}
          sutLow24h={portfolio.sutLow24h}
          isMobile={false}
        />
        ) : (
          <div className="shimmer-loading" style={{ height: '230px', borderRadius: '20px' }}></div>
        )}

        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', color: '#F3F4F6', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
            <Wallet size={18} color="#8B5CF6" />
            {DASHBOARD_COPY.assetOverview}
          </h3>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            {(() => {
              const totalAssets = walletSutBalance + (portfolio ? portfolio.totalInvested : 0);
              let walletPercent = 100;
              let depositedPercent = 0;
              if (totalAssets > 0) {
                walletPercent = (walletSutBalance / totalAssets) * 100;
                depositedPercent = 100 - walletPercent;
              }
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{DASHBOARD_COPY.totalAssets}</span>
                      <div style={{ fontSize: '32px', fontWeight: '800', color: '#F3F4F6', fontFamily: 'var(--font-title)', marginTop: '4px' }}>
                        {totalAssets.toFixed(2)} <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>SUT</span>
                      </div>
                    </div>
                    {portfolio && portfolio.pendingWithdrawalAmount > 0 && (
                      <div style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        padding: '10px 16px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: 'var(--warning-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <AlertTriangle size={16} />
                        출금 승인 대기중: {portfolio.pendingWithdrawalAmount.toFixed(2)} SUT
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{DASHBOARD_COPY.walletBalance}</span>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#8B5CF6', marginTop: '4px' }}>
                        {walletSutBalance.toFixed(2)} SUT <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>({walletPercent.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{DASHBOARD_COPY.managedAssets}</span>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--success-color)', marginTop: '4px' }}>
                        {portfolio ? portfolio.totalInvested.toFixed(2) : '0.00'} SUT <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>({depositedPercent.toFixed(1)}%)</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ height: '16px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '10px', overflow: 'hidden', display: 'flex', marginBottom: '24px' }}>
                    <div style={{ width: `${walletPercent}%`, height: '100%', background: 'var(--primary-gradient)', transition: 'width 0.5s ease' }}></div>
                    <div style={{ width: `${depositedPercent}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #059669)', transition: 'width 0.5s ease' }}></div>
                  </div>
                </>
              );
            })()}

            <div style={{ display: 'flex', gap: '16px' }}>
              <button
                className="btn-primary"
                style={{ flex: 1, padding: '15px', fontSize: '14px' }}
                onClick={() => { setTxType('DEPOSIT'); setShowTxModal(true); }}
              >
                📥 {DASHBOARD_COPY.depositAction}
              </button>
              <button
                className="btn-secondary"
                style={{
                  flex: 1,
                  padding: '15px',
                  fontSize: '14px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#FCA5A5',
                  borderColor: 'rgba(239, 68, 68, 0.2)'
                }}
                onClick={() => { setTxType('WITHDRAW'); setShowTxModal(true); }}
              >
                📤 {DASHBOARD_COPY.withdrawAction}
              </button>
            </div>
          </div>
        </div>



      </div>

      <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>

        <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
          <h3 style={{ fontSize: '16px', color: '#F3F4F6', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
            📜 {DASHBOARD_COPY.allTransactions}
          </h3>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '500px', paddingRight: '4px' }}>
            {txHistory && txHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {txHistory.map(tx => {
                  const isDeposit = tx.type !== 'WITHDRAW_REQUEST';
                  return (
                    <div
                      key={tx.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: 'rgba(0,0,0,0.15)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '12px'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#F3F4F6', marginBottom: '4px' }}>
                          {isDeposit ? `📥 ${DASHBOARD_COPY.depositCompleted}` : `📤 ${DASHBOARD_COPY.withdrawalPending}`}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(tx.createdAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '15px',
                          fontWeight: '800',
                          fontFamily: 'var(--font-title)',
                          color: isDeposit ? 'var(--success-color)' : 'var(--warning-color)'
                        }}>
                          {isDeposit ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)} SUT
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                {DASHBOARD_COPY.noTransactions}
              </div>
            )}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', background: 'rgba(0,0,0,0.25)' }}>
          <h4 style={{ fontSize: '13px', color: '#A78BFA', fontWeight: '700', marginBottom: '10px' }}>
            💬 실시간 매니저 고객센터
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '14px' }}>
            트레이딩 이체 지연, KYC 수동 서명 보류 등 모든 관리 문의는 배정된 텔레그램 담당 매니저에게 즉시 문의해 주십시오.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: 'var(--text-muted)' }}>✉ 매니저 이메일</span>
              <a href={`mailto:${userData?.managerEmail || 'lemaiiisk@gmail.com'}`} style={{ color: '#FFF', textDecoration: 'none', fontWeight: '600' }}>
                {userData?.managerEmail || 'lemaiiisk@gmail.com'}
              </a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: 'var(--text-muted)' }}>📞 매니저 연락처</span>
              <a href={`tel:${userData?.managerPhone || '등록된 번호 없음'}`} style={{ color: '#FFF', textDecoration: 'none', fontWeight: '600' }}>
                {userData?.managerPhone || '010-2020-6447'}
              </a>
            </div>
          </div>
        </div>

      </div>

      {showTxModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '420px', background: '#111827', padding: '30px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '14px', color: '#FFF', fontWeight: '700' }}>
              {txType === 'DEPOSIT' ? `💸 ${DASHBOARD_COPY.depositAction}` : `📤 ${DASHBOARD_COPY.withdrawAction}`}
            </h3>

            <form onSubmit={handleTxSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#A78BFA' }}>
                  {txType === 'DEPOSIT' ? DASHBOARD_COPY.depositAmount : DASHBOARD_COPY.withdrawAmount}
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="예: 500"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  min="1"
                  required
                />
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px' }}>
                {txType === 'DEPOSIT'
                  ? '💡 입금한 SUT는 운용 자산에 반영됩니다.'
                  : '💡 출금 요청 시 봇 거래 정산이 수동으로 진행되며, 본사 매니저 최종 승인 후 입력하신 가상 지갑 주소로 SUT가 전달됩니다.'}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowTxModal(false)} style={{ flex: 1 }}>
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, background: txType === 'DEPOSIT' ? 'var(--primary-gradient)' : 'var(--danger-color)' }}
                  disabled={processingTx}
                >
                  {processingTx ? '처리 중...' : txType === 'DEPOSIT' ? DASHBOARD_COPY.depositSubmit : DASHBOARD_COPY.withdrawSubmit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default PcDashboard;
