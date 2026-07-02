import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  TrendingUp, TrendingDown, Wallet, Users, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, ShieldCheck, Play, Sparkles, StopCircle
} from 'lucide-react';
import { API_BASE } from '../App';
import { ethers } from 'ethers';
import {
  FINALIZE_SUT_DEPOSIT_PARAM,
  FINALIZE_SUT_TX_HASH_PARAM,
  finalizePendingDepositTransaction,
  loadUserDashboardData,
  loadUserTxHistory,
  submitUserInvestmentTransaction,
  RESUME_SUT_AMOUNT_PARAM,
  RESUME_SUT_DEPOSIT_PARAM,
} from '../lib/userDashboard';
import {
  executeSutApprovalFlow,
  hasApprovalRecoveryResumeFlag,
} from '../lib/sutApprovalFlow';
import { DASHBOARD_COPY } from '../lib/dashboardCopy';
import SutPriceCard from '../components/SutPriceCard';
import SutPriceChart from '../components/SutPriceChart';
import { isAdminGoogleAccount, isManagerAccount } from '../lib/accountIdentity';
import { showFriendlyError } from '../lib/errorHandler';
import { formatKoreanDateTime } from '../lib/dateTime';

function UserDashboard({ walletAddress, userData, onLogout }) {
  const navigate = useNavigate();
  const googleEmail = userData?.email;
  const canAccessManager = isManagerAccount(userData, googleEmail, walletAddress);
  const canAccessAdmin = isAdminGoogleAccount(googleEmail || userData?.email);

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
  const [recoveringApproval, setRecoveringApproval] = useState(false);
  const [autoRecoveryAttempted, setAutoRecoveryAttempted] = useState(false);
  const [autoDepositAttempted, setAutoDepositAttempted] = useState(false);
  const [autoDepositFinalizeAttempted, setAutoDepositFinalizeAttempted] = useState(false);

  const [txHistory, setTxHistory] = useState([]);

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

  useEffect(() => {
    if (walletAddress) {
      fetchDashboardData();
      fetchTxHistory();
    }
  }, [walletAddress]);

  const handleTxSubmit = async (e, explicitAmount = null, explicitType = null, explicitCurrentUrl = null) => {
    if (e && e.preventDefault) e.preventDefault();

    const finalAmount = explicitAmount !== null ? explicitAmount : txAmount;
    const finalType = explicitType !== null ? explicitType : txType;

    if (!finalAmount || parseFloat(finalAmount) <= 0) {
      alert('올바른 SUT 수량을 입력해 주세요.');
      return;
    }

    setProcessingTx(true);
    try {
      const result = await submitUserInvestmentTransaction({
        apiBase: API_BASE,
        walletAddress,
        amount: finalAmount,
        type: finalType,
        portfolio,
        currentUrl: explicitCurrentUrl || window.location.href,
        ethereum: window.ethereum,
        userAgent: navigator.userAgent,
        axiosClient: axios,
        ethersLib: ethers,
      });

      if (result.code === 'MOBILE_TRUST_WALLET_RETURN' && result.redirectUrl) {
        setShowTxModal(false);
        setTxAmount('');
        window.location.replace(result.redirectUrl);
        return;
      }

      if (finalType === 'DEPOSIT') {
        if (result.response.data.success) {
          alert(`${finalAmount} SUT 입금이 완료되었습니다.\n거래 해시: ${result.txHash}`);
        }
      } else if (result.response.data.success) {
        alert(`${finalAmount} SUT 출금 신청이 접수되었습니다.`);
      }

      setShowTxModal(false);
      setTxAmount('');
      fetchDashboardData();
      fetchTxHistory();
    } catch (err) {
      if (err.code === 'MOBILE_TRUST_WALLET_REDIRECT' && err.redirectUrl) {
        setShowTxModal(false);
        setTxAmount('');
        window.location.href = err.redirectUrl;
        return;
      }
      showFriendlyError(err);
    } finally {
      setProcessingTx(false);
    }
  };

  const handleApprovalRecovery = async ({ allowRedirectOnMissingWallet = true } = {}) => {
    setRecoveringApproval(true);
    try {
      await executeSutApprovalFlow({
        ethereum: window.ethereum,
        currentUrl: window.location.href,
        userAgent: navigator.userAgent,
        expectedWalletAddress: walletAddress,
        alertFn: window.alert,
        confirmFn: window.confirm,
        setLocationHref: (url) => {
          window.location.href = url;
        },
        allowRedirectOnMissingWallet,
      });
    } finally {
      setRecoveringApproval(false);
    }
  };

  useEffect(() => {
    if (!walletAddress || autoRecoveryAttempted || !hasApprovalRecoveryResumeFlag(window.location.href)) {
      return;
    }

    setAutoRecoveryAttempted(true);

    const resumeUrl = new URL(window.location.href);
    resumeUrl.searchParams.delete('recover_sut_approval');
    window.history.replaceState(null, '', `${resumeUrl.pathname}${resumeUrl.search}${resumeUrl.hash}`);

    handleApprovalRecovery({ allowRedirectOnMissingWallet: false });
  }, [walletAddress, autoRecoveryAttempted]);

  useEffect(() => {
    if (!walletAddress || autoDepositAttempted) {
      return;
    }

    const resumeUrl = new URL(window.location.href);
    const shouldResumeDeposit = resumeUrl.searchParams.get(RESUME_SUT_DEPOSIT_PARAM) === '1';
    const resumeAmount = resumeUrl.searchParams.get(RESUME_SUT_AMOUNT_PARAM);

    if (!shouldResumeDeposit || !resumeAmount) {
      return;
    }

    setAutoDepositAttempted(true);
    const resumeExecutionUrl = window.location.href;
    resumeUrl.searchParams.delete(RESUME_SUT_DEPOSIT_PARAM);
    resumeUrl.searchParams.delete(RESUME_SUT_AMOUNT_PARAM);
    window.history.replaceState(null, '', `${resumeUrl.pathname}${resumeUrl.search}${resumeUrl.hash}`);
    setShowTxModal(false);
    setTxType('DEPOSIT');
    setTxAmount(resumeAmount);
    handleTxSubmit(null, resumeAmount, 'DEPOSIT', resumeExecutionUrl);
  }, [walletAddress, autoDepositAttempted]);

  useEffect(() => {
    if (!walletAddress || autoDepositFinalizeAttempted) {
      return;
    }

    const finalizeUrl = new URL(window.location.href);
    const shouldFinalize = finalizeUrl.searchParams.get(FINALIZE_SUT_DEPOSIT_PARAM) === '1';
    const txHash = finalizeUrl.searchParams.get(FINALIZE_SUT_TX_HASH_PARAM);
    const amount = finalizeUrl.searchParams.get(RESUME_SUT_AMOUNT_PARAM);

    if (!shouldFinalize || !txHash || !amount) {
      return;
    }

    setAutoDepositFinalizeAttempted(true);
    setProcessingTx(true);
    setShowTxModal(false);
    finalizeUrl.searchParams.delete(FINALIZE_SUT_DEPOSIT_PARAM);
    finalizeUrl.searchParams.delete(FINALIZE_SUT_TX_HASH_PARAM);
    finalizeUrl.searchParams.delete(RESUME_SUT_AMOUNT_PARAM);
    window.history.replaceState(null, '', `${finalizeUrl.pathname}${finalizeUrl.search}${finalizeUrl.hash}`);

    finalizePendingDepositTransaction({
      apiBase: API_BASE,
      walletAddress,
      amount,
      txHash,
      axiosClient: axios,
      ethersLib: ethers,
    })
      .then((response) => {
        if (response.data.success) {
          alert(`${amount} SUT 입금이 완료되었습니다.\n거래 해시: ${txHash}`);
        }
        fetchDashboardData();
        fetchTxHistory();
      })
      .catch((error) => {
        showFriendlyError(error);
      })
      .finally(() => {
        setProcessingTx(false);
        setTxAmount('');
      });
  }, [walletAddress, autoDepositFinalizeAttempted]);

  return (
    <div style={{ padding: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }}>

      {canAccessManager && (
        <div
          className="glass-card glow-active"
          onClick={() => navigate('/manager')}
          style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(20, 16, 45, 0.4) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>👑</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#C084FC' }}>{DASHBOARD_COPY.managerPage}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>회원 관리 화면으로 이동</div>
            </div>
          </div>
          <button className="btn-primary" style={{ width: 'auto', padding: '6px 14px', fontSize: '11px', borderRadius: '8px', background: 'var(--primary-gradient)' }}>
            {DASHBOARD_COPY.managerPage}
          </button>
        </div>
      )}

      {canAccessAdmin && (
        <div
          className="glass-card glow-active"
          onClick={() => navigate('/admin')}
          style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(20, 16, 45, 0.4) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            marginTop: '-10px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🔑</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#F87171' }}>{DASHBOARD_COPY.adminPage}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>시스템 관리 화면으로 이동</div>
            </div>
          </div>
          <button className="btn-primary" style={{ width: 'auto', padding: '6px 14px', fontSize: '11px', borderRadius: '8px', background: 'linear-gradient(90deg, #EF4444, #DC2626)', border: 'none', color: '#FFF' }}>
            {DASHBOARD_COPY.adminPage}
          </button>
        </div>
      )}

      <div className="glass-card" style={{
        padding: '15px 18px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)'
      }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '50%', background: 'var(--primary-gradient)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontSize: '18px', fontWeight: '700', color: '#FFFFFF'
        }}>
          {(userData && userData.name ? userData.name.substring(0, 1).toUpperCase() : '👤')}
        </div>
        <div>
          <h3 style={{ fontSize: '16px', color: '#F3F4F6' }}>{userData ? userData.name : 'Test Member'}</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{userData ? userData.email : '이메일 정보 없음'}</span>
        </div>
      </div>

      {portfolio ? (
        <SutPriceCard 
          sutPrice={sutPrice}
          sutChange24h={sutChange24h}
          krwRate={portfolio.krwRate}
          priceHistory={priceHistory}
          sutHigh24h={portfolio.sutHigh24h}
          sutLow24h={portfolio.sutLow24h}
          isMobile={true}
        />
      ) : (
        <div className="shimmer-loading" style={{ height: '160px', borderRadius: '12px' }}></div>
      )}

      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '16px', color: '#F3F4F6', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Wallet size={18} color="#8B5CF6" />
            {DASHBOARD_COPY.assetOverview}
          </h3>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleApprovalRecovery}
            disabled={recoveringApproval}
            style={{
              width: 'auto',
              padding: '6px 10px',
              fontSize: '11px',
              borderRadius: '999px',
              whiteSpace: 'nowrap',
            }}
          >
            {recoveringApproval ? '복구 중...' : '위임 복구'}
          </button>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
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
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{DASHBOARD_COPY.totalAssets}</span>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#F3F4F6', fontFamily: 'var(--font-title)', marginTop: '4px' }}>
                    {totalAssets.toFixed(2)} SUT
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{DASHBOARD_COPY.walletBalance}</span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#8B5CF6' }}>{walletSutBalance.toFixed(2)} SUT <span style={{fontSize:'10px', fontWeight:'normal'}}>({walletPercent.toFixed(1)}%)</span></span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{DASHBOARD_COPY.managedAssets}</span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--success-color)' }}>{portfolio ? portfolio.totalInvested.toFixed(2) : '0.00'} SUT <span style={{fontSize:'10px', fontWeight:'normal'}}>({depositedPercent.toFixed(1)}%)</span></span>
                  </div>
                </div>

                <div style={{ marginTop: '10px', marginBottom: '20px', width: '100%', height: '14px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '10px', overflow: 'hidden', display: 'flex' }}>

                  <div style={{ width: `${walletPercent}%`, height: '100%', background: 'var(--primary-gradient)', transition: 'width 0.5s ease' }}></div>

                  <div style={{ width: `${depositedPercent}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #059669)', transition: 'width 0.5s ease' }}></div>
                </div>
              </>
            );
          })()}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '13px' }} onClick={() => { setTxType('DEPOSIT'); setShowTxModal(true); }}>{DASHBOARD_COPY.depositAction}</button>
            <button className="btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '13px', background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', borderColor: 'rgba(239, 68, 68, 0.2)' }} onClick={() => { setTxType('WITHDRAW'); setShowTxModal(true); }}>{DASHBOARD_COPY.withdrawAction}</button>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '12px 2px 0' }}>
            Trust Wallet에서 기존 Polygon SUT 위임을 삭제하거나 수량을 바꾼 뒤 거래가 막히면 위임 복구로 1,000,000 SUT 위임을 다시 등록해 주세요.
          </p>
        </div>
      </div>



      {showTxModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-card" style={{ width: '90%', maxWidth: '380px', background: 'var(--bg-app)', border: '1px solid rgba(255,255,255,0.1)', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px', color: '#F3F4F6' }}>
              {txType === 'DEPOSIT' ? DASHBOARD_COPY.depositAction : DASHBOARD_COPY.withdrawAction}
            </h3>
            <form onSubmit={handleTxSubmit}>
              <div className="form-group">
                <label className="form-label">{txType === 'DEPOSIT' ? DASHBOARD_COPY.depositAmount : DASHBOARD_COPY.withdrawAmount}</label>
                <input type="number" className="form-input" placeholder="예: 250" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} min="1" required />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                {txType === 'DEPOSIT'
                  ? '입금한 SUT는 운용 자산에 반영됩니다.'
                  : '출금 신청 금액은 운용 자산에서 차감되며 승인 후 연결된 지갑으로 전송됩니다.'}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowTxModal(false)} style={{ flex: 1 }}>취소</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, background: txType === 'DEPOSIT' ? 'var(--primary-gradient)' : 'var(--danger-color)' }} disabled={processingTx}>{processingTx ? '처리 중...' : txType === 'DEPOSIT' ? DASHBOARD_COPY.depositSubmit : DASHBOARD_COPY.withdrawSubmit}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="glass-card" style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h3 style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#F3F4F6' }}>
            <span style={{ color: 'var(--accent-color)' }}>📜</span> {DASHBOARD_COPY.recentTransactions}
          </h3>
          <button
            onClick={() => navigate('/history')}
            style={{
              background: 'transparent', border: 'none', color: 'var(--accent-color)',
              fontSize: '12px', fontWeight: '600', cursor: 'pointer'
            }}
          >
            전체 보기 &gt;
          </button>
        </div>

        {txHistory && txHistory.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {txHistory.slice(0, 3).map(tx => {
              const isDeposit = tx.type !== 'WITHDRAW_REQUEST';
              return (
                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--glass-border)' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#F3F4F6', marginBottom: '4px' }}>
                      {isDeposit ? DASHBOARD_COPY.depositCompleted : DASHBOARD_COPY.withdrawalPending}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatKoreanDateTime(tx.createdAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', fontFamily: 'var(--font-title)', color: isDeposit ? 'var(--success-color)' : 'var(--danger-color)' }}>
                      {isDeposit ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)} SUT
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            {DASHBOARD_COPY.noTransactions}
          </div>
        )}
      </div>



      <button
        type="button"
        className="btn-secondary"
        style={{ padding: '14px', fontSize: '14px', color: 'var(--danger-color)', borderColor: 'rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.02)', marginTop: '5px', display: 'flex', justifyContent: 'center', gap: '8px' }}
        onClick={onLogout}
      >
        🔌 {DASHBOARD_COPY.logout}
      </button>

      {!canAccessManager && (
      <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-dark)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <div>💬 담당 매니저 문의</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href={`mailto:${userData?.managerEmail || 'lemaiiisk@gmail.com'}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              ✉️ {userData?.managerEmail || 'lemaiiisk@gmail.com'}
            </a>
            <span style={{ color: 'var(--glass-border)' }}>|</span>
            <a href={`tel:${userData?.managerPhone || '010-2020-6447'}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              📞 {userData?.managerPhone || '010-2020-6447'}
            </a>
          </div>
        </div>
      </div>
      )}

    </div>
  );
}

export default UserDashboard;
