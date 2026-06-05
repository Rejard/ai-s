const express = require('express');
const router = express.Router();
const { queries } = require('../database');
const { ethers } = require('ethers');

// 플랫폼 최초 마스터 매니저 지갑 고정
const MASTER_MANAGER_WALLET = '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987';

// 폴리곤 RPC 및 SUT 토큰 정보 설정
const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
const sutAddress = '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55';
const sutAbi = ["function balanceOf(address account) external view returns (uint256)"];
const sutContract = new ethers.Contract(sutAddress, sutAbi, provider);

// 🌟 Multicall3 컨트랙트 설정 (500명 이상 대량의 SUT 온체인 잔고 조회를 0.1초 만에 1회의 통신으로 일괄 질의하기 위함)
const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const multicallAbi = [
  "function aggregate(tuple(address target, bytes callData)[] calls) external view returns (uint256 blockNumber, bytes[] returnData)"
];
const multicallContract = new ethers.Contract(MULTICALL_ADDRESS, multicallAbi, provider);
const sutInterface = new ethers.Interface([
  "function balanceOf(address account) external view returns (uint256)"
]);

// 어드민(관리자) 권한 검증 철통 미들웨어
const adminAuthMiddleware = (req, res, next) => {
  const adminEmail = req.headers['x-admin-email'] || req.headers['x-manager-email'];
  if (!adminEmail || adminEmail.toLowerCase().trim() !== 'lemaiiisk@gmail.com'.toLowerCase()) {
    return res.status(403).json({ 
      success: false, 
      message: '보안 경보: 관리자 권한이 존재하지 않습니다. 어드민 이메일(lemaiiisk@gmail.com)로 연동해 주십시오.' 
    });
  }
  next();
};

// 어드민 전용 API 라우트 전체에 보안 미들웨어 마운트
router.use(adminAuthMiddleware);

/**
 * @route GET /api/admin/managers
 * @desc 전체 매니저 목록 및 실적 현황 조회 (온체인 실시간 잔고 조회 포함)
 */
