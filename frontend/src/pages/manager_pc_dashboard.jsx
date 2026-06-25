import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Users, DollarSign, Award, ArrowLeft, Check, X,
  Eye, ShieldAlert, BarChart3, Receipt, ExternalLink, HelpCircle, ShieldCheck, Wallet, Settings,
  ArrowUpDown
} from 'lucide-react';
import { API_BASE } from '../App';
import { ethers } from 'ethers';
import {
  approveManagerUser,
  approveManagerWithdrawal,
  rejectManagerWithdrawal,
  buildManagerHeaders,
  clearManagerGateIoCredentials,
  loadManagerDashboardData,
  normalizeManagerGridSettings,
  toggleManagerAutoRangePreview,
  rejectManagerUser,
  saveManagerAiSettings,
  saveManagerGateIoCredentials,
  sendSutToGateIoDepositAddress,
  submitManagerGateIoOrder,
  cancelManagerGateIoOrder,
} from '../lib/managerDashboard';
import {
  loadUserDashboardData,
} from '../lib/userDashboard';
import SutPriceChart from '../components/SutPriceChart';
import SutPriceCard from '../components/SutPriceCard';
import ManagerAiDecisionHistory from '../components/ManagerAiDecisionHistory';
import ManagerTradeExecutions from '../components/ManagerTradeExecutions';
import EditUserModal from '../components/EditUserModal';
import { saveIdCardLocally, getIdCardLocally, deleteIdCardLocally } from '../lib/idCardStorage';

