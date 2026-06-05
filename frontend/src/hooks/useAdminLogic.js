import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';

export function useAdminLogic(managerEmail) {
  // 매니저 목록 및 상태 관리
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoteWallet, setPromoteWallet] = useState('');
  const [submittingPromote, setSubmittingPromote] = useState(false);
  const [submittingDelete, setSubmittingDelete] = useState(null);
  
  // 글로벌 AI 설정 상태 관리
  const [globalAiModel, setGlobalAiModel] = useState('Gemini 3.5 Flash');
  const [globalGeminiApiKey, setGlobalGeminiApiKey] = useState('');
  const [globalAiInterval, setGlobalAiInterval] = useState('5');
  const [savingAiConfig, setSavingAiConfig] = useState(false);

  // 최종 어드민 권한 고정 계정 정의
  const ADMIN_EMAIL = 'lemaiiisk@gmail.com'.toLowerCase();
  const isAdmin = managerEmail && managerEmail.toLowerCase().trim() === ADMIN_EMAIL;

  // 어드민 연동 헤더 빌드
  const getAdminHeaders = () => {
    return {
      headers: {
        'x-admin-email': ADMIN_EMAIL
      }
    };
  };

  // 매니저 목록 조회
  const fetchManagers = async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API_BASE}/admin/managers`, getAdminHeaders());
      if (res.data.success) {
        setManagers(res.data.managers);
      }
    } catch (err) {
      console.error('매니저 목록 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 글로벌 AI 설정 조회
  const fetchAiConfig = async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API_BASE}/admin/ai-config`, getAdminHeaders());
      if (res.data.success && res.data.config) {
        setGlobalAiModel(res.data.config.model || 'Gemini 3.5 Flash');
        setGlobalGeminiApiKey(res.data.config.apiKey || '');
        setGlobalAiInterval(res.data.config.interval || '5');
      }
    } catch (err) {
      console.error('글로벌 AI 설정 로드 실패:', err);
    }
  };

  // 글로벌 AI 설정 저장
  const handleSaveAiConfig = async (e) => {
    if (e) e.preventDefault();
    if (!globalGeminiApiKey.trim()) {
      alert("Gemini API Key를 입력해 주십시오.");
      return;
    }

    setSavingAiConfig(true);
    try {
      const res = await axios.post(`${API_BASE}/admin/save-ai-config`, {
        model: globalAiModel,
        apiKey: globalGeminiApiKey.trim(),
        interval: globalAiInterval
      }, getAdminHeaders());

      if (res.data.success) {
        alert("🎉 글로벌 AI 설정이 서버 DB에 정상적으로 저장되었습니다. 이제 모든 매니저 봇이 이 AI 두뇌를 사용해 오토 봇 매매를 실행합니다.");
        fetchAiConfig();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 설정 저장 실패: ${errMsg}`);
    } finally {
      setSavingAiConfig(false);
    }
  };

  useEffect(() => {
    fetchManagers();
    fetchAiConfig();
    // 5초 간격 실시간 갱신
    const interval = setInterval(fetchManagers, 5000);
    return () => clearInterval(interval);
  }, [managerEmail]);

  // 매니저 승격 격발
  const handlePromoteManager = async (e) => {
    if (e) e.preventDefault();
    if (!promoteWallet || promoteWallet.trim().length !== 42) {
      alert("올바른 42자리 지갑 주소를 입력해 주십시오.");
      return;
    }

    if (!confirm(`해당 회원(${promoteWallet.trim()})을 매니저로 정식 승격시키겠습니까?\n\n승격 시 기존 매니저 소속에서 이탈하여 독립 500명 가입 정원을 가집니다.`)) {
      return;
    }

    setSubmittingPromote(true);
    try {
      const res = await axios.post(`${API_BASE}/admin/promote-manager`, {
        walletAddress: promoteWallet.trim()
      }, getAdminHeaders());

      if (res.data.success) {
        alert(`🎉 ${res.data.message}`);
        setPromoteWallet('');
        fetchManagers();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 승격 실패: ${errMsg}`);
    } finally {
      setSubmittingPromote(false);
    }
  };

  // 매니저 계정 삭제 및 이관 격발
  const handleDeleteManager = async (walletAddr, name) => {
    if (!confirm(`⚠️ 경고: [${name}] 매니저 계정을 데이터베이스에서 영구 삭제하시겠습니까?\n\n이 작업은 취소할 수 없으며, 해당 매니저 산하의 모든 회원은 마스터 매니저 밑으로 강제 자동 이관됩니다.`)) {
      return;
    }

    setSubmittingDelete(walletAddr);
    try {
      const res = await axios.post(`${API_BASE}/admin/delete-manager`, {
        walletAddress: walletAddr
      }, getAdminHeaders());

      if (res.data.success) {
        alert(`🗑️ ${res.data.message}`);
        fetchManagers();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 삭제 실패: ${errMsg}`);
    } finally {
      setSubmittingDelete(null);
    }
  };

  return {
    managers,
    loading,
    promoteWallet,
    setPromoteWallet,
    submittingPromote,
    submittingDelete,
    globalAiModel,
    setGlobalAiModel,
    globalGeminiApiKey,
    setGlobalGeminiApiKey,
    globalAiInterval,
    setGlobalAiInterval,
    savingAiConfig,
    isAdmin,
    handlePromoteManager,
    handleDeleteManager,
    handleSaveAiConfig
  };
}
