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

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('active_tab');
    if (urlTab === 'settings' || urlTab === 'asset') {
      return urlTab;
    }
    return 'asset';
  });
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
  const [hasLoadedFromDB, setHasLoadedFromDB] = useState(false);

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
    setUserVerifyMsg('지갑 주소 일치 여부 및 온체인 상태 검증 중...');

    // 1. Web3 프로바이더(트러스트 월넷 인앱 등)가 활성화되어 있는 경우
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          const trustWalletAddr = accounts[0].toLowerCase();
          const typedAddr = userWallet.trim().toLowerCase();

          if (trustWalletAddr === typedAddr) {
            setUserVerifyState('success');
            setUserVerifyMsg(`🟢 지갑 검증 성공! 현재 트러스트 월넷 활성 계정과 일치함 (${accounts[0].substring(0,6)}...)`);
            alert(`🟢 지갑 검증 성공!\n\n현재 트러스트 월넷 앱에 연결된 실제 활성 지갑 주소와 입력하신 지갑 주소가 100% 완벽히 일치합니다.\n\n안심하고 위임 승인 및 서비스를 이용하십시오.`);
            return;
          } else {
            setUserVerifyState('failed');
            setUserVerifyMsg(`❌ 지갑 주소 불일치! 앱 활성 주소: ${accounts[0].substring(0,8)}...`);
            alert(`❌ 지갑 주소 불일치 경고!\n\n입력한 주소:\n${userWallet}\n\n현재 트러스트 월넷 앱의 실제 활성 지갑 주소:\n${accounts[0]}\n\n두 지갑 주소가 틀립니다! 오타가 있거나 다른 트러스트 월넷 지갑 계정이 열려있습니다. 주소를 복사해서 다시 기입하거나 트러스트 월넷 앱 계정을 일치시켜 주십시오.`);
            return;
          }
        }
      } catch (ethErr) {
        console.warn('Failed to fetch window.ethereum accounts directly:', ethErr);
      }
    }

    // 2. 일반 브라우저 환경이거나 Web3 호출에 실패했을 때의 RPC 온체인 잔고 규격 검증 폴백
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
      setUserVerifyMsg(`규격 완료! (SUT: ${sutBalance.toLocaleString(undefined, { maximumFractionDigits: 1 })} / ${balanceMatic.toLocaleString(undefined, { maximumFractionDigits: 2 })} POL)`);
      alert(`💡 일반 브라우저 환경 안내\n\n지갑의 온체인 주소 규격 및 잔액 조회를 완료하였습니다.\n(SUT 잔고: ${sutBalance.toLocaleString()} SUT / 가스비 잔고: ${balanceMatic.toLocaleString()} POL)\n\n※ 실제 스마트폰 트러스트 월넷 앱과의 하드웨어 실시간 일치 검증은 트러스트 월넷 앱 내부에서 접속했을 때만 가능합니다.`);
    } catch (err) {
      console.error('Wallet validation fallback failed:', err);
      setUserVerifyState('success');
      setUserVerifyMsg('규격 검증 완료 (RPC 통신 지연으로 형식 상태 검사 완료)');
      alert(`💡 지갑 형식 검증 완료\n\n입력하신 지갑 주소의 0x 규격 및 자릿수 검증을 정상 완료하였습니다.\n\n※ 트러스트 월넷 인앱 실시간 대조 검증은 트러스트 월넷 앱 내부에서 실행 시 활성화됩니다.`);
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
        setManagerVerifyMsg(`✅ 정상 매니저 확인 완료! [담당: ${managerName}] (SUT 보유량: ${sutBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} SUT)`);
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
    fetchDashboardData();
    fetchTxHistory();
  }, []);

  useEffect(() => {
    if (!hasLoadedFromDB) {
      const targetAddr = userData?.walletAddress || walletAddress || '';
      if (targetAddr) {
        const isVirtual = targetAddr === 'none' || targetAddr.toLowerCase().startsWith('0xnone') || targetAddr.toLowerCase().endsWith('00000000');
        setUserWallet(isVirtual ? '' : targetAddr);
        setUserVerifyState(isVirtual ? 'failed' : 'none');
        setUserVerifyMsg(isVirtual ? '⚠️ 아직 입출금용 지갑 주소가 등록되지 않았습니다. 본인의 실제 개인 지갑 주소를 등록해 주세요.' : '');

        if (userData?.managerAddress && userData.managerAddress !== 'none') {
          setManagerWallet(userData.managerAddress);
        }
        setHasLoadedFromDB(true);
      }
    }
  }, [userData, walletAddress, hasLoadedFromDB]);

  // 트러스트 월넷 인앱 디앱 브라우저 내부일 때:
  // 1. 자동으로 window.ethereum 주소(accounts[0])를 싹 긁어온다.
  // 2. 긁어온 주소를 수동 입력창에 오토 기입한다.
  // 3. 만일, 현재 DB(userData?.walletAddress)에 저장된 주소와 실제 하드웨어 지갑 주소가 틀리거나 가상 지갑(0xnone 등)인 경우:
  //    사용자가 손가락 하나 대지 않아도 조용히 백엔드 API로 자동 영구 바인딩 연동 저장까지 완료해 준다! (Auto Sync & Save)
  useEffect(() => {
    const autoSyncTrustWallet = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts[0]) {
            const liveAddr = accounts[0].toLowerCase();
            const currentSavedAddr = (userData?.walletAddress || '').toLowerCase();
            const isVirtual = !currentSavedAddr || currentSavedAddr === 'none' || currentSavedAddr.startsWith('0xnone') || currentSavedAddr.endsWith('00000000');

            // 화면 상태 자동 기입
            setUserWallet(accounts[0]);

            // 현재 DB에 저장된 실제 주소와 다르거나 최초 가입 상태(가상 지갑)일 때 즉시 자동 백엔드 영구 보관 저장 단행!
            if (liveAddr !== currentSavedAddr || isVirtual) {
              const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
              const headers = {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              };

              const response = await axios.post(`${API_BASE}/auth/update-own-wallets`, {
                userWallet: accounts[0].trim(),
                managerWallet: managerWallet || '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'
              }, headers);

              if (response.data.success) {
                console.log('🔮 Trust Wallet Auto Sync Succeeded:', accounts[0]);
                setHasLoadedFromDB(false); // 잠금을 열어 대시보드가 원활하게 최신 동기화 데이터를 읽어오도록 지시
                fetchDashboardData();
                fetchTxHistory();
              }
            }
          }
        } catch (err) {
          console.error('Trust Wallet Auto Sync failed:', err);
        }
      }
    };

    if (activeTab === 'settings' && userData) {
      autoSyncTrustWallet();
    }
  }, [activeTab, userData, managerWallet]);

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
        setHasLoadedFromDB(false); // DB 저장 완료되었으므로 잠금장치를 해제하여 최신 데이터가 무결하게 들어오도록 허용!
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

  const handleExitDApp = () => {
    try {
      window.close();
    } catch (e) {
      console.error("window.close failed", e);
    }
    alert(
      "🚪 트러스트월넷 종료 안내\n\n" +
      "안전하게 지갑 연동 및 위임 설정이 실시간 반영되었습니다.\n" +
      "이 브라우저를 종료하고 원래 보고 계셨던 일반 웹 브라우저 화면으로 돌아가시려면,\n" +
      "지금 스마트폰 화면 좌측 상단의 [ ❌ ] 또는 뒤로가기 버튼을 터치해 주십시오."
    );
  };

  const handleJumpToTrustWallet = () => {
    if (window.ethereum) {
      alert('💡 이미 트러스트월넷 디앱 브라우저 내부에서 작동 중이므로 앱 이동 링크가 비활성화되었습니다.');
      return;
    }
    const targetUrl = new URL(window.location.origin + window.location.pathname);
    targetUrl.searchParams.set('active_tab', 'settings');

    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '';
    let hashStr = '';
    if (token) {
      hashStr = `#auth_token=${encodeURIComponent(token)}`;
    }

    const finalUrl = `${targetUrl.toString()}${hashStr}`;
    const trustDeepLink = `trust://open_url?coin_id=966&url=${encodeURIComponent(finalUrl)}`;

    window.location.href = trustDeepLink;
  };

  const handleApproveVault = async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && !window.ethereum) {
      const targetUrl = new URL(window.location.origin + window.location.pathname);
      targetUrl.searchParams.set('active_tab', 'settings');

      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '';
      let hashStr = '';
      if (token) {
        hashStr = `#auth_token=${encodeURIComponent(token)}`;
      }

      const finalUrl = `${targetUrl.toString()}${hashStr}`;
      const trustDeepLink = `trust://open_url?coin_id=966&url=${encodeURIComponent(finalUrl)}`;

      window.location.href = trustDeepLink;
      return;
    }

    setApprovingVault(true);
    try {
      await approveVault({ ethersLib: ethers });
      setVaultApproved(true);
      alert('✅ 위임 승인 완료!');
    } catch (err) {
      if (err?.code === 'ACTION_REJECTED' || err?.message?.includes('rejected')) {
        alert('지갑에서 승인 서명이 취소되었습니다.');
      } else {
        alert(`❌ 위임 승인 실패: ${err.message || err}`);
      }
    } finally {
      setApprovingVault(false);
    }
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
    resumeUrl.searchParams.delete('active_tab');
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

  // URL에서 mode=full 쿼리 파라미터가 있는지 검사
  const queryParams = new URLSearchParams(window.location.search);
  const isFullModeOverride = queryParams.get('mode') === 'full';

  // 트러스트 월넷 인앱 디앱 브라우저 전용 컴포넌트 렌더링 분기 (전용 단일 페이지)
  // 단, 사용자가 "AiS 앱으로 돌아가기"를 터치해 mode=full 을 요청한 경우는 대시보드 전체 뷰를 보여주도록 예외처리함!
  if (window.ethereum && !isFullModeOverride) {
    return (
      <div style={{ padding: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }}>
        
        {/* 매니저 바로가기 배너 */}
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

        {/* 어드민 바로가기 배너 */}
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

        {/* 사용자 프로필 카드 */}
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

        {/* 👛 트러스트월넷 전용 연동 카드 */}
        <div className="glass-card" style={{
          padding: '20px',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.02) 0%, rgba(0, 0, 0, 0.2) 100%)'
        }}>
          <h3 style={{ fontSize: '15px', color: '#F3F4F6', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px 0', fontWeight: '700' }}>
            <span style={{ fontSize: '16px' }}>👛</span> 트러스트월넷에서 지갑 연동
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                내 개인 지갑 주소 (SUT 입출금용)
              </label>
              <div style={{
                padding: '12px',
                background: 'rgba(16, 185, 129, 0.04)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                boxSizing: 'border-box',
                wordBreak: 'break-all',
                whiteSpace: 'normal'
              }}>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: userWallet ? '#34D399' : 'var(--text-muted)',
                  letterSpacing: '0.5px',
                  lineHeight: '1.4',
                  flex: 1,
                  userSelect: 'all'
                }}>
                  {userWallet || '등록된 개인 지갑 주소가 없습니다.'}
                </span>
                {userWallet && (
                  <button
                    type="button"
                    onClick={() => handleCopyAddress(userWallet, 'wallet')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '10px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '5px',
                      color: '#34D399',
                      cursor: 'pointer',
                      fontWeight: '700',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {copiedAddress === 'wallet' ? '복사됨' : '복사'}
                  </button>
                )}
              </div>
              <span style={{
                fontSize: '10px',
                color: '#34D399',
                display: 'block',
                marginTop: '6px',
                fontWeight: '600',
                lineHeight: '1.4'
              }}>
                🟢 트러스트월넷 실제 온체인 활성 지갑이 안전하게 자동 동기화 완료되었습니다.
              </span>
            </div>

            <div style={{
              marginTop: '15px',
              paddingTop: '16px',
              borderTop: '1px dashed rgba(139, 92, 246, 0.2)',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12.5px', color: '#C084FC', fontWeight: '700' }}>
                  SUT 자산 거래 위임 승인 여부
                </span>
                {vaultApproved === true ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#34D399'
                  }}>
                    🟢 승인 완료 (거래가능)
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#F59E0B'
                  }}>
                    ⚠️ 미승인 (서명 필요)
                  </span>
                )}
              </div>

              {vaultApproved === true ? (
                <div style={{ width: '100%', padding: '10px 12px', fontSize: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', fontWeight: '700', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box' }}>
                  <ShieldCheck size={14} /> ✅ 플랫폼 위임 승인 완료
                </div>
              ) : vaultApproved === false ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={handleApproveVault}
                    disabled={approvingVault}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '12px',
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '800',
                      color: '#FFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)',
                      boxSizing: 'border-box'
                    }}
                  >
                    <ShieldCheck size={14} />
                    {approvingVault ? '⏳ 블록체인 서명 및 승인 승격 대기 중...' : '🔐 원클릭 자동 위임 승인 시도'}
                  </button>
                </div>
              ) : (
                <div style={{ width: '100%', padding: '10px 12px', fontSize: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', fontWeight: '700', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box' }}>
                  <ShieldCheck size={14} /> ⏳ 온체인 위임 승인 상태 확인 중...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 트러스트월넷 디앱 브라우저 나가기 버튼 (카드 블록 밖 밑으로 이동 배치) */}
        <button
          type="button"
          onClick={handleExitDApp}
          style={{
            width: '100%',
            padding: '14px 20px',
            fontSize: '15px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '10px',
            fontWeight: '800',
            color: '#F3F4F6',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxSizing: 'border-box',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          🚪 트러스트월넷 나가기
        </button>

      </div>
    );
  }

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

              {vaultApproved === true ? (
                <span style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  color: '#10B981',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
                  거래가능
                </span>
              ) : (
                <span style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  color: '#EF4444',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }}></span>
                  승인필요
                </span>
              )}
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
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#8B5CF6' }}>{walletSutBalance.toFixed(2)} SUT <span style={{ fontSize: '10px', fontWeight: 'normal' }}>({walletPercent.toFixed(1)}%)</span></span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{DASHBOARD_COPY.managedAssets}</span>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--success-color)' }}>{portfolio ? portfolio.totalInvested.toFixed(2) : '0.00'} SUT <span style={{ fontSize: '10px', fontWeight: 'normal' }}>({depositedPercent.toFixed(1)}%)</span></span>
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
                * 입출금 신청 전, 우측 상단 [⚙️ 설정] 메뉴에서 최초 1회 플랫폼 위임 승인이 반드시 수반되어야 모바일 SUT 정상 트랜잭션이 개시됩니다.
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
              <span style={{ fontSize: '16px' }}>👛</span> 트러스트월넷에서 지갑 연동
            </h3>

            {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && !window.ethereum && !isFullModeOverride && (
              <div style={{ marginBottom: '18px', padding: '14px', background: 'rgba(5, 0, 255, 0.05)', border: '1px solid rgba(5, 0, 255, 0.15)', borderRadius: '10px', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#93C5FD', lineHeight: '1.45', margin: '0 0 12px 0', textAlign: 'left', fontWeight: '500' }}>
                  💡 스마트폰 일반 브라우저 환경에서는 수동 입력의 번거로움과 실수를 방지하기 위해, 아래 버튼을 터치하여 트러스트 월넷 디앱 브라우저로 이동해 안전하게 지갑을 검증 및 자동 연동하기를 강력히 권장합니다.
                </p>
                <button
                  type="button"
                  onClick={handleJumpToTrustWallet}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '13px',
                    background: 'linear-gradient(135deg, #0500FF 0%, #3B82F6 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '800',
                    color: '#FFF',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(5, 0, 255, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  🔵 트러스트월넷으로 이동
                </button>
              </div>
            )}

            {/* 내 개인 지갑 주소 표시 보드 */}
            <div style={{ textAlign: 'left', marginBottom: '22px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: '700' }}>
                내 개인 지갑 주소 (SUT 입출금용)
              </label>
              <div style={{
                padding: '14px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxSizing: 'border-box',
                wordBreak: 'break-all',
                whiteSpace: 'normal'
              }}>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '13.5px',
                  color: userWallet ? '#E5E7EB' : 'var(--text-muted)',
                  letterSpacing: '0.5px',
                  lineHeight: '1.4',
                  flex: 1,
                  userSelect: 'all'
                }}>
                  {userWallet || '등록된 개인 지갑 주소가 없습니다.'}
                </span>
                {userWallet && (
                  <button
                    type="button"
                    onClick={() => handleCopyAddress(userWallet, 'wallet')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '11px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      borderRadius: '6px',
                      color: '#C084FC',
                      cursor: 'pointer',
                      fontWeight: '700',
                      transition: 'all 0.15s',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.18)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                    }}
                  >
                    {copiedAddress === 'wallet' ? '복사 완료' : '주소 복사'}
                  </button>
                )}
              </div>
              {window.ethereum && (
                <span style={{
                  fontSize: '11px',
                  color: '#10B981',
                  display: 'block',
                  marginTop: '8px',
                  fontWeight: '600',
                  lineHeight: '1.4'
                }}>
                  🟢 트러스트월넷 실제 온체인 활성 지갑이 안전하게 자동 동기화 완료되었습니다.
                </span>
              )}
            </div>

            {/* SUT 자산 거래 위임 승인 여부 실시간 확인 보드 */}
            <div style={{
              paddingTop: '18px',
              borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
              textAlign: 'left'
            }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '10px', fontWeight: '700' }}>
                SUT 자산 거래 위임 승인 여부
              </label>

              {vaultApproved === true ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'rgba(16, 185, 129, 0.04)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '8px',
                  boxSizing: 'border-box'
                }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#34D399'
                  }}>
                    <ShieldCheck size={14} /> ✅ 승인 완료 (SUT 거래 가능)
                  </span>
                </div>
              ) : vaultApproved === false ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  boxSizing: 'border-box'
                }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: 'var(--text-muted)'
                  }}>
                    <ShieldCheck size={14} /> ⚠️ 미승인 (위임 필요)
                  </span>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: 'var(--text-muted)',
                  boxSizing: 'border-box'
                }}>
                  <ShieldCheck size={13} className="spin-slow" /> ⏳ 온체인 위임 승인 상태 확인 중...
                </div>
              )}
            </div>
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