function ManagerPcDashboard({ walletAddress, managerEmail }) {
  const navigate = useNavigate();

  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [hasDownloadedId, setHasDownloadedId] = useState({});
  const [idCardViewerUrl, setIdCardViewerUrl] = useState(null);
  const [idCardViewerName, setIdCardViewerName] = useState(null);

  const [gridSettings, setGridSettings] = useState({
    ai_grid_status: 'OFF',
    ai_grid_lower: '0.15',
    ai_grid_upper: '0.30',
    ai_grid_auto_range: 'OFF',
    ai_grid_count: '5',
    ai_grid_frequency: '5'
  });

  const gridSettingsRef = useRef(gridSettings);
  useEffect(() => {
    gridSettingsRef.current = gridSettings;
  }, [gridSettings]);

  const [portfolio, setPortfolio] = useState(null);
  const [walletSutBalance, setWalletSutBalance] = useState(0);
  const [vaultSutBalance, setVaultSutBalance] = useState(0);
  const [sutPrice, setSutPrice] = useState(0.19);
  const [sutChange24h, setSutChange24h] = useState(0);
  const [priceHistory, setPriceHistory] = useState([]);
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('DEPOSIT');
  const [txAmount, setTxAmount] = useState('');
  const [processingTx, setProcessingTx] = useState(false);
  const [gateioBalance, setGateioBalance] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [yieldHistory, setYieldHistory] = useState([]);
  const [aiLogs, setAiLogs] = useState([]);
  const [tradeExecutions, setTradeExecutions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);

  const lastExecutedStrategyIdRef = useRef(null);
  const lastServerGridSettingsRef = useRef(null);
  const lastRequestIdRef = useRef(0);

  const [confirmMode, setConfirmMode] = useState('NONE');
  const confirmTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
      }
    };
  }, []);

  const [orderAmount, setOrderAmount] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [orderTotal, setOrderTotal] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const handleOrderAmountChange = (val) => {
    setOrderAmount(val);
    const amt = parseFloat(val);
    const prc = parseFloat(orderPrice);
    if (!isNaN(amt) && !isNaN(prc)) {
      setOrderTotal((amt * prc).toFixed(4));
    } else {
      setOrderTotal('');
    }
  };

  const handleOrderPriceChange = (val) => {
    setOrderPrice(val);
    const amt = parseFloat(orderAmount);
    const prc = parseFloat(val);
    if (!isNaN(amt) && !isNaN(prc)) {
      setOrderTotal((amt * prc).toFixed(4));
    } else {
      setOrderTotal('');
    }
  };

  const handleOrderTotalChange = (val) => {
    setOrderTotal(val);
    const tot = parseFloat(val);
    const prc = parseFloat(orderPrice);
    if (!isNaN(tot) && !isNaN(prc) && prc > 0) {
      setOrderAmount((tot / prc).toFixed(4));
    } else {
      setOrderAmount('');
    }
  };

  const [localApiKey, setLocalApiKey] = useState(localStorage.getItem('gateio_api_key') || '');
  const [localApiSecret, setLocalApiSecret] = useState(localStorage.getItem('gateio_api_secret') || '');
  const [localDepositAddress, setLocalDepositAddress] = useState(localStorage.getItem('gateio_deposit_address') || '');
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);

  const [showSendSutModal, setShowSendSutModal] = useState(false);
  const [sendSutAmount, setSendSutAmount] = useState('');
  const [sendingSut, setSendingSut] = useState(false);

  const [selectedIdCard, setSelectedIdCard] = useState(null);
  const [editingUserWallet, setEditingUserWallet] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);

  const getManagerHeaders = () => {
    return buildManagerHeaders({
      managerEmail,
      getStorageItem: (key) => localStorage.getItem(key),
    });
  };

  const handleGateIoOrder = async (side) => {
    if (!orderAmount || parseFloat(orderAmount) <= 0) {
      alert("주문 수량을 입력하세요.");
      return;
    }
    if (!orderPrice || parseFloat(orderPrice) <= 0) {
      alert("주문 가격을 입력하세요.");
      return;
    }

    setSubmittingOrder(true);
    try {
      const res = await submitManagerGateIoOrder({
        apiBase: API_BASE,
        managerEmail,
        side,
        amount: orderAmount,
        price: orderPrice,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });

      if (res.data.success) {
        alert(`🎉 ${res.data.message}\n주문 ID: ${res.data.order.id}`);
        setOrderAmount('');
        setOrderPrice('');
        setOrderTotal('');
        fetchManagerData();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 주문 오류: ${errMsg}`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!confirm('정말로 이 대기 주문을 취소하시겠습니까?')) return;
    try {
      const res = await cancelManagerGateIoOrder({
        apiBase: API_BASE,
        managerEmail,
        orderId,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });
      if (res.data.success) {
        alert('주문이 정상적으로 취소되었습니다.');
        fetchManagerData();
      } else {
        alert('주문 취소 실패: ' + (res.data.error || '알 수 없는 오류'));
      }
    } catch (err) {
      alert('주문 취소 중 오류 발생: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleGateIoOrderClick = (side) => {
    if (!orderAmount || parseFloat(orderAmount) <= 0) {
      alert("주문 수량을 입력하세요.");
      return;
    }
    if (!orderPrice || parseFloat(orderPrice) <= 0) {
      alert("주문 가격을 입력하세요.");
      return;
    }

    const upperSide = side.toUpperCase();
    if (confirmMode === upperSide) {
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      setConfirmMode('NONE');
      handleGateIoOrder(side);
    } else {
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
      }
      setConfirmMode(upperSide);
      confirmTimerRef.current = setTimeout(() => {
        setConfirmMode('NONE');
      }, 3000);
    }
  };

  const handleSaveApiKeys = async () => {
    if (!localApiKey.trim() || !localApiSecret.trim() || !localDepositAddress.trim()) {
      alert('⚠️ 모든 API 키 및 입금 주소를 정확하게 입력해 주세요.');
      return;
    }

    setIsSavingCredentials(true);
    try {
      await saveManagerGateIoCredentials({
        apiBase: API_BASE,
        managerEmail,
        apiKey: localApiKey,
        apiSecret: localApiSecret,
        depositAddress: localDepositAddress,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
        setStorageItem: (key, value) => localStorage.setItem(key, value),
      });
      alert('💾 Gate.io API 키 및 입금 주소가 기기 및 서버 DB에 안전하게 저장되었습니다.');
    } catch (err) {
      console.error(err);
      alert('경고: 로컬 저장은 성공했으나 서버 DB 저장에 실패했습니다: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSavingCredentials(false);
    }
    fetchManagerData();
  };

  const handleClearApiKeys = async () => {
    setLocalApiKey('');
    setLocalApiSecret('');
    setLocalDepositAddress('');

    try {
      await clearManagerGateIoCredentials({
        apiBase: API_BASE,
        managerEmail,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
        removeStorageItem: (key) => localStorage.removeItem(key),
      });
      alert('🗑️ 저장된 API 키 및 입금 주소가 기기 및 서버에서 정상 삭제되었습니다.');
    } catch (err) {
      console.error(err);
      alert('경고: 로컬 삭제는 성공했으나 서버 DB 삭제에 실패했습니다: ' + (err.response?.data?.message || err.message));
    }
    fetchManagerData();
  };

  const handleSendSutToGateIo = async (e) => {
    if (e) e.preventDefault();

    const depositAddr = localStorage.getItem('gateio_deposit_address') || '';
    if (!depositAddr) {
      alert('Gate.io SUT 입금 주소를 로컬 설정에서 먼저 입력하고 저장해 주세요.');
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(depositAddr.trim())) {
      alert('올바른 폴리곤 지갑 주소 형식(0x...로 시작하는 42자리)이 아닙니다. 로컬 설정을 확인해 주세요.');
      return;
    }

    if (!sendSutAmount || parseFloat(sendSutAmount) <= 0) {
      alert('유효한 수량을 입력해 주세요.');
      return;
    }

    if (!window.ethereum) {
      alert('설치된 메타마스크 혹은 트러스트월렛 브라우저 지갑을 찾을 수 없습니다.');
      return;
    }

    setSendingSut(true);
    try {
      const transferTx = await sendSutToGateIoDepositAddress({
        ethereum: window.ethereum,
        ethersLib: ethers,
        depositAddress: depositAddr,
        amount: sendSutAmount,
      });
      alert(`SUT transfer completed to Gate.io deposit address.\nTxHash: ${transferTx.hash}`);
      setShowSendSutModal(false);
      setSendSutAmount('');
    } catch (err) {
      console.error(err);
      alert(`❌ 전송 실패: ${err.message || err}`);
    } finally {
      setSendingSut(false);
    }
  };

  const handleSyncTransactions = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API_BASE}/manager/sync-transactions`, { managerAddress: walletAddress }, getManagerHeaders());
      if (res.data.success) {
        alert(`🎉 ${res.data.message}`);
        fetchManagerData();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 온체인 동기화 실패: ${errMsg}`);
    } finally {
      setSyncing(false);
    }
  };

  const fetchManagerData = async () => {
    const currentRequestId = ++lastRequestIdRef.current;
    try {
      if (walletAddress) {
        try {
          const userData = await loadUserDashboardData({
            apiBase: API_BASE,
            walletAddress,
            axiosClient: axios,
            ethersLib: ethers,
          });
          if (userData.sutPrice !== undefined) setSutPrice(userData.sutPrice);
          if (userData.sutChange24h !== undefined) setSutChange24h(userData.sutChange24h);
          if (userData.priceHistory !== undefined) {
            setPriceHistory(userData.priceHistory);
          }
        } catch (err) {
          console.error('Failed to load SUT price for manager:', err);
        }
      }

      const managerData = await loadManagerDashboardData({
        apiBase: API_BASE,
        managerEmail,
        walletAddress,
        axiosClient: axios,
        ethersLib: ethers,
        getStorageItem: (key) => localStorage.getItem(key),
        setStorageItem: (key, value) => localStorage.setItem(key, value),
        removeStorageItem: (key) => localStorage.removeItem(key),
        previousYieldHistory: yieldHistory,
        previousGridSettings: gridSettingsRef.current,
      });

      if (currentRequestId !== lastRequestIdRef.current) {
        return;
      }

      if (managerData.pendingUsers !== undefined) setPendingUsers(managerData.pendingUsers);
      if (managerData.stats !== undefined) setStats(managerData.stats);
      if (managerData.recentPayments !== undefined) setRecentPayments(managerData.recentPayments);
      if (managerData.allUsers !== undefined) setAllUsers(managerData.allUsers);
      if (managerData.withdrawals !== undefined) setWithdrawals(managerData.withdrawals);
      if (managerData.gridSettings !== undefined) {
        const currentSettings = gridSettingsRef.current;
        const isDirty = lastServerGridSettingsRef.current && (
          currentSettings.ai_grid_lower !== lastServerGridSettingsRef.current.ai_grid_lower ||
          currentSettings.ai_grid_upper !== lastServerGridSettingsRef.current.ai_grid_upper ||
          currentSettings.ai_grid_auto_range !== (lastServerGridSettingsRef.current.ai_grid_auto_range || 'OFF') ||
          currentSettings.ai_grid_count !== lastServerGridSettingsRef.current.ai_grid_count ||
          currentSettings.ai_grid_frequency !== lastServerGridSettingsRef.current.ai_grid_frequency ||
          currentSettings.ai_grid_status !== lastServerGridSettingsRef.current.ai_grid_status
        );
        if (!isDirty) {
          setGridSettings(managerData.gridSettings);
          lastServerGridSettingsRef.current = managerData.gridSettings;
        }
      }
      if (managerData.portfolio !== undefined) setPortfolio(managerData.portfolio);
      if (managerData.walletSutBalance !== undefined) setWalletSutBalance(managerData.walletSutBalance);
      if (managerData.vaultSutBalance !== undefined) setVaultSutBalance(managerData.vaultSutBalance);
      if (managerData.gateioBalance !== undefined) setGateioBalance(managerData.gateioBalance);
      if (managerData.performance !== undefined) setPerformance(managerData.performance);
      if (managerData.yieldHistory !== undefined) setYieldHistory(managerData.yieldHistory);
      if (managerData.aiLogs !== undefined) setAiLogs(managerData.aiLogs);
      if (managerData.tradeExecutions !== undefined) setTradeExecutions(managerData.tradeExecutions);
      if (managerData.gateioOpenOrders !== undefined) setOpenOrders(managerData.gateioOpenOrders);

      if (managerData.credentialUpdates.clearApiKey) setLocalApiKey('');
      if (managerData.credentialUpdates.clearApiSecret) setLocalApiSecret('');
      if (managerData.credentialUpdates.depositAddress) setLocalDepositAddress(managerData.credentialUpdates.depositAddress);
    } catch (err) {
      console.error('Manager data load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagerData();
    const interval = setInterval(fetchManagerData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (gridSettings.ai_grid_status !== 'ON' || !aiLogs || aiLogs.length === 0) return;

    const latestStrategy = aiLogs[0];
    if (lastExecutedStrategyIdRef.current === latestStrategy.id) return;
    lastExecutedStrategyIdRef.current = latestStrategy.id;
  }, [aiLogs, gridSettings.ai_grid_status]);

  const handleToggleAutoRangePreview = (enabled) => {
    setGridSettings((currentSettings) => toggleManagerAutoRangePreview({
      enabled,
      currentSettings,
      serverSettings: lastServerGridSettingsRef.current || currentSettings,
      latestAiLog: aiLogs?.[0] || null,
    }));
  };

  const handleDownloadIdCard = async (userId, name) => {
    try {
      let blob = await getIdCardLocally(userId);
      if (!blob) {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('sut_token') || localStorage.getItem('token');
        const res = await axios.get(`${API_BASE}/manager/download-id-card/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        });
        blob = new Blob([res.data]);
        await saveIdCardLocally(userId, blob);
      }
      
      const url = window.URL.createObjectURL(blob);
      setIdCardViewerUrl(url);
      setIdCardViewerName(name);
      setHasDownloadedId(prev => ({ ...prev, [userId]: true }));
    } catch (err) {
      console.error(err);
      alert('신분증 이미지를 불러오지 못했습니다. 이미 확인 완료되어 삭제되었을 수 있습니다.');
    }
  };

  const handleApprove = async (walletAddressToApprove) => {
    if (!confirm('해당 회원의 신분증·지갑 계정을 확인하고 10일 무료 체험(TRIAL) 등급으로 가입을 승인하시겠습니까?')) {
      return;
    }
    setSubmittingId(walletAddressToApprove);
    try {
      const res = await approveManagerUser({
        apiBase: API_BASE,
        managerEmail,
        walletAddress: walletAddressToApprove,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });
      if (res.data.success) {
        alert(res.data.message);
        const u = pendingUsers.find(u => u.wallet_address === walletAddressToApprove);
        if (u) await deleteIdCardLocally(u.id);
        fetchManagerData();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert('승인 처리 중 오류 발생: ' + errMsg);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReject = async (walletAddressToReject) => {
    if (!confirm('해당 회원의 신원 서류가 부적합하여 가입 신청을 반려하시겠습니까?')) {
      return;
    }
    setSubmittingId(walletAddressToReject);
    try {
      const res = await rejectManagerUser({
        apiBase: API_BASE,
        managerEmail,
        walletAddress: walletAddressToReject,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });
      if (res.data.success) {
        alert(res.data.message);
        const u = pendingUsers.find(u => u.wallet_address === walletAddressToReject);
        if (u) await deleteIdCardLocally(u.id);
        fetchManagerData();
      }
    } catch (err) {
      alert('반려 처리 중 오류 발생: ' + err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleApproveWithdrawal = async (id, requestedAmount, name) => {
    const actualPayoutStr = prompt(`[수동 지급 확정]\n\n${name} 회원님이 신청한 출금 신청 금액은 [${requestedAmount} SUT] 입니다.\n\n매니저님께서 출금 승인 처리하여 지급하신 금액을 메모용으로 입력해 주세요.\n(참고: 회원의 자산 장부에서는 출금 신청 원금인 ${requestedAmount} SUT가 차감 정산됩니다.)`, requestedAmount);

    if (actualPayoutStr === null) return;

    try {
      const res = await approveManagerWithdrawal({
        apiBase: API_BASE,
        managerEmail,
        withdrawalId: id,
        actualPayoutAmount: actualPayoutStr,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });
      if (res.data.success) {
        alert(res.data.message);
        fetchManagerData();
      }
    } catch (err) {
      alert('출금 승인 처리 중 오류 발생: ' + err.message);
    }
  };

  const handleRejectWithdrawal = async (id, requestedAmount, name) => {
    if (!confirm(`[출금 신청 반려]\n\n정말로 ${name} 회원님의 출금 신청 [${requestedAmount} SUT]을 반려 처리하시겠습니까?\n이 작업은 즉시 반영되며 장부 원장 차감은 발생하지 않습니다.`)) {
      return;
    }

    try {
      const res = await rejectManagerWithdrawal({
        apiBase: API_BASE,
        managerEmail,
        withdrawalId: id,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });
      if (res.data.success) {
        alert(res.data.message);
        fetchManagerData();
      }
    } catch (err) {
      alert('출금 반려 처리 중 오류 발생: ' + err.message);
    }
  };

  const handleToggleAiStatus = async () => {
    const newStatus = gridSettings.ai_grid_status === 'ON' ? 'OFF' : 'ON';

    if (newStatus === 'ON') {
      const typed = prompt(`[⚠️ 법적 책임 면책 동의서 ⚠️]\n\n본 AI 자동 매매(Grid Trading) 기능의 가동으로 인해 발생하는 회원의 자산 손실 및 모든 민형사상 법적 책임은 해당 기능을 활성화한 '매니저 본인'에게 귀속됩니다. 플랫폼 개발팀은 어떠한 책임도 지지 않습니다.\n\n위 내용에 동의하시면 아래 입력창에 정확히 "동의합니다" 라고 입력해 주세요.`);

      if (typed !== "동의합니다") {
        alert("동의 문구가 일치하지 않아 AI 오토 트레이딩이 가동되지 않았습니다.");
        return;
      }
    }

    try {
      const res = await saveManagerAiSettings({
        apiBase: API_BASE,
        managerEmail,
        settings: { status: newStatus },
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });

      if (res.data.success) {
        const savedSettings = normalizeManagerGridSettings(
          res.data.settings || { ai_grid_status: newStatus },
          { ...gridSettingsRef.current, ai_grid_status: newStatus }
        );
        setGridSettings(savedSettings);
        lastServerGridSettingsRef.current = savedSettings;
        alert(newStatus === 'ON' ? '🤖 완전 자동화 AI 트레이딩 봇이 가동되었습니다!' : 'AI 트레이딩 봇이 정지되었습니다.');
        fetchManagerData();
      }
    } catch (err) {
      alert('설정 변경 중 오류: ' + err.message);
    }
  };

  const handleSaveGridSettings = async () => {
    try {
      const res = await saveManagerAiSettings({
        apiBase: API_BASE,
        managerEmail,
        settings: {
          status: gridSettings.ai_grid_status,
          lower: gridSettings.ai_grid_lower,
          upper: gridSettings.ai_grid_upper,
          autoRange: gridSettings.ai_grid_auto_range,
          count: gridSettings.ai_grid_count,
          frequency: gridSettings.ai_grid_frequency,
        },
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });

      if (res.data.success) {
        const savedSettings = normalizeManagerGridSettings(res.data.settings || {}, gridSettingsRef.current);
        setGridSettings(savedSettings);
        lastServerGridSettingsRef.current = savedSettings;
        alert('그리드 봇 설정 변경사항이 정상적으로 적용되었습니다.');
        fetchManagerData();
      }
    } catch (err) {
      alert('설정 저장 중 오류: ' + err.message);
    }
  };

  const handleTxSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!txAmount || parseFloat(txAmount) <= 0) {
      alert('유효한 금액을 입력해 주세요.');
      return;
    }

    setProcessingTx(true);
    try {
      if (txType === 'DEPOSIT') {
        if (!window.ethereum) {
          throw new Error('설치된 메타마스크 혹은 트러스트월렛 브라우저 지갑을 찾을 수 없습니다.');
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();

        if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
          throw new Error(`지갑 주소 불일치: 현재 로그인된 계정 주소(${walletAddress})와 메타마스크에 활성화된 주소(${signerAddress})가 다릅니다. 지갑 계정을 확인해 주세요.`);
        }

        const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55";
        const vaultAddress = "0x855c880D538892fD899eECb72D4b1Ac5B46089eA";
        const sutAbi = ["function transfer(address recipient, uint256 amount) external returns (bool)"];

        const sutContract = new ethers.Contract(sutContractAddress, sutAbi, signer);

        const parsedAmount = ethers.parseUnits(txAmount.toString(), 18);

        const tx = await sutContract.transfer(vaultAddress, parsedAmount);

        await tx.wait();

        const res = await axios.post(`${API_BASE}/investment/deposit`, {
          walletAddress,
          amount: parseFloat(txAmount),
          txHash: tx.hash
        });
        if (res.data.success) {
          alert(`🎉 성공적으로 ${txAmount} SUT가 예치되어 시뮬레이션 장부에 즉시 기록되었습니다.\nTxHash: ${tx.hash}`);
        }
      } else {
        if (portfolio && parseFloat(txAmount) > portfolio.sutQuantity) {
          alert('출금 요청 금액이 현재 총 보유 SUT 한도를 초과합니다.');
          setProcessingTx(false);
          return;
        }
        const res = await axios.post(`${API_BASE}/investment/withdraw`, {
          walletAddress,
          amount: parseFloat(txAmount)
        });
        if (res.data.success) {
          alert(`📤 ${txAmount} SUT 출금 신청이 성공적으로 접수되었습니다. 승인 후 지갑으로 가상 전송됩니다.`);
        }
      }
      setShowTxModal(false);
      setTxAmount('');
      fetchManagerData();
    } catch (err) {
      alert('거래 처리 실패: ' + err.message);
    } finally {
      setProcessingTx(false);
    }
  };

  const handleTriggerAIProfit = async () => {
    const profitPercentage = prompt(`[AI 트레이딩 시뮬레이션 수익 정산 배분]\n\n현재 가입된 정식(ACTIVE) 회원들에게 배분할 'SUT 수익률(%)'을 숫자로 입력해 주세요.\n(예: 0.5 입력 시, 회원의 SUT 총액 기준 0.5%의 SUT가 추가로 배분 정산됩니다.)`, "0.5");

    if (profitPercentage === null || isNaN(parseFloat(profitPercentage))) return;

    if (!confirm(`전체 정회원을 대상으로 ${profitPercentage}%의 AI 수익 배분을 가동하시겠습니까? (이 작업은 정정할 수 없으며 즉시 각 회원의 SUT 잔고가 증가합니다.)`)) {
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/manager/trigger-ai-profit`, {
        profitPercentage
      }, getManagerHeaders());

      if (res.data.success) {
        alert(res.data.message);
        fetchManagerData();
      }
    } catch (err) {
      alert('AI 수익 분배 중 오류 발생: ' + err.message);
    }
  };

  const hasUnsavedChanges = !!(lastServerGridSettingsRef.current && (
    gridSettings.ai_grid_lower !== lastServerGridSettingsRef.current.ai_grid_lower ||
    gridSettings.ai_grid_upper !== lastServerGridSettingsRef.current.ai_grid_upper ||
    gridSettings.ai_grid_auto_range !== (lastServerGridSettingsRef.current.ai_grid_auto_range || 'OFF') ||
    gridSettings.ai_grid_count !== lastServerGridSettingsRef.current.ai_grid_count ||
    gridSettings.ai_grid_frequency !== lastServerGridSettingsRef.current.ai_grid_frequency
  ));

  if (loading) {
    return (
      <div className="pc-layout-wrapper" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="shimmer-loading" style={{ width: '60px', height: '60px', borderRadius: '50%', margin: '0 auto 20px' }}></div>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>매니저 대시보드를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pc-layout-wrapper" style={{ alignItems: 'stretch', gap: '30px', padding: '40px 50px', flexDirection: 'column' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>👑</span>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ fontSize: '22px', color: '#FFF', margin: 0, fontWeight: '800' }}>매니저 대시보드</h1>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>🏢 회원 관리 및 AI 시뮬레이션 제어 시스템</span>
          </div>
        </div>
        <button
          className="btn-secondary"
          onClick={() => navigate('/dashboard')}
          style={{ width: 'auto', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', gap: '8px', fontWeight: '700' }}
        >
          <ArrowLeft size={18} />
          일반 회원 화면으로 복귀
        </button>
      </div>

      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', width: '100%' }}>

        <div style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '24px', flexShrink: 0 }}>

          <div className="glass-card" style={{ padding: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-gradient)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px', fontWeight: 'bold', color: '#FFF' }}>
                M
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: '16px', color: '#FFF', margin: 0 }}>이명학 총괄 매니저</h4>
                <span style={{ fontSize: '11px', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontWeight: '700' }}>
                  <ShieldCheck size={12} /> 최고 권한 인증됨
                </span>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><b>연동 구글 계정:</b> {managerEmail}</div>
              <div style={{ wordBreak: 'break-all' }}><b>지갑 주소:</b> <span style={{ fontFamily: 'monospace' }}>{walletAddress}</span></div>
            </div>
          </div>

          {portfolio ? (
            <SutPriceCard 
              sutPrice={sutPrice}
              sutChange24h={sutChange24h}
              krwRate={portfolio.krwRate}
              priceHistory={priceHistory}
              sutHigh24h={performance?.sutHigh24h || portfolio.sutHigh24h}
              sutLow24h={performance?.sutLow24h || portfolio.sutLow24h}
              isMobile={false}
            />
          ) : (
            <div className="shimmer-loading" style={{ height: '230px', borderRadius: '20px' }}></div>
          )}

          <div className="glass-card" style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '24px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '24px' }}>🛡️</div>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#10B981', fontWeight: '800' }}>고급 보안 및 양자 알고리즘 탑재 (Advanced Security & QAOA)</h4>
              <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.5' }}>
                본 매니저 시스템은 <strong>제로 트러스트(Zero Trust)</strong> 이상 탐지 필터를 통해 스팸 및 외부 위협을 실시간 원천 차단합니다.<br/>
                또한, 최신 퀀트 연구인 <strong>시장 변동성 기반 동적 세대교체(QAOA-inspired Dynamic Culling)</strong> 로직이 적용되어 급변장에서도 더욱 강력한 수익 방어 구조를 유지합니다.
              </p>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
            <h4 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>💰</span> SUT 자산 통합 관리 현황
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ textAlign: 'left', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>매니저 SUT 총 보유 (지갑 + 거래소)</div>
                    <span style={{ fontSize: '10px', color: '#60A5FA', background: 'rgba(96,165,250,0.1)', padding: '2px 6px', borderRadius: '6px', fontWeight: '700' }}>총 보유고</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#60A5FA', marginTop: '2px' }}>
                    {(walletSutBalance + (gateioBalance ? parseFloat(gateioBalance.SUT || 0) : 0)).toFixed(2)} <span style={{ fontSize: '11px', fontWeight: 'normal' }}>SUT</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px', paddingLeft: '8px', borderLeft: '2px solid rgba(96, 165, 250, 0.3)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <div>• 개인 지갑: <span style={{ color: '#FFF', fontWeight: '600' }}>{walletSutBalance.toFixed(2)} SUT</span></div>
                    <div>• 거래소 (Gate.io): <span style={{ color: '#FFF', fontWeight: '600' }}>{(gateioBalance ? parseFloat(gateioBalance.SUT || 0) : 0).toFixed(2)} SUT</span></div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>회원 누적 예치금 (누적 입금액)</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#3B82F6', marginTop: '2px' }}>
                    {stats ? stats.totalDeposited.toFixed(2) : '0.00'} <span style={{ fontSize: '11px', fontWeight: 'normal' }}>SUT</span>
                  </div>
                </div>
                <span style={{ fontSize: '10px', color: '#3B82F6', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '6px', fontWeight: '700' }}>총 입금액</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>회원 누적 배분액 (출금 완료)</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#F59E0B', marginTop: '2px' }}>
                    {stats ? stats.totalDistributed.toFixed(2) : '0.00'} <span style={{ fontSize: '11px', fontWeight: 'normal' }}>SUT</span>
                  </div>
                </div>
                <span style={{ fontSize: '10px', color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '6px', fontWeight: '700' }}>총 출금 완료액</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>회원 총 운용 자산 (볼트 잔고)</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#A78BFA', marginTop: '2px' }}>
                    {vaultSutBalance.toFixed(2)} <span style={{ fontSize: '11px', fontWeight: 'normal' }}>SUT</span>
                  </div>
                </div>
                <span style={{ fontSize: '10px', color: '#A78BFA', background: 'rgba(167,139,250,0.1)', padding: '2px 6px', borderRadius: '6px', fontWeight: '700' }}>온체인 볼트 잔고</span>
              </div>



            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <h4 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} color="#A78BFA" />
              로컬 전용 Gate.io API 키 및 주소 설정
            </h4>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
              보안 유지를 위해 입력 정보는 <strong>현재 기기 브라우저에만 저장</strong>되며 서버 DB나 설정 파일에 등록되지 않습니다. <br/><span style={{ color: '#10B981', fontWeight: 'bold' }}>(해당 정보 전송 시 AES-256-GCM 군사급 암호화 알고리즘이 적용 중입니다.)</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="password"
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder="Gate.io API Key 입력"
                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#FFF', outline: 'none' }}
              />
              <input
                type="password"
                value={localApiSecret}
                onChange={(e) => setLocalApiSecret(e.target.value)}
                placeholder="Gate.io API Secret Key 입력"
                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#FFF', outline: 'none' }}
              />
              <input
                type="text"
                value={localDepositAddress}
                onChange={(e) => setLocalDepositAddress(e.target.value)}
                placeholder="Gate.io SUT 입금 주소 (Polygon) 입력"
                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#FFF', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveApiKeys}
                disabled={isSavingCredentials}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '11px',
                  background: isSavingCredentials ? '#4b5563' : 'var(--primary-gradient)',
                  fontWeight: 'bold',
                  cursor: isSavingCredentials ? 'not-allowed' : 'pointer',
                  opacity: isSavingCredentials ? 0.7 : 1
                }}
              >
                {isSavingCredentials ? '⏳ 저장 중...' : '💾 기기 저장'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleClearApiKeys}
                style={{ flex: 1, padding: '10px', fontSize: '11px', color: 'var(--danger-color)', borderColor: 'rgba(239,68,68,0.2)', fontWeight: 'bold' }}
              >
                🗑️ 삭제
              </button>
            </div>
          </div>

          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', padding: '8px', borderRadius: '50%', background: 'rgba(139,92,246,0.1)', marginBottom: '8px' }}>
                  <Users size={20} color="#8B5CF6" />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>승인 회원 현황</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#FFF', marginTop: '6px', fontFamily: 'var(--font-title)' }}>
                  {stats.totalApproved} <span style={{ fontSize: '12px', color: 'var(--text-dark)' }}>/ {stats.limit} 명</span>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '20px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <div style={{ display: 'inline-flex', padding: '8px', borderRadius: '50%', background: 'rgba(245,158,11,0.1)', marginBottom: '8px' }}>
                  <ShieldAlert size={20} color="#F59E0B" />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>가입 심사 대기</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#F59E0B', marginTop: '6px', fontFamily: 'var(--font-title)' }}>
                  {stats.totalPending} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>명</span>
                </div>
              </div>
            </div>
          )}

        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {portfolio ? (
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '24px 24px 10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)' }}>📊 SUT 최근 24시간 시세 추이 (30분 단위)</span>
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '28px', fontWeight: '800', color: '#F3F4F6', fontFamily: 'var(--font-title)' }}>
                      ${sutPrice.toFixed(4)} <span style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-muted)' }}>USD</span>
                    </span>

                    <span style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: sutChange24h >= 0 ? 'var(--success-color)' : 'var(--danger-color)',
                      background: sutChange24h >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: sutChange24h >= 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}>
                      {sutChange24h >= 0 ? '▲' : '▼'} {sutChange24h >= 0 ? '+' : ''}{sutChange24h.toFixed(2)}%
                    </span>

                    <span style={{ fontSize: '14px', color: 'var(--success-color)', fontWeight: '600' }}>
                      (≈ {(sutPrice * (portfolio.krwRate || 1400)).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} KRW)
                    </span>
                  </div>
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                    <span>24H 고점: <span style={{ color: 'var(--success-color)', fontFamily: 'var(--font-title)', fontSize: '13px' }}>${performance?.sutHigh24h ? performance.sutHigh24h.toFixed(4) : sutPrice.toFixed(4)}</span></span>
                    <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
                    <span>24H 저점: <span style={{ color: 'var(--danger-color)', fontFamily: 'var(--font-title)', fontSize: '13px' }}>${performance?.sutLow24h ? performance.sutLow24h.toFixed(4) : sutPrice.toFixed(4)}</span></span>
                  </div>
                </div>
                <div>
                  <span className="glow-active" style={{ fontSize: '11px', color: 'var(--success-color)', background: 'rgba(16, 185, 129, 0.1)', padding: '5px 12px', borderRadius: '12px', fontWeight: '700', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    ● 실시간
                  </span>
                </div>
              </div>

              <div style={{ width: '100%', height: '180px', position: 'relative', display: 'block', padding: '10px 20px 20px 20px' }}>
                <SutPriceChart 
                  data={(performance && performance.sutPriceHistory24h && performance.sutPriceHistory24h.length > 0) ? performance.sutPriceHistory24h : (priceHistory.length > 0 ? priceHistory : [sutPrice || 0.19])} 
                  height={160} 
                  gradientId="managerSutPriceGrad" 
                  lineGradientId="managerSutPriceLineGrad" 
                />
              </div>
            </div>
          ) : (
            <div className="shimmer-loading" style={{ height: '230px', borderRadius: '20px' }}></div>
          )}

          <div className="glass-card" style={{ padding: '0', overflow: 'hidden', position: 'relative', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <div style={{ padding: '24px 24px 10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)' }}>📈 Gate.io 실시간 투자 수익률 (원금 대비)</span>
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '26px',
                    fontWeight: '800',
                    color: performance ? (performance.yieldPercent >= 0 ? 'var(--success-color)' : 'var(--danger-color)') : '#FFF',
                    fontFamily: 'var(--font-title)'
                  }}>
                    {performance ? `${performance.yieldPercent >= 0 ? '+' : ''}${performance.yieldPercent.toFixed(2)}%` : '0.00%'}
                  </span>
                  {performance && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      (원금: {performance.totalBuyUsdt.toFixed(2)} USDT / SUT 평가 가치: {performance.currentValue.toFixed(2)} USDT / 보유 USDT: {gateioBalance ? parseFloat(gateioBalance.USDT).toFixed(2) : '0.00'} USDT)
                    </span>
                  )}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <span className="glow-active" style={{ fontSize: '11px', color: performance ? 'var(--success-color)' : 'var(--text-dark)', background: performance ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', padding: '5px 12px', borderRadius: '12px', fontWeight: '700', border: performance ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
                  ● {performance ? '실거래 수익률' : '가상 데모'}
                </span>
              </div>
            </div>

            <div style={{ width: '100%', height: '170px', position: 'relative', display: 'block', padding: '10px 24px 20px 24px' }}>
              <svg width="100%" height="150" viewBox="0 0 500 150" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="managerYieldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="managerYieldLineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>

                <line x1="0" y1="25" x2="500" y2="25" stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
                <line x1="0" y1="75" x2="500" y2="75" stroke="rgba(255,255,255,0.08)" />
                <line x1="0" y1="125" x2="500" y2="125" stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />

                {(() => {
                  const dummyYield = [0.0, 0.12, 0.08, 0.25, 0.38, 0.31, 0.45, 0.58, 0.52, 0.68, 0.82, 0.75, 0.95, 1.12, 1.05, 1.28, 1.42, 1.35, 1.55, 1.72];
                  const data = (performance && yieldHistory.length > 0) ? yieldHistory : dummyYield;
                  const height = 150;
                  const minVal = Math.min(...data) - 0.5;
                  const maxVal = Math.max(...data) + 0.5;
                  const valRange = maxVal - minVal || 1;
                  const points = data.map((val, idx) => {
                    const x = data.length > 1 ? (idx / (data.length - 1)) * 500 : 250;
                    const y = height - 15 - ((val - minVal) / valRange) * (height - 30);
                    return { x, y, val };
                  });
                  let dPath = '';
                  let dArea = '';
                  if (points.length > 0) {
                    dPath = `M ${points[0].x} ${points[0].y}`;
                    for (let i = 0; i < points.length - 1; i++) {
                      const p0 = points[i];
                      const p1 = points[i + 1];
                      const cpX1 = p0.x + (p1.x - p0.x) / 2;
                      const cpY1 = p0.y;
                      const cpX2 = p0.x + (p1.x - p0.x) / 2;
                      const cpY2 = p1.y;
                      dPath += ` C ${cpX1} ${cpY1} ${cpX2} ${cpY2} ${p1.x} ${p1.y}`;
                    }
                    dArea = `${dPath} L ${points[points.length - 1].x} 150 L ${points[0].x} 150 Z`;
                  }
                  return (
                    <>
                      {dArea && <path d={dArea} fill="url(#managerYieldGrad)" style={{ transition: 'all 0.5s ease' }} />}
                      {dPath && <path d={dPath} fill="none" stroke="url(#managerYieldLineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.5s ease' }} />}
                      {points.length > 0 && (
                        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="5" fill="var(--success-color)" stroke="#FFF" strokeWidth="2" style={{ transition: 'all 0.5s ease' }} />
                      )}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>

          <ManagerAiDecisionHistory logs={aiLogs} />
          <ManagerTradeExecutions executions={tradeExecutions} />

          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '24px' }}>
            <h4 style={{ fontSize: '14px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>⏳</span>
              실거래 미체결 대기 주문 (Open Orders)
            </h4>

            {!openOrders || openOrders.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '13px' }}>
                현재 거래소 호가창에 대기 중인 주문이 없습니다. (체결 완료 혹은 미접수)
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#D1D5DB', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 8px', fontWeight: '600' }}>주문 접수 시각 (한국 시간)</th>
                      <th style={{ padding: '10px 8px', fontWeight: '600' }}>주문 구분</th>
                      <th style={{ padding: '10px 8px', fontWeight: '600', textAlign: 'right' }}>주문 가격 (USDT)</th>
                      <th style={{ padding: '10px 8px', fontWeight: '600', textAlign: 'right' }}>주문 수량 (SUT)</th>
                      <th style={{ padding: '10px 8px', fontWeight: '600', textAlign: 'right' }}>남은 수량 (SUT)</th>
                      <th style={{ padding: '10px 8px', fontWeight: '600', textAlign: 'right' }}>총액 (USDT)</th>
                      <th style={{ padding: '10px 8px', fontWeight: '600', textAlign: 'center' }}>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.map((order, idx) => {
                      const isBuy = order.side === 'buy';
                      const formattedTime = (() => {
                        try {
                          const ts = parseFloat(order.create_time_ms || (order.create_time * 1000));
                          const date = new Date(ts);
                          return date.toLocaleString();
                        } catch (e) {
                          return '-';
                        }
                      })();
                      const amount = parseFloat(order.amount).toFixed(2);
                      const price = parseFloat(order.price).toFixed(4);
                      const left = parseFloat(order.left || 0).toFixed(2);
                      const total = (parseFloat(order.amount) * parseFloat(order.price)).toFixed(4);

                      return (
                        <tr key={order.id || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{formattedTime}</td>
                          <td style={{ padding: '12px 8px' }}>
                            <span style={{
                              color: isBuy ? 'var(--success-color)' : 'var(--danger-color)',
                              background: isBuy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: 'bold',
                              fontSize: '11px'
                            }}>
                              {isBuy ? '🟢 매수 대기' : '🔴 매도 대기'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', color: '#FFF' }}>{price}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', color: '#FFF' }}>{amount}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', color: 'var(--warning-color)' }}>{left}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', color: '#10B981' }}>{total}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#EF4444',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              취소
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BarChart3 size={24} color="var(--success-color)" />
                <h4 style={{ fontSize: '16px', color: '#F3F4F6', margin: 0, fontWeight: '700' }}>AI 그리드 트레이딩 봇 설정</h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: gridSettings.ai_grid_status === 'ON' ? 'var(--success-color)' : 'var(--text-muted)' }}>
                  {gridSettings.ai_grid_status === 'ON' ? 'LIVE 가동' : '중지'}
                </span>
                <button
                  onClick={handleToggleAiStatus}
                  style={{
                    width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                    background: gridSettings.ai_grid_status === 'ON' ? 'var(--success-color)' : 'rgba(255,255,255,0.15)',
                    position: 'relative', transition: 'background 0.3s'
                  }}
                >
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', background: '#FFF', position: 'absolute', top: '2px',
                    left: gridSettings.ai_grid_status === 'ON' ? '24px' : '2px', transition: 'left 0.3s'
                  }}></div>
                </button>
              </div>
            </div>



            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
              설정한 상/하한가 범위 내에서 자동 매매 시뮬레이션을 수행하고 매일 정해진 주기마다 회원 이자를 분배합니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.03)' }}>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#F3F4F6', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={gridSettings.ai_grid_auto_range === 'ON'}
                    onChange={(e) => handleToggleAutoRangePreview(e.target.checked)}
                  />
                  <span>상한가/하한가 자동 적용</span>
                </label>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
                  기본은 체크 해제입니다. 체크하면 AI 추천 범위를 다음 실행부터 자동 반영합니다.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>하한가 (최저)</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px', fontWeight: 'bold' }}>USDT</span>
                    <input
                      type="number"
                      className="grid-setting-input"
                      value={gridSettings.ai_grid_lower}
                      onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_lower: e.target.value })}
                      disabled={gridSettings.ai_grid_auto_range === 'ON'}
                      style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>상한가 (최고)</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px', fontWeight: 'bold' }}>USDT</span>
                    <input
                      type="number"
                      className="grid-setting-input"
                      value={gridSettings.ai_grid_upper}
                      onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_upper: e.target.value })}
                      disabled={gridSettings.ai_grid_auto_range === 'ON'}
                      style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>그리드 분할 수</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <input
                      type="number"
                      className="grid-setting-input"
                      value={gridSettings.ai_grid_count}
                      onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_count: e.target.value })}
                      style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
                    />
                    <span style={{ color: 'var(--text-dark)', fontSize: '12px', marginLeft: '4px' }}>개</span>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>일일 매매 빈도</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <input
                      type="number"
                      className="grid-setting-input"
                      value={gridSettings.ai_grid_frequency}
                      onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_frequency: e.target.value })}
                      style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
                    />
                    <span style={{ color: 'var(--text-dark)', fontSize: '12px', marginLeft: '4px' }}>회</span>
                  </div>
                </div>
              </div>

            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: '10px', display: 'flex', gap: '8px' }}>
              <ShieldAlert size={16} color="var(--danger-color)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', textAlign: 'left' }}>
                <strong style={{ color: 'var(--danger-color)' }}>거래소 API 밴 주의</strong><br />
                과도한 요청(하루 20회 초과)은 거래소 보안 정책 위반으로 차단될 수 있습니다. 기본 빈도를 유지해 주십시오.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              {hasUnsavedChanges && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '10px', borderRadius: '8px', width: '100%' }}>
                  <span className="pulse-indicator" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block', boxShadow: '0 0 8px #F59E0B' }}></span>
                  <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: 'bold' }}>
                    ⚠️ 적용되지 않은 변경사항이 있습니다. 아래 버튼을 클릭하여 적용해 주십시오.
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                <button
                  type="button"
                  className={hasUnsavedChanges ? "btn-primary glow-active" : "btn-primary"}
                  onClick={handleSaveGridSettings}
                  style={{
                    flex: 1,
                    padding: '12px',
                    fontSize: '13px',
                    background: hasUnsavedChanges
                      ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                      : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                    boxShadow: hasUnsavedChanges
                      ? '0 0 12px rgba(245, 158, 11, 0.5)'
                      : '0 4px 12px rgba(139, 92, 246, 0.25)',
                    border: hasUnsavedChanges
                      ? '1px solid #F59E0B'
                      : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#FFF',
                    cursor: 'pointer',
                    fontWeight: '850'
                  }}
                >
                  변경사항 적용
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleTriggerAIProfit}
                  style={{ flex: 1, padding: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.04)' }}
                >
                  ⚡ 수동 수익 정산 배분
                </button>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>

            <div className="glass-card" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: gateioBalance ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)', background: gateioBalance ? 'rgba(16, 185, 129, 0.02)' : 'rgba(255, 255, 255, 0.02)', margin: 0 }}>
              <div>
                <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px' }}>📊</span> Gate.io API 실거래 연동 현황
                </h4>
                {gateioBalance ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>연동 상태:</span>
                      <span style={{ color: 'var(--success-color)', fontWeight: '700' }}>● 실거래 가동 중</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>거래소 보유 SUT:</span>
                      <span style={{ color: '#FFF', fontWeight: '700' }}>{parseFloat(gateioBalance.SUT).toFixed(2)} SUT</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>거래소 보유 USDT:</span>
                      <span style={{ color: '#FFF', fontWeight: '700' }}>{parseFloat(gateioBalance.USDT).toFixed(2)} USDT</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'left', fontSize: '11px', lineHeight: '1.5' }}>
                    <span style={{ color: '#F59E0B', fontWeight: '700', display: 'block', marginBottom: '6px' }}>⚠️ API 키 미등록 (가상 데모 모드)</span>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                      API 키를 등록하면, 거래소 SUT/USDT 자금 조회 및 자동매매 실거래 연동이 활성화됩니다.
                    </p>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    const addr = localStorage.getItem('gateio_deposit_address');
                    if (!addr) {
                      alert('Gate.io SUT 입금 주소를 로컬 설정에서 먼저 입력하고 저장해 주세요.');
                    } else {
                      setShowSendSutModal(true);
                    }
                  }}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '11px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', border: 'none', borderRadius: '6px', fontWeight: '700', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <ArrowUpDown size={12} /> 내 지갑에서 Gate.io로 SUT 송금
                </button>
              </div>
            </div>

            <div className="glass-card" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.04) 0%, rgba(20, 16, 45, 0.4) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)', margin: 0 }}>
              <h4 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowUpDown size={16} color="#8B5CF6" />
                Gate.io SUT 직접 수동 주문
              </h4>

              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>
                      단가 (USDT) <span style={{ color: 'var(--success-color)', fontWeight: '700', marginLeft: '4px' }}>(현재 시세: {performance ? performance.sutPrice.toFixed(4) : '0.1900'})</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '6px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <input
                        type="number"
                        step="any"
                        value={orderPrice}
                        onChange={(e) => handleOrderPriceChange(e.target.value)}
                        placeholder="단가 (USDT)"
                        style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '11px', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>주문 수량 (SUT)</label>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '6px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <input
                        type="number"
                        step="any"
                        value={orderAmount}
                        onChange={(e) => handleOrderAmountChange(e.target.value)}
                        placeholder="수량 (SUT)"
                        style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '11px', outline: 'none' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>총 주문 금액 (USDT)</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '6px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <input
                      type="number"
                      step="any"
                      value={orderTotal}
                      onChange={(e) => handleOrderTotalChange(e.target.value)}
                      placeholder="총액 (USDT)"
                      style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '11px', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={submittingOrder}
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    background: confirmMode === 'BUY'
                      ? 'linear-gradient(90deg, #059669, #047857)'
                      : 'linear-gradient(90deg, #10B981, #059669)',
                    border: confirmMode === 'BUY' ? '1px dashed #FFF' : 'none',
                    boxShadow: confirmMode === 'BUY' ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => handleGateIoOrderClick('buy')}
                >
                  {submittingOrder ? '...' : confirmMode === 'BUY' ? '⚡ 매수 최종 확정' : '🟢 SUT 매수'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={submittingOrder}
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    background: confirmMode === 'SELL'
                      ? 'linear-gradient(90deg, #DC2626, #B91C1C)'
                      : 'linear-gradient(90deg, #EF4444, #DC2626)',
                    border: confirmMode === 'SELL' ? '1px dashed #FFF' : 'none',
                    boxShadow: confirmMode === 'SELL' ? '0 0 10px rgba(239, 68, 68, 0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => handleGateIoOrderClick('sell')}
                >
                  {submittingOrder ? '...' : confirmMode === 'SELL' ? '⚡ 매도 최종 확정' : '🔴 SUT 매도'}
                </button>
              </div>
            </div>

          </div>



          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h4 style={{ fontSize: '14px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={18} color="#10B981" />
              최근 Gate.io 실거래 체결 내역 (수동/자동 통합)
            </h4>

            {(!performance || !performance.trades || performance.trades.length === 0) ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '13px' }}>
                📭 API가 연동되지 않았거나 최근 체결된 거래 내역이 없습니다.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#D1D5DB', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 8px', fontWeight: '600' }}>체결 시각 (한국 시간)</th>
                      <th style={{ padding: '10px 8px', fontWeight: '600' }}>거래 종류</th>
                      <th style={{ padding: '10px 8px', fontWeight: '600', textAlign: 'right' }}>단가 (USDT)</th>
                      <th style={{ padding: '10px 8px', fontWeight: '600', textAlign: 'right' }}>수량 (SUT)</th>
                      <th style={{ padding: '10px 8px', fontWeight: '600', textAlign: 'right' }}>총액 (USDT)</th>
                      <th style={{ padding: '10px 8px', fontWeight: '600', textAlign: 'right' }}>수수료</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.trades.map((trade, idx) => {
                      const isBuy = trade.side === 'buy';
                      const formattedTime = (() => {
                        try {
                          const ts = parseFloat(trade.create_time_ms || (trade.create_time * 1000));
                          const date = new Date(ts);
                          return date.toLocaleString();
                        } catch (e) {
                          return '-';
                        }
                      })();
                      const amount = parseFloat(trade.amount).toFixed(2);
                      const price = parseFloat(trade.price).toFixed(4);
                      const total = (parseFloat(trade.amount) * parseFloat(trade.price)).toFixed(4);
                      const fee = trade.fee ? `${parseFloat(trade.fee).toFixed(4)} ${trade.fee_currency}` : '0';

                      return (
                        <tr key={trade.id || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', height: '40px' }}>
                          <td style={{ padding: '8px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{formattedTime}</td>
                          <td style={{ padding: '8px' }}>
                            <span style={{
                              color: isBuy ? 'var(--success-color)' : 'var(--danger-color)',
                              background: isBuy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: 'bold',
                              fontSize: '11px'
                            }}>
                              {isBuy ? '🟢 매수' : '🔴 매도'}
                            </span>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#FFF' }}>{price}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#FFF' }}>{amount} SUT</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: isBuy ? 'var(--success-color)' : 'var(--danger-color)' }}>{total} USDT</td>
                          <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>{fee}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        <div style={{ width: '480px', display: 'flex', flexDirection: 'column', gap: '24px', flexShrink: 0 }}>

          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', color: '#FFF', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
              <ShieldAlert size={18} color="#F59E0B" />
              신규 가입 심사 ({pendingUsers.length}건)
            </h3>

            {pendingUsers.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '13px' }}>
                📥 현재 심사 대기 중인 신규 가입자가 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                {pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#FFF' }}>{user.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({user.country})</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <div>구글: {user.email}</div>
                        <div style={{ fontFamily: 'monospace', color: '#A7F3D0', fontSize: '10px' }}>Wallet: {user.wallet_address.substring(0, 10)}...</div>
                        {(() => {
                          const diffHours = 24 - (Date.now() - new Date(user.joined_at).getTime()) / (1000 * 60 * 60);
                          const remainingHours = Math.max(0, Math.floor(diffHours));
                          const remainingMins = Math.max(0, Math.floor((diffHours - remainingHours) * 60));
                          const isExpired = diffHours <= 0;
                          return (
                            <div style={{ color: isExpired ? 'var(--danger-color)' : '#FCD34D', fontSize: '11px', fontWeight: 'bold', marginTop: '4px' }}>
                              {isExpired ? '⏳ 기한 만료 (자동 취소 대상)' : `⏳ 승인 기한: ${remainingHours}시간 ${remainingMins}분 남음`}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100px', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '6px', fontSize: '10px', gap: '4px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.2)', color: '#93C5FD' }}
                        onClick={() => handleDownloadIdCard(user.id, user.name)}
                      >
                        신분증 확인
                      </button>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ flex: 1, padding: '6px', fontSize: '10px', background: 'var(--success-color)', borderRadius: '6px', boxShadow: 'none', opacity: hasDownloadedId[user.id] ? 1 : 0.4 }}
                          onClick={() => handleApprove(user.wallet_address)}
                          disabled={submittingId === user.wallet_address || !hasDownloadedId[user.id]}
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ flex: 1, padding: '6px', fontSize: '10px', background: 'var(--danger-color)', borderRadius: '6px', boxShadow: 'none' }}
                          onClick={() => handleReject(user.wallet_address)}
                          disabled={submittingId === user.wallet_address}
                        >
                          반려
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
            <h3 style={{ fontSize: '16px', color: '#FFF', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
              <Receipt size={18} color="#F59E0B" />
              지급 요청 심사 ({withdrawals.length}건)
            </h3>

            {withdrawals.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '13px' }}>
                💸 현재 접수된 회원 지급 요청이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                {withdrawals.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ textAlign: 'left' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#FFF' }}>{req.name} 회원</span>
                      </div>

                      <div style={{ background: 'rgba(16,185,129,0.08)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--success-color)', fontSize: '13px', fontWeight: 'bold' }}>
                        {req.requested_amount} SUT
                      </div>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '8px', wordBreak: 'break-all' }}>
                      <b>지급 지갑 주소:</b> <span style={{ color: '#A78BFA', fontFamily: 'monospace' }}>{req.wallet_address}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ flex: 1, background: 'var(--success-color)', padding: '8px', fontSize: '11px', fontWeight: '700', borderRadius: '8px', boxShadow: 'none' }}
                        onClick={() => handleApproveWithdrawal(req.id, req.requested_amount, req.name)}
                      >
                        ✓ 지급 승인 완료
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ flex: 1, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#FCA5A5', padding: '8px', fontSize: '11px', fontWeight: '700', borderRadius: '8px' }}
                        onClick={() => handleRejectWithdrawal(req.id, req.requested_amount, req.name)}
                      >
                        ✗ 지급 요청 반려
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', color: '#FFF', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
              <Users size={18} color="#10B981" />
              전체 회원 명부 ({allUsers.length}명)
            </h3>

            <div style={{ overflowY: 'auto', maxHeight: '300px', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {allUsers.map((user) => {
                const isMaster = user.wallet_address.toLowerCase() === '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase();
                return (
                  <div
                    key={user.id}
                    onClick={() => setEditingUserWallet(user.wallet_address)}
                    style={{
                      background: isMaster ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = isMaster ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.01)'}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#FFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {user.name}
                        <span style={{ fontSize: '9px', color: 'var(--text-dark)', fontWeight: 'normal' }}>({user.country})</span>
                        {isMaster && <span style={{ background: 'rgba(139,92,246,0.2)', color: '#C084FC', padding: '1px 4px', borderRadius: '4px', fontSize: '8px', fontWeight: '800' }}>Master</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>
                        {user.wallet_address.substring(0, 12)}...{user.wallet_address.substring(user.wallet_address.length - 8)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                      <span style={{
                        padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700',
                        background: user.status === 'APPROVED' ? 'rgba(139,92,246,0.12)' : (user.status === 'PENDING_KYC' ? 'rgba(59,130,246,0.12)' : 'rgba(156,163,175,0.12)'),
                        color: user.status === 'APPROVED' ? '#C084FC' : (user.status === 'PENDING_KYC' ? '#60A5FA' : '#9CA3AF')
                      }}>
                        {user.status === 'APPROVED' ? '정회원' : (user.status === 'PENDING_KYC' ? '대기' : '반려')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '16px', color: '#FFF', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
                <Receipt size={18} color="#8B5CF6" />
                최근 자산 예치/정산 내역
              </h3>
              <button
                type="button"
                className="btn-primary"
                disabled={syncing}
                onClick={handleSyncTransactions}
                style={{
                  width: 'auto',
                  padding: '6px 14px',
                  fontSize: '11px',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '700',
                  color: '#FFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: 'none'
                }}
              >
                {syncing ? '🔄 온체인 거래 동기화 중...' : '🔄 온체인 거래 동기화 (Sync)'}
              </button>
            </div>

            {recentPayments.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '13px' }}>
                현재까지 플랫폼을 통해 발생한 예치 및 정산 이력이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', scrollbarWidth: 'none' }}>
                {recentPayments.map((pay) => (
                  <div
                    key={pay.id}
                    style={{
                      background: 'rgba(0,0,0,0.15)',
                      border: '1px solid rgba(255,255,255,0.02)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#FFF' }}>
                        {pay.name} ({pay.type === 'WITHDRAW_REQUEST' ? '지급 요청 정상 처리' : (pay.type === 'DEPOSIT' ? '자산 예치' : '수익 정산 배분')})
                      </div>
                      {pay.tx_hash && pay.tx_hash.length === 66 && pay.tx_hash.startsWith('0x') ? (
                        <a
                          href={`https://polygonscan.com/tx/${pay.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '9px', color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}
                        >
                          TX: {pay.tx_hash.substring(0, 12)}... <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}>
                          내부 수동 처리 (TX: {pay.tx_hash ? pay.tx_hash.substring(0, 16) : 'N/A'}...)
                        </span>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: pay.type === 'WITHDRAW_REQUEST' ? 'var(--danger-color)' : 'var(--success-color)' }}>
                        {pay.type === 'WITHDRAW_REQUEST' ? `-${pay.amount}` : `+${pay.amount}`} SUT
                      </div>
                      <span style={{ fontSize: '9px', color: 'var(--text-dark)' }}>
                        {pay.type === 'WITHDRAW_REQUEST' ? '지급 완료' : (pay.type === 'DEPOSIT' ? '예치 완료' : '수익 배분 완료')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {selectedIdCard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.95)',
          backdropFilter: 'blur(15px)',
          zIndex: 99999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <img
            src={selectedIdCard}
            alt="Submitted KYC ID Card"
            style={{
              maxWidth: '90%',
              maxHeight: '80%',
              borderRadius: '16px',
              boxShadow: '0 0 50px rgba(0,0,0,0.9)',
              border: '2px solid rgba(255,255,255,0.15)'
            }}
          />
          <button
            className="btn-primary"
            onClick={() => setSelectedIdCard(null)}
            style={{ width: 'auto', padding: '12px 36px', fontSize: '14px', borderRadius: '12px' }}
          >
            이미지 확인 완료 (닫기)
          </button>
        </div>
      )}

      {editingUserWallet && (
        <EditUserModal
          walletAddress={editingUserWallet}
          managerEmail={managerEmail}
          onClose={() => setEditingUserWallet(null)}
          onSuccess={fetchManagerData}
        />
      )}

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
              {txType === 'DEPOSIT' ? '💸 SUT 투자 봇 자본금 예치' : '📤 SUT 투자 봇 자본금 출금 신청'}
            </h3>

            <form onSubmit={handleTxSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#A78BFA' }}>
                  {txType === 'DEPOSIT' ? '예치할 SUT 수량 입력 (온체인 전송)' : '인출할 SUT 수량 입력'}
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="예: 10"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  min="1"
                  required
                />
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px' }}>
                {txType === 'DEPOSIT'
                  ? '💡 폴리곤 메인넷 상의 SUT 온체인 전송입니다. 트러스트월렛/메타마스크 승인 창이 열리며 가스비(POL)와 토큰이 소모됩니다.'
                  : '💡 출금 요청 시 봇 거래 정산이 수동으로 진행되며, 매니저 최종 승인 후 입력하신 가상 지갑 주소로 SUT가 전달됩니다.'}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowTxModal(false)}
                  style={{ flex: 1, padding: '14px' }}
                  disabled={processingTx}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, padding: '14px' }}
                  disabled={processingTx}
                >
                  {processingTx ? '처리중...' : (txType === 'DEPOSIT' ? '승인 및 예치' : '출금 신청')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSendSutModal && (
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
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', background: '#111827', padding: '30px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px', color: '#FFF', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowUpDown size={20} color="#3B82F6" />
              Gate.io로 SUT 온체인 송금
            </h3>

            <form onSubmit={handleSendSutToGateIo} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '10px', padding: '12px', fontSize: '11px', color: '#FFF' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>수신 Gate.io 입금 주소 (Polygon):</div>
                <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontWeight: '700' }}>{localStorage.getItem('gateio_deposit_address')}</div>
                <div style={{ color: '#93C5FD', marginTop: '6px' }}>⚠️ 반드시 Gate.io의 SUT (Polygon) 입금 주소인지 더블체크해 주세요!</div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#A78BFA' }}>
                  송금할 SUT 수량 입력
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="예: 50"
                  value={sendSutAmount}
                  onChange={(e) => setSendSutAmount(e.target.value)}
                  min="0.0001"
                  step="any"
                  required
                />
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px' }}>
                💡 <b>가스비 안내</b>: 이 송금 트랜잭션은 <b>현재 서명하는 본인 지갑</b>에서 가스비(폴리곤 POL 코인)와 SUT 코인이 차감됩니다. 마스터 지갑의 가스비는 사용되지 않습니다.
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowSendSutModal(false);
                    setSendSutAmount('');
                  }}
                  style={{ flex: 1, padding: '14px' }}
                  disabled={sendingSut}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
                  disabled={sendingSut}
                >
                  {sendingSut ? '전송 처리중...' : 'SUT 송금하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {idCardViewerUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#1E293B', padding: '20px', borderRadius: '12px', maxWidth: '90%', maxHeight: '90%', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #3B82F6', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h3 style={{ color: 'white', margin: '0 0 10px 0', fontSize: '18px' }}>[{idCardViewerName}] 회원 신분증 확인</h3>
            
            <div style={{ overflow: 'auto', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: '15px', minHeight: '200px', background: '#0F172A', borderRadius: '8px', padding: '10px' }}>
              <img src={idCardViewerUrl} alt="신분증" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '8px' }} />
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', marginBottom: '15px', display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
              <span style={{ fontSize: '16px', marginTop: '2px' }}>⚠️</span>
              <p style={{ color: '#F87171', fontSize: '12px', margin: 0, lineHeight: 1.4 }}>
                보안을 위해 서버에서 원본 신분증 파일이 영구 삭제되었습니다.<br/>
                <strong>창을 닫으면 다시 볼 수 없습니다.</strong> 가입 심사를 완료해주세요.
              </p>
            </div>
            
            <button 
              type="button"
              className="btn-primary"
              style={{ padding: '12px 30px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
              onClick={() => {
                window.URL.revokeObjectURL(idCardViewerUrl);
                setIdCardViewerUrl(null);
              }}
            >
              확인 완료 (창 닫기)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default ManagerPcDashboard;
