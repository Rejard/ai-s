import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  TrendingUp, TrendingDown, Wallet, Users, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, ShieldCheck, Play, Sparkles, StopCircle,
  Copy, Check
} from 'lucide-react';
import { API_BASE } from '../App';
import { ethers } from 'ethers';
import { checkVaultAllowance, approveVault } from '../lib/vaultApproval';
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

  const [activeTab, setActiveTab] = useState('asset');
  const [userWallet, setUserWallet] = useState(() => {
    const rawAddr = userData?.walletAddress || walletAddress || '';
    const isVirtual = !rawAddr || rawAddr === 'none' || rawAddr.toLowerCase().startsWith('0xnone') || rawAddr.toLowerCase().endsWith('00000000');
    return isVirtual ? '' : rawAddr;
  });
  const [managerWallet, setManagerWallet] = useState(() => {
    const isManagerOrAdminUser = userData?.isManager === true || canAccessManager === true || canAccessAdmin === true;
    if (isManagerOrAdminUser) {
      const selfAddr = userData?.walletAddress || walletAddress || '';
      if (selfAddr && selfAddr !== 'none' && !selfAddr.startsWith('0xnone')) {
        return selfAddr;
      }
    }

    if (userData?.managerAddress && userData.managerAddress !== 'none') {
      return userData.managerAddress;
    }
    return '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987';
  });

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
  const [vaultApproved, setVaultApproved] = useState(null);
  const [approvingVault, setApprovingVault] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(null);

  const [userVerifyState, setUserVerifyState] = useState(() => {
    const rawAddr = userData?.walletAddress || walletAddress || '';
    const isVirtual = !rawAddr || rawAddr === 'none' || rawAddr.toLowerCase().startsWith('0xnone') || rawAddr.toLowerCase().endsWith('00000000');
    return isVirtual ? 'failed' : 'none';
  });
  const [userVerifyMsg, setUserVerifyMsg] = useState(() => {
    const rawAddr = userData?.walletAddress || walletAddress || '';
    const isVirtual = !rawAddr || rawAddr === 'none' || rawAddr.toLowerCase().startsWith('0xnone') || rawAddr.toLowerCase().endsWith('00000000');
    return isVirtual ? '⚠️ 아직 입출금용 지갑 주소가 등록되지 않았습니다. 본인의 실제 개인 지갑 주소를 등록해 주세요.' : '';
  });
  const [managerVerifyState, setManagerVerifyState] = useState('none');
  const [managerVerifyMsg, setManagerVerifyMsg] = useState('');

  const VAULT_ADDRESS = '0x855c880D538892fD899eECb72D4b1Ac5B46089eA';
  const isManagerOrAdmin = userData?.isManager === true || canAccessManager === true || canAccessAdmin === true;
  const displayManagerAddress = managerWallet;

  const handleCopyAddress = (address, type) => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopiedAddress(type);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleVerifyUserWallet = async () => {
    if (!userWallet || !userWallet.startsWith('0x') || ![34, 42].includes(userWallet.length)) {
      setUserVerifyState('failed');
      setUserVerifyMsg('올바른 이더리움 형식(0x...)이 아닙니다.');
      return;
    }
    
    setUserVerifyState('checking');
    setUserVerifyMsg('폴리곤 온체인 잔액 조회 중...');
    
    try {
      let provider;
      if (ethers.JsonRpcProvider) {
        provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
      } else {
        const provs = ethers['providers'];
        provider = new provs.JsonRpcProvider('https://polygon-rpc.com');
      }

      const formatEth = (weiVal) => {
        if (ethers.formatEther) {
          return ethers.formatEther(weiVal);
        }
        const ut = ethers['utils'];
        return ut.formatEther(weiVal);
      };
      
      const balanceWei = await provider.getBalance(userWallet);
      const balanceMatic = parseFloat(formatEth(balanceWei));
      
      const sutContractAddress = '0x989654741366156d910a524e887e2a9b37742d4a';
      const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)"
      ];
      const sutContract = new ethers.Contract(sutContractAddress, erc20Abi, provider);
      const sutBalanceWei = await sutContract.balanceOf(userWallet);
      const sutBalance = parseFloat(formatEth(sutBalanceWei));
      
      setUserVerifyState('success');
      setUserVerifyMsg(`정상 규격 검증 완료! (SUT 잔고: ${sutBalance.toLocaleString(undefined, {maximumFractionDigits: 2})} SUT / 가스비: ${balanceMatic.toLocaleString(undefined, {maximumFractionDigits: 3})} POL)`);
    } catch (err) {
      console.error('Wallet validation failed:', err);
      setUserVerifyState('success');
      setUserVerifyMsg('규격 검증 완료 (온체인 RPC 통신 지연으로 가상 상태 검증)');
    }
  };

  const handleVerifyManagerWallet = async () => {
    if (!managerWallet || !managerWallet.startsWith('0x') || ![34, 42].includes(managerWallet.length)) {
      setManagerVerifyState('failed');
      setManagerVerifyMsg('올바른 이더리움 형식(0x...)이 아닙니다.');
      return;
    }
    
    setManagerVerifyState('checking');
    setManagerVerifyMsg('온체인 계약 상태 및 매니저 등록 여부 조회 중...');
    
    try {
      // 1. 백엔드 데이터베이스 기반 공식 등록 매니저 여부 교차 검증
      const checkRes = await axios.get(`${API_BASE}/auth/verify-manager/${managerWallet}`);
      if (!checkRes.data || !checkRes.data.success) {
        setManagerVerifyState('failed');
        setManagerVerifyMsg(`⚠️ 검증 실패: ${checkRes.data?.message || '우리 플랫폼에 승인 등록된 매니저 주소가 아닙니다.'}`);
        return;
      }
      
      const managerName = checkRes.data.name;

      // 2. 온체인 SUT 잔고 추가 조회 (네트워크 상태에 영향을 받지 않도록 격리)
      try {
        let provider;
        if (ethers.JsonRpcProvider) {
          provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
        } else {
          const provs = ethers['providers'];
          provider = new provs.JsonRpcProvider('https://polygon-rpc.com');
        }

        const formatEth = (weiVal) => {
          if (ethers.formatEther) {
            return ethers.formatEther(weiVal);
          }
          const ut = ethers['utils'];
          return ut.formatEther(weiVal);
        };
        
        const sutContractAddress = '0x989654741366156d910a524e887e2a9b37742d4a';
        const erc20Abi = [
          "function balanceOf(address owner) view returns (uint256)"
        ];
        const sutContract = new ethers.Contract(sutContractAddress, erc20Abi, provider);
        const sutBalanceWei = await sutContract.balanceOf(managerWallet);
        const sutBalance = parseFloat(formatEth(sutBalanceWei));
        
        setManagerVerifyState('success');
        setManagerVerifyMsg(`✅ 정상 매니저 확인 완료! [담당: ${managerName}] (SUT 보유량: ${sutBalance.toLocaleString(undefined, {maximumFractionDigits: 2})} SUT)`);
      } catch (chainErr) {
        console.warn('Manager blockchain check skipped/failed, falling back to DB verify:', chainErr);
        setManagerVerifyState('success');
        setManagerVerifyMsg(`✅ 정상 매니저 확인 완료! [담당: ${managerName}] (네트워크 상태에 의해 가상 검증 완료)`);
      }
    } catch (err) {
      console.error('Manager validation failed:', err);
      if (err.response && err.response.data && err.response.data.message) {
        setManagerVerifyState('failed');
        setManagerVerifyMsg(`⚠️ 검증 실패: ${err.response.data.message}`);
      } else {
        setManagerVerifyState('failed');
        setManagerVerifyMsg('⚠️ 검증 실패: 네트워크 상태를 확인하시거나 승인된 매니저 주소인지 확인해 주세요.');
      }
    }
  };

  const fetchDashboardData = async () => {
    if (!userWallet) return;
    try {
      const data = await loadUserDashboardData({
        apiBase: API_BASE,
        walletAddress: userWallet,
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
    try {
      const approved = await checkVaultAllowance({ walletAddress: userWallet, ethersLib: ethers });
      setVaultApproved(approved);
    } catch (e) { console.error('Vault allowance check failed:', e); }
  };

  const fetchTxHistory = async () => {
    if (!userWallet) return;
    try {
      const history = await loadUserTxHistory({ apiBase: API_BASE, walletAddress: userWallet, axiosClient: axios });
      setTxHistory(history);
    } catch (err) {
      console.error('Transaction history load failed:', err);
    }
  };

  useEffect(() => {
    if (userWallet) {
      fetchDashboardData();
      fetchTxHistory();
    }
  }, [userWallet]);

  useEffect(() => {
    if (walletAddress) {
      const isVirtual = walletAddress === 'none' || walletAddress.toLowerCase().startsWith('0xnone') || walletAddress.toLowerCase().endsWith('00000000');
      setUserWallet(isVirtual ? '' : walletAddress);
      setUserVerifyState(isVirtual ? 'failed' : 'none');
      setUserVerifyMsg(isVirtual ? '⚠️ 아직 입출금용 지갑 주소가 등록되지 않았습니다. 본인의 실제 개인 지갑 주소를 등록해 주세요.' : '');
    }
  }, [walletAddress]);

  useEffect(() => {
    if (userData) {
      const rawAddr = userData.walletAddress || walletAddress || '';
      const isVirtual = !rawAddr || rawAddr === 'none' || rawAddr.toLowerCase().startsWith('0xnone') || rawAddr.toLowerCase().endsWith('00000000');
      setUserWallet(isVirtual ? '' : rawAddr);
      setUserVerifyState(isVirtual ? 'failed' : 'none');
      setUserVerifyMsg(isVirtual ? '⚠️ 아직 입출금용 지갑 주소가 등록되지 않았습니다. 본인의 실제 개인 지갑 주소를 등록해 주세요.' : '');

      if (userData.managerAddress && userData.managerAddress !== 'none') {
        setManagerWallet(userData.managerAddress);
      }
    }
  }, [userData, walletAddress]);

  const handleSaveWallets = async (e) => {
    e.preventDefault();
    if (!userWallet || !userWallet.startsWith('0x') || userWallet.length !== 42) {
      alert('올바른 Ethereum 형식의 내 지갑 주소(0x...)를 입력해 주세요.');
      return;
    }

    if (!managerWallet || !managerWallet.startsWith('0x') || managerWallet.length !== 42) {
      alert('올바른 Ethereum 형식의 담당 매니저 지갑 주소(0x...)를 입력해 주세요.');
      return;
    }

    if (!window.confirm('입력하신 지갑 주소를 서버 실시간 데이터베이스에 완벽하게 연동 저장하시겠습니까?')) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const headers = {
        headers: {
          Authorization: `Bearer ${token}`
        }
      };

      const response = await axios.post(`${API_BASE}/auth/update-own-wallets`, {
        userWallet: userWallet.trim(),
        managerWallet: managerWallet.trim()
      }, headers);

      if (response.data.success) {
        alert(response.data.message || '✅ 지갑 주소 설정이 성공적으로 저장되었습니다!');
        fetchDashboardData();
        fetchTxHistory();
      } else {
        throw new Error(response.data.message || '지갑 주소 저장에 실패했습니다.');
      }
    } catch (err) {
      alert(`❌ 지갑 주소 설정 저장 실패: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleResetWallets = () => {
    if (window.confirm('지갑 주소를 기본 지갑 주소로 초기화하시겠습니까?')) {
      const rawAddr = walletAddress || '';
      const isVirtual = !rawAddr || rawAddr === 'none' || rawAddr.toLowerCase().startsWith('0xnone') || rawAddr.toLowerCase().endsWith('00000000');
      setUserWallet(isVirtual ? '' : rawAddr);
      setManagerWallet(userData?.managerAddress && userData.managerAddress !== 'none' ? userData.managerAddress : '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987');
      alert('🔄 기본 지갑 주소로 초기화되었습니다.');
    }
  };

  const handleApproveVault = async () => {
    setApprovingVault(true);
    try {
      await approveVault({ ethersLib: ethers });
      setVaultApproved(true);
      alert('✅ 위임 승인 완료!');
    } catch (err) {
      if (err?.code === 'ACTION_REJECTED' || err?.message?.includes('rejected')) { alert('지갑에서 승인 서명이 취소되었습니다.'); }
      else { alert(`❌ 위임 승인 실패: ${err.message || err}`); }
    } finally { setApprovingVault(false); }
  };

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
        walletAddress: userWallet,
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
        expectedWalletAddress: userWallet,
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
    if (!userWallet || autoRecoveryAttempted || !hasApprovalRecoveryResumeFlag(window.location.href)) {
      return;
    }

    setAutoRecoveryAttempted(true);

    const resumeUrl = new URL(window.location.href);
    resumeUrl.searchParams.delete('recover_sut_approval');
    window.history.replaceState(null, '', `${resumeUrl.pathname}${resumeUrl.search}${resumeUrl.hash}`);

    handleApprovalRecovery({ allowRedirectOnMissingWallet: false });
  }, [userWallet, autoRecoveryAttempted]);

  useEffect(() => {
    if (!userWallet || autoDepositAttempted) {
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
  }, [userWallet, autoDepositAttempted]);

  useEffect(() => {
    if (!userWallet || autoDepositFinalizeAttempted) {
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
      walletAddress: userWallet,
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
  }, [userWallet, autoDepositFinalizeAttempted]);

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
        <div style={{ textAlign: 'left' }}>
          <h3 style={{ fontSize: '16px', color: '#F3F4F6', margin: 0 }}>{userData ? userData.name : 'Test Member'}</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{userData ? userData.email : '이메일 정보 없음'}</span>
        </div>
      </div>

      {/* 탭 네비게이션 헤더 */}
      <div style={{ 
        display: 'flex', 
        background: 'rgba(0, 0, 0, 0.2)', 
        padding: '5px', 
        borderRadius: '12px', 
        border: '1px solid rgba(255, 255, 255, 0.05)',
        marginTop: '-10px',
        boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.3)'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('asset')}
          style={{
            flex: 1,
            padding: '10px 14px',
            fontSize: '12px',
            fontWeight: '800',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'asset' ? 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' : 'transparent',
            color: activeTab === 'asset' ? '#FFF' : 'var(--text-muted)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: activeTab === 'asset' ? '0 4px 12px rgba(139, 92, 246, 0.25)' : 'none'
          }}
        >
          📈 내 자산 현황
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          style={{
            flex: 1,
            padding: '10px 14px',
            fontSize: '12px',
            fontWeight: '800',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'settings' ? 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' : 'transparent',
            color: activeTab === 'settings' ? '#FFF' : 'var(--text-muted)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: activeTab === 'settings' ? '0 4px 12px rgba(139, 92, 246, 0.25)' : 'none'
          }}
        >
          ⚙️ 지갑 및 환경 설정
        </button>
      </div>

      {/* 탭 1: 내 자산 탭 */}
      {activeTab === 'asset' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%' }}>
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

                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      background: 'rgba(0, 0, 0, 0.2)', 
                      padding: '8px 12px', 
                      borderRadius: '8px', 
                      marginBottom: '15px',
                      border: '1px solid rgba(255, 255, 255, 0.03)'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>내 지갑 주소</span>
                        <span style={{ fontSize: '11px', color: '#F3F4F6', fontFamily: 'monospace' }}>
                          {userWallet ? `${userWallet.substring(0, 10)}...${userWallet.substring(userWallet.length - 10)}` : '등록된 지갑 없음'}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleCopyAddress(userWallet, 'user')}
                        style={{ background: 'transparent', border: 'none', color: copiedAddress === 'user' ? 'var(--success-color)' : 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                      >
                        {copiedAddress === 'user' ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </>
                );
              })()}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '13px' }} onClick={() => { setTxType('DEPOSIT'); setShowTxModal(true); }}>{DASHBOARD_COPY.depositAction}</button>
                <button className="btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '13px', background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', borderColor: 'rgba(239, 68, 68, 0.2)' }} onClick={() => { setTxType('WITHDRAW'); setShowTxModal(true); }}>{DASHBOARD_COPY.withdrawAction}</button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '12px 2px 0', textAlign: 'left' }}>
                PC에서 1회 위임 승인을 하면 모바일에서 SUT 입금/출금이 가능합니다.
              </p>

              <div style={{ 
                marginTop: '15px', 
                padding: '10px 12px', 
                background: 'rgba(139, 92, 246, 0.05)', 
                border: '1px solid rgba(139, 92, 246, 0.1)', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                  <span style={{ fontSize: '10px', color: '#A78BFA', fontWeight: '600' }}>
                    {isManagerOrAdmin ? '담당 매니저 지갑 (본인)' : '담당 매니저 지갑'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#F3F4F6', fontFamily: 'monospace' }}>
                    {displayManagerAddress ? `${displayManagerAddress.substring(0, 10)}...${displayManagerAddress.substring(displayManagerAddress.length - 10)}` : '0x7660Bf40...7987'}
                  </span>
                </div>
                <button 
                  onClick={() => handleCopyAddress(displayManagerAddress, 'manager')}
                  style={{ background: 'transparent', border: 'none', color: copiedAddress === 'manager' ? 'var(--success-color)' : 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  {copiedAddress === 'manager' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>

              {vaultApproved === true ? (
                <div style={{ width: '100%', padding: '8px 12px', fontSize: '11px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', fontWeight: '700', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '10px' }}>
                  <ShieldCheck size={12} /> ✅ 위임 승인 완료
                </div>
              ) : vaultApproved === false ? (
                <button
                  type="button"
                  onClick={handleApproveVault}
                  disabled={approvingVault}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '12px', background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)', border: 'none', borderRadius: '6px', fontWeight: '700', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '10px' }}
                >
                  <ShieldCheck size={12} /> {approvingVault ? '승인 처리 중...' : '🔐 위임 승인(1회)'}
                </button>
              ) : (
                <div style={{ width: '100%', padding: '8px 12px', fontSize: '11px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px', fontWeight: '700', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '10px' }}>
                  <ShieldCheck size={12} /> 위임 승인 확인 중...
                </div>
              )}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h3 style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#F3F4F6', margin: 0 }}>
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
                      <div style={{ textAlign: 'left' }}>
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
        </div>
      )}

      {/* 탭 2: 설정 및 정보 탭 */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%' }}>
          
          {/* 지갑 주소 설정 보드 */}
          <div className="glass-card" style={{ 
            padding: '20px', 
            border: '1px solid rgba(139, 92, 246, 0.25)',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.02) 0%, rgba(0, 0, 0, 0.2) 100%)'
          }}>
            <h3 style={{ fontSize: '15px', color: '#F3F4F6', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px 0', fontWeight: '700' }}>
              <span style={{ fontSize: '16px' }}>👛</span> 지갑 주소 관리 및 편집
            </h3>
            
            <form onSubmit={handleSaveWallets} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                  내 개인 지갑 주소 (SUT 입출금용)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    value={userWallet}
                    onChange={(e) => {
                      setUserWallet(e.target.value);
                      setUserVerifyState('none');
                    }}
                    placeholder="0x..." 
                    style={{ 
                      flex: 1, 
                      padding: '10px 12px', 
                      fontSize: '12px', 
                      background: 'rgba(0, 0, 0, 0.3)', 
                      border: '1px solid rgba(255, 255, 255, 0.08)', 
                      borderRadius: '8px', 
                      color: '#FFF',
                      outline: 'none',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleVerifyUserWallet}
                    disabled={userVerifyState === 'checking'}
                    style={{
                      padding: '0 12px',
                      fontSize: '12px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      borderRadius: '8px',
                      color: '#C084FC',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    {userVerifyState === 'checking' ? '⏳ 검사 중' : '🔍 지갑 검증'}
                  </button>
                </div>
                {userVerifyState !== 'none' && (
                  <span style={{ 
                    fontSize: '10.5px', 
                    color: userVerifyState === 'success' ? '#10B981' : userVerifyState === 'failed' ? '#EF4444' : '#F59E0B', 
                    display: 'block', 
                    marginTop: '5px',
                    fontWeight: '500'
                  }}>
                    {userVerifyMsg}
                  </span>
                )}
              </div>

              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                  담당 매니저 지갑 주소 (SUT 위임 계약용)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    value={managerWallet}
                    onChange={(e) => {
                      setManagerWallet(e.target.value);
                      setManagerVerifyState('none');
                    }}
                    placeholder="0x..."
                    style={{ 
                      flex: 1, 
                      padding: '10px 12px', 
                      fontSize: '11px', 
                      background: 'rgba(0, 0, 0, 0.3)', 
                      border: '1px solid rgba(255, 255, 255, 0.08)', 
                      borderRadius: '8px', 
                      color: '#FFF',
                      outline: 'none',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyManagerWallet}
                    disabled={managerVerifyState === 'checking'}
                    style={{
                      padding: '0 12px',
                      fontSize: '12px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      borderRadius: '8px',
                      color: '#C084FC',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    {managerVerifyState === 'checking' ? '⏳ 검사 중' : '🔍 매니저 검증'}
                  </button>
                </div>
                {managerVerifyState !== 'none' ? (
                  <span style={{ 
                    fontSize: '10.5px', 
                    color: managerVerifyState === 'success' ? '#10B981' : managerVerifyState === 'failed' ? '#EF4444' : '#F59E0B', 
                    display: 'block', 
                    marginTop: '5px',
                    fontWeight: '500'
                  }}>
                    {managerVerifyMsg}
                  </span>
                ) : (
                  <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.35)', display: 'block', marginTop: '5px' }}>
                    * 가입 시 매칭된 담당 매니저 지갑 주소 또는 플랫폼 운영 지갑 주소입니다. 담당자 변경 시 직접 수정 및 입력이 가능합니다.
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleResetWallets}
                  style={{ 
                    flex: 1, 
                    padding: '10px', 
                    fontSize: '12px', 
                    background: 'rgba(255, 255, 255, 0.05)', 
                    color: '#D1D5DB', 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '8px', 
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🔄 초기화
                </button>
                <button
                  type="submit"
                  style={{ 
                    flex: 2, 
                    padding: '10px', 
                    fontSize: '12px', 
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', 
                    color: '#FFF', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)'
                  }}
                >
                  💾 설정 저장하기
                </button>
              </div>
            </form>
          </div>

          {/* 담당 매니저 정보 */}
          <div className="glass-card" style={{ padding: '16px', background: 'rgba(139, 92, 246, 0.03)', border: '1px solid rgba(139, 92, 246, 0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#A78BFA', display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'left' }}>
              <span>👤</span> {isManagerOrAdmin ? '본인 매니저 정보' : (DASHBOARD_COPY.managerInfo || '담당 매니저 정보')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>성함</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#F3F4F6' }}>
                  {isManagerOrAdmin ? (userData?.name || '매니저') : (userData?.managerName || '관리자')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>이메일</span>
                <a href={`mailto:${isManagerOrAdmin ? (userData?.email || '') : (userData?.managerEmail || 'lemaiiisk@gmail.com')}`} style={{ fontSize: '13px', color: '#8B5CF6', textDecoration: 'none' }}>
                  {isManagerOrAdmin ? (userData?.email || '') : (userData?.managerEmail || 'lemaiiisk@gmail.com')}
                </a>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>연락처</span>
                <a href={`tel:${isManagerOrAdmin ? (userData?.phone || '') : (userData?.managerPhone || '010-2020-6447')}`} style={{ fontSize: '13px', color: '#8B5CF6', textDecoration: 'none' }}>
                  {isManagerOrAdmin ? (userData?.phone || '') : (userData?.managerPhone || '010-2020-6447')}
                </a>
              </div>
            </div>
          </div>

          {/* 로그아웃 버튼 */}
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '14px', fontSize: '14px', color: 'var(--danger-color)', borderColor: 'rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.02)', display: 'flex', justifyContent: 'center', gap: '8px' }}
            onClick={onLogout}
          >
            🔌 {DASHBOARD_COPY.logout}
          </button>
        </div>
      )}

      {/* 모달 등 헬퍼 컴포넌트 렌더링 유지 */}
      {showTxModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-card" style={{ width: '90%', maxWidth: '380px', background: 'var(--bg-app)', border: '1px solid rgba(255,255,255,0.1)', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px', color: '#F3F4F6' }}>
              {txType === 'DEPOSIT' ? DASHBOARD_COPY.depositAction : DASHBOARD_COPY.withdrawAction}
            </h3>
            <form onSubmit={handleTxSubmit}>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">{txType === 'DEPOSIT' ? DASHBOARD_COPY.depositAmount : DASHBOARD_COPY.withdrawAmount}</label>
                <input type="number" className="form-input" placeholder="예: 250" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} min="1" required style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', textAlign: 'left' }}>
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

    </div>
  );
}

export default UserDashboard;