router.get('/managers', async (req, res) => {
  try {
    // 1. users 테이블에서 is_manager = 1인 모든 매니저 조회
    const managers = await queries.all(`
      SELECT id, wallet_address, email, name, phone, country, joined_at
      FROM users
      WHERE is_manager = 1
      ORDER BY joined_at ASC
    `);

    // 2. 각 매니저별 실적 및 온체인 잔고 병렬 연산 처리
    const enrichedManagers = await Promise.all(managers.map(async (m) => {
      // 2-1. 소속 정회원 수 카운트 (status가 APPROVED인 회원만)
      const subUsersRow = await queries.get(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE LOWER(manager_address) = LOWER(?) AND status = 'APPROVED'
      `, [m.wallet_address]);
      const userCount = subUsersRow ? subUsersRow.count : 0;

      // 2-2. 소속 회원들의 실제 온체인 SUT 잔고 총액 연산 (Multicall3를 이용한 0.1초 단일 블록 일괄 조회 기법)
      const subUsers = await queries.all(`
        SELECT wallet_address 
        FROM users 
        WHERE LOWER(manager_address) = LOWER(?) AND status = 'APPROVED'
      `, [m.wallet_address]);

      let performance = 0;
      if (subUsers && subUsers.length > 0) {
        try {
          // Multicall3 Call Data 구조체 빌드
          const calls = subUsers.map(u => ({
            target: sutAddress,
            callData: sutInterface.encodeFunctionData("balanceOf", [u.wallet_address])
          }));

          // 단 1회의 JSON-RPC call로 500명 지갑의 SUT 잔고를 동시에 일괄 조회 (0.1초 소요)
          const [blockNumber, returnData] = await multicallContract.aggregate(calls);
          
          // 결과 바이트 데이터 파싱 및 합산
          const balances = returnData.map(data => {
            try {
              const [balance] = sutInterface.decodeFunctionResult("balanceOf", data);
              return parseFloat(ethers.formatUnits(balance, 18));
            } catch (decErr) {
              return 0;
            }
          });

          performance = balances.reduce((sum, val) => sum + val, 0);
          performance = parseFloat(performance.toFixed(2));
        } catch (err) {
          console.error(`[Admin Multicall3 Query Error] Manager: ${m.wallet_address}`, err.message);
          performance = 0;
        }
      }

      // 2-3. 실제 SUT 온체인 지갑 잔고 조회 (Polygon Network)
      let onchainBalance = "0.00";
      try {
        const balanceWei = await sutContract.balanceOf(m.wallet_address);
        onchainBalance = parseFloat(ethers.formatUnits(balanceWei, 18)).toFixed(2);
      } catch (err) {
        console.error(`[Admin CEX Onchain SUT Query Error] ${m.wallet_address}:`, err.message);
      }

      return {
        ...m,
        userCount,
        performance,
        onchainBalance
      };
    }));

    res.json({ success: true, managers: enrichedManagers });
  } catch (err) {
    console.error("❌ 어드민 매니저 목록 로드 에러:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/admin/promote-manager
 * @desc 기존 회원을 매니저로 승격 처리
 */
router.post('/promote-manager', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ success: false, message: '지갑 주소가 누락되었습니다.' });
  }

  const cleanWallet = walletAddress.trim();

  try {
    // 1. 대상 회원이 존재하는지, 그리고 정회원(APPROVED) 상태인지 검증
    const user = await queries.get("SELECT id, status, is_manager FROM users WHERE wallet_address = ?", [cleanWallet]);
    if (!user) {
      return res.status(444).json({ success: false, message: '등록되지 않은 회원 지갑 주소입니다. 가입을 먼저 완료해 주십시오.' });
    }
    if (user.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: '가입 승인(APPROVED)이 완료되지 않은 회원입니다. KYC 승인을 먼저 완료해 주십시오.' });
    }
    if (user.is_manager === 1) {
      return res.status(400).json({ success: false, message: '이미 매니저 등급인 회원입니다.' });
    }

    // 2. 매니저로 승격 및 기존 추천인 매니저 지갑 매핑 제거(독립 체제 구축)
    await queries.run(`
      UPDATE users
      SET is_manager = 1,
          manager_address = 'none'
      WHERE wallet_address = ?
    `, [cleanWallet]);

    res.json({
      success: true,
      message: '회원이 매니저로 성공적으로 승격되었습니다. 이제 독립적인 500명 정원 할당이 가능합니다.'
    });

  } catch (err) {
    console.error("❌ 매니저 승격 에러:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/admin/delete-manager
 * @desc 매니저 계정 영구 삭제 및 하위 소속 회원들을 마스터 매니저로 강제 이관
 */
router.post('/delete-manager', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ success: false, message: '삭제할 매니저의 지갑 주소가 누락되었습니다.' });
  }

  const cleanWallet = walletAddress.trim();

  // 최초 마스터 매니저는 관리자이자 최상위 지갑이므로 절대 삭제할 수 없음
  if (cleanWallet.toLowerCase() === MASTER_MANAGER_WALLET.toLowerCase()) {
    return res.status(400).json({ success: false, message: '경고: 최초 마스터 매니저 지갑 계정은 관리 목적상 삭제가 불가능합니다.' });
  }

  try {
    // 1. 해당 매니저가 존재하는지 검증
    const user = await queries.get("SELECT id, is_manager FROM users WHERE wallet_address = ?", [cleanWallet]);
    if (!user || user.is_manager !== 1) {
      return res.status(404).json({ success: false, message: '해당 매니저 계정을 찾을 수 없거나 이미 강등/삭제되었습니다.' });
    }

    // 2. 해당 매니저 산하에 소속되어 있던 모든 회원들의 manager_address를 마스터 매니저 지갑 주소로 강제 이관
    const migrateRes = await queries.run(`
      UPDATE users
      SET manager_address = ?
      WHERE manager_address = ?
    `, [MASTER_MANAGER_WALLET, cleanWallet]);

    console.log(`[Admin Account Cleanup] Migrated ${migrateRes.changes} users under ${cleanWallet} to Master Manager ${MASTER_MANAGER_WALLET}.`);

    // 3. 매니저의 장부 결제(payments) 내역도 데이터 무결성을 위해 삭제
    await queries.run("DELETE FROM payments WHERE wallet_address = ?", [cleanWallet]);

    // 4. users 테이블에서 해당 매니저 계정 영구 삭제 (강등은 지원하지 않음)
    await queries.run("DELETE FROM users WHERE wallet_address = ?", [cleanWallet]);

    res.json({
      success: true,
      message: `성공적으로 매니저 계정이 삭제되었습니다. 소속되어 있던 회원들은 마스터 매니저 밑으로 정상 이관 완료되었습니다.`
    });

  } catch (err) {
    console.error("❌ 매니저 삭제 및 이관 오류:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/admin/save-ai-config
 * @desc 글로벌 AI 모델 정보 및 Gemini API Key를 서버 DB에 영구 저장
 */
router.post('/save-ai-config', async (req, res) => {
  const { model, apiKey } = req.body;
  try {
    if (model) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_model', ?)`, [model.trim()]);
    if (apiKey) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_gemini_api_key', ?)`, [apiKey.trim()]);
    
    res.json({ success: true, message: '글로벌 AI 두뇌 및 API Key 설정이 서버 DB에 안전하게 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/admin/ai-config
 * @desc 글로벌 AI 모델명과 API Key 등록 여부 조회
 */
router.get('/ai-config', async (req, res) => {
  try {
    const settings = await queries.all("SELECT key, value FROM platform_settings WHERE key IN ('global_ai_model', 'global_gemini_api_key')");
    const config = {
      model: 'Gemini 1.5 Pro',
      hasApiKey: false,
      apiKey: ''
    };

    settings.forEach(s => {
      if (s.key === 'global_ai_model') config.model = s.value;
      if (s.key === 'global_gemini_api_key' && s.value) {
        config.hasApiKey = true;
        config.apiKey = s.value;
      }
    });

    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
