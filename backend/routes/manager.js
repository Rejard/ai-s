const express = require('express');
const router = express.Router();
const axios = require('axios');
const { queries } = require('../database');
const { getGateIoBalances, createGateIoOrder, getGateIoMyTrades } = require('../gateioHelper');
const { decryptText, encryptText } = require('../secureCredentials');

// 플랫폼 최초 마스터 매니저 (이명학 - Root Master Wallet) 지갑 주소 고정
const MASTER_MANAGER_WALLET = '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987';

// 남들의 메니져 데이터 불법 조회 및 제어를 원천 차단하는 철통 보안 미들웨어!
// 기존 지갑 주소 검증 대신, 본인 인증의 최종 진리인 구글 이메일 lemaiiisk@gmail.com을 기준으로 통제합니다.
const getRequestManagerEmail = (req) => (req.headers['x-manager-email'] || '').toLowerCase().trim();

const managerAuthMiddleware = async (req, res, next) => {
  const managerEmail = getRequestManagerEmail(req);
  if (!managerEmail) {
    return res.status(403).json({
      success: false,
      message: '매니저 이메일 인증 정보가 없습니다.'
    });
  }

  if (managerEmail === 'lemaiiisk@gmail.com') {
    req.managerEmail = managerEmail;
    return next();
  }

  try {
    const manager = await queries.get(
      "SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND is_manager = 1 AND status = 'APPROVED'",
      [managerEmail]
    );
    if (!manager) {
      return res.status(403).json({
        success: false,
        message: '매니저 권한이 존재하지 않습니다.'
      });
    }
    req.managerEmail = managerEmail;
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 모든 메니져 라우트에 보안 차단 미들웨어 강제 마운트!
router.use(managerAuthMiddleware);

const isMaskedCredential = (value) => {
  return typeof value === 'string' && value.includes('******');
};

const resolveGateIoCredentials = async (req, store = queries) => {
  let apiKey = req.headers['x-gateio-api-key'];
  let apiSecret = req.headers['x-gateio-api-secret'];
  const managerEmail = req.managerEmail || getRequestManagerEmail(req);

  if (!apiKey || !apiSecret || isMaskedCredential(apiKey) || isMaskedCredential(apiSecret)) {
    const row = await store.get(
      "SELECT encrypted_api_key, encrypted_api_secret FROM manager_gateio_credentials WHERE LOWER(manager_email) = LOWER(?)",
      [managerEmail]
    );
    if (row) {
      apiKey = decryptText(row.encrypted_api_key);
      apiSecret = decryptText(row.encrypted_api_secret);
    }
  }

  return { apiKey, apiSecret };
};

/**
 * @route GET /api/manager/gateio-balance
 * @desc Gate.io 거래소 SUT/USDT 실제 보유 잔고 조회 (로컬 API 키 중계 지원)
 */
router.get('/gateio-balance', async (req, res) => {
  try {
    const { apiKey, apiSecret } = await resolveGateIoCredentials(req);
    const balanceRes = await getGateIoBalances(apiKey, apiSecret);
    res.json(balanceRes);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/manager/pending-users
 * @desc KYC 승인 대기 중인 회원 목록 조회
 */
router.get('/pending-users', async (req, res) => {
  try {
    const pendingUsers = await queries.all(`
      SELECT id, wallet_address, email, name, phone, country, id_card_path, joined_at
      FROM users
      WHERE status = 'PENDING_KYC'
      ORDER BY joined_at DESC
    `);
    res.json({ success: true, users: pendingUsers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/manager/users
 * @desc 전체 회원 목록 조회
 */
router.get('/users', async (req, res) => {
  try {
    const allUsers = await queries.all(`
      SELECT id, wallet_address, email, name, phone, country, status, tier, joined_at, approved_at
      FROM users
      ORDER BY joined_at DESC
    `);
    res.json({ success: true, users: allUsers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/manager/approve-user
 * @desc 본사의 수동 KYC 승인 처리 (정회원 가입 활성화)
 */
router.post('/approve-user', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ success: false, message: '지갑 주소가 누락되었습니다.' });
  }
  const cleanWallet = walletAddress.trim();

  try {
    const user = await queries.get("SELECT id, status FROM users WHERE wallet_address = ?", [cleanWallet]);
    if (!user) {
      return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
    }
    if (user.status === 'APPROVED') {
      return res.status(400).json({ success: false, message: '이미 승인된 회원입니다.' });
    }

    // 500명 개별 매니저별 정원 제한 재검사
    const userRow = await queries.get("SELECT manager_address FROM users WHERE wallet_address = ?", [cleanWallet]);
    const managerAddr = userRow ? userRow.manager_address : 'none';

    const countRow = await queries.get("SELECT COUNT(*) as total FROM users WHERE status = 'APPROVED' AND LOWER(manager_address) = LOWER(?)", [managerAddr]);
    const totalCount = countRow ? countRow.total : 0;
    if (totalCount >= 500) {
      return res.status(400).json({ success: false, message: '해당 매니저 하위의 1차 승인 제한 인원 500명이 이미 가득 찼습니다.' });
    }

    // 승인 일시와 정회원(ACTIVE) 즉시 승격
    await queries.run(`
      UPDATE users
      SET status = 'APPROVED',
          tier = 'ACTIVE',
          approved_at = datetime('now', 'localtime')
      WHERE wallet_address = ?
    `, [cleanWallet]);

    res.json({
      success: true,
      message: '회원 KYC 및 가입이 정식으로 승인되었습니다. 지금부터 즉시 정회원으로 활동이 시작됩니다.'
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/manager/reject-user
 * @desc KYC 가입 반려 처리
 */
router.post('/reject-user', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ success: false, message: '지갑 주소가 누락되었습니다.' });
  }
  const cleanWallet = walletAddress.trim();

  try {
    const user = await queries.get("SELECT id FROM users WHERE wallet_address = ?", [cleanWallet]);
    if (!user) {
      return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
    }

    await queries.run("UPDATE users SET status = 'REJECTED' WHERE wallet_address = ?", [cleanWallet]);
    res.json({ success: true, message: '회원의 가입 신청이 성공적으로 반려되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/manager/stats
 * @desc 본사 전용 수납액, 배분액 및 현황 데이터 통계
 */
router.get('/stats', async (req, res) => {
  try {
    // 1. 회원 통계
    const approvedCountRow = await queries.get("SELECT COUNT(*) as total FROM users WHERE status = 'APPROVED' AND wallet_address != '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'");
    const pendingCountRow = await queries.get("SELECT COUNT(*) as total FROM users WHERE status = 'PENDING_KYC'");
    
    // 2. 매출 및 배분 통계
    const paymentStats = await queries.get(`
      SELECT 
        SUM(amount) as totalRevenue,
        SUM(distributed_amount) as totalDistributed
      FROM payments 
      WHERE status = 'SUCCESS'
    `);

    const totalRevenue = paymentStats.totalRevenue || 0;
    const totalDistributed = paymentStats.totalDistributed || 0;
    const companyRevenue = totalRevenue - totalDistributed; // 본사 실수익

    // 3. 최근 결제 내역 10건 조회
    const recentPayments = await queries.all(`
      SELECT p.id, p.wallet_address, u.name, p.amount, p.type, p.tx_hash, p.created_at
      FROM payments p
      JOIN users u ON LOWER(p.wallet_address) = LOWER(u.wallet_address)
      WHERE p.status = 'SUCCESS'
      ORDER BY p.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      stats: {
        totalApproved: approvedCountRow ? approvedCountRow.total : 0,
        totalPending: pendingCountRow ? pendingCountRow.total : 0,
        limit: 500,
        totalRevenue,
        totalDistributed,
        companyRevenue
      },
      recentPayments
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/manager/update-user
 * @desc 메니져 전용 특정 회원의 모든 세부 정보 강제 수정 (지갑 및 초대관계 연쇄 정렬 포함)
 */
router.post('/update-user', async (req, res) => {
  const { 
    targetWalletAddress, 
    walletAddress, 
    email, 
    name, 
    phone, 
    country, 
    status, 
    tier
  } = req.body;

  if (!targetWalletAddress || !walletAddress || !email || !name || !phone || !country || !status || !tier) {
    return res.status(400).json({ success: false, message: '모든 필수 수정 필드를 올바르게 기입해 주십시오.' });
  }

  const cleanTarget = targetWalletAddress.trim();
  const cleanNewWallet = walletAddress.trim();

  try {
    // 1. 기존 유저 존재 검증
    const user = await queries.get("SELECT id FROM users WHERE wallet_address = ?", [cleanTarget]);
    if (!user) {
      return res.status(404).json({ success: false, message: '수정할 회원을 찾을 수 없습니다.' });
    }

    // 2. 만약 지갑 주소가 수정되었다면, 중복되는 다른 회원이 있는지 사전에 철저히 검증!
    if (cleanTarget !== cleanNewWallet) {
      const duplicateUser = await queries.get("SELECT id FROM users WHERE wallet_address = ?", [cleanNewWallet]);
      if (duplicateUser) {
        return res.status(400).json({ success: false, message: '변경하려는 지갑 주소는 이미 등록된 타 회원의 지갑 주소입니다.' });
      }
    }

    // 3. 지갑 주소 변경에 따른 payments 데이터 연쇄 업데이트
    if (cleanTarget !== cleanNewWallet) {
      await queries.run("UPDATE payments SET wallet_address = ? WHERE wallet_address = ?", [cleanNewWallet, cleanTarget]);
    }

    // 4. users 테이블의 회원 모든 세부 데이터 업데이트
    await queries.run(`
      UPDATE users 
      SET wallet_address = ?, 
          email = ?, 
          name = ?, 
          phone = ?, 
          country = ?, 
          status = ?, 
          tier = ? 
      WHERE wallet_address = ?
    `, [
      cleanNewWallet, 
      email.toLowerCase().trim(), 
      name, 
      phone, 
      country, 
      status, 
      tier, 
      cleanTarget
    ]);

    res.json({ success: true, message: '회원 상세 정보가 완벽하게 수정 반영되었습니다!' });

  } catch (err) {
    console.error('❌ 회원 정보 수정 API 오류:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/manager/withdrawals
 * @desc 전체 출금 대기(신청) 리스트 조회
 */
router.get('/withdrawals', async (req, res) => {
  try {
    const withdrawals = await queries.all(`
      SELECT p.id, p.wallet_address, p.amount as requested_amount, p.status, p.created_at, u.name 
      FROM payments p
      JOIN users u ON LOWER(p.wallet_address) = LOWER(u.wallet_address)
      WHERE p.type = 'WITHDRAW_REQUEST' AND p.status = 'PENDING'
      ORDER BY p.created_at DESC
    `);
    res.json({ success: true, withdrawals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/manager/withdrawals/:id/approve
 * @desc 출금 수동 승인 (완료 처리)
 */
router.post('/withdrawals/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { actualPayoutAmount } = req.body; // 메니져가 실제로 송금한 금액 (참고용 기록)
  try {
    // 1. 해당 요청 내역 확인
    const request = await queries.get("SELECT * FROM payments WHERE id = ? AND type = 'WITHDRAW_REQUEST' AND status = 'PENDING'", [id]);
    if (!request) return res.status(404).json({ success: false, message: '유효한 출금 요청을 찾을 수 없습니다.' });

    // 회원이 신청한 원본 금액 무조건 차감
    const ledgerDeduction = request.amount;

    // 2. 승인 처리 (상태 변경)
    await queries.run("UPDATE payments SET status = 'SUCCESS' WHERE id = ?", [id]);
    
    // 잔고 삭감을 위한 -amount 결제 이력 추가 (반드시 회원이 신청한 금액만큼 차감하여 정산 완료)
    await queries.run(`
      INSERT INTO payments (wallet_address, amount, type, status, tx_hash)
      VALUES (?, ?, 'MONTHLY_SUBSCRIPTION', 'SUCCESS', '0xManualManagerPayout')
    `, [request.wallet_address, -ledgerDeduction]);

    res.json({ 
      success: true, 
      message: `지급 완료! 장부에서 회원이 신청한 ${ledgerDeduction} SUT가 정상적으로 차감(소멸)되었습니다.` 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/manager/manual-adjustment
 * @desc 메니져 권한으로 특정 회원의 장부 잔액을 수동으로 차감/증액 (전화 요청 등 처리용)
 */
router.post('/manual-adjustment', async (req, res) => {
  const { targetWallet, amount, description } = req.body; // amount가 양수면 증액, 음수면 차감
  
  if (!targetWallet || amount === undefined) {
    return res.status(400).json({ success: false, message: '지갑 주소와 금액을 정확히 입력해주세요.' });
  }

  try {
    const cleanWallet = targetWallet.toLowerCase().trim();
    
    // 강제 결제 이력 삽입 (수동 조작)
    await queries.run(`
      INSERT INTO payments (wallet_address, amount, type, status, tx_hash)
      VALUES (?, ?, 'MONTHLY_SUBSCRIPTION', 'SUCCESS', ?)
    `, [cleanWallet, parseFloat(amount), description || '0xManualManagerAdjustment']);

    res.json({ success: true, message: `해당 회원의 장부에 ${amount} SUT 변동이 성공적으로 기록되었습니다.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/manager/trigger-ai-profit
 * @desc 메니져가 강제로 전체 정회원에게 AI 매매 수익(SUT)을 배분하는 시뮬레이션 엔진
 */
router.post('/trigger-ai-profit', async (req, res) => {
  const { profitPercentage } = req.body; // e.g., 0.5 for 0.5%
  
  if (!profitPercentage || isNaN(parseFloat(profitPercentage))) {
    return res.status(400).json({ success: false, message: '올바른 수익률(%) 값을 입력해 주세요.' });
  }

  const percent = parseFloat(profitPercentage) / 100;

  try {
    // 정회원 목록 가져오기
    const activeUsers = await queries.all("SELECT wallet_address FROM users WHERE status = 'APPROVED'");
    
    if (activeUsers.length === 0) {
      return res.json({ success: true, message: '현재 수익을 배분할 정회원이 없습니다.' });
    }

    let totalDistributedSut = 0;

    for (const user of activeUsers) {
      // 1. 해당 유저의 현재 SUT 원금 및 기존 누적 수익 합산 (장부 총액)
      const balanceRow = await queries.get(`
        SELECT SUM(amount) as total FROM payments 
        WHERE wallet_address = ? AND type IN ('MONTHLY_SUBSCRIPTION', 'AI_TRADING_PROFIT') AND status = 'SUCCESS'
      `, [user.wallet_address]);
      
      const currentBalance = balanceRow && balanceRow.total ? balanceRow.total : 0;
      
      // 투자금이 0 이하인 경우 패스 (기본 지원금 1000이 없는 경우 대비)
      const baseInvested = currentBalance > 0 ? currentBalance : 1000.0;
      const profitSut = baseInvested * percent;

      if (profitSut > 0) {
        // 2. 수익(SUT) 내역 장부에 인서트
        await queries.run(`
          INSERT INTO payments (wallet_address, amount, type, status, tx_hash)
          VALUES (?, ?, 'AI_TRADING_PROFIT', 'SUCCESS', ?)
        `, [user.wallet_address, profitSut, `0xAITradingProfit_${Date.now()}`]);
        totalDistributedSut += profitSut;
      }
    }

    // 🌟 [Gate.io API 실거래 주문 매칭 연동]
    // AI 수익 분배(이자 적립) 시, 매니저 거래소 계정에서 실제로 SUT 매매가 이루어지도록 0.1 SUT 소액 매도 주문을 퀵 격발합니다.
    let orderResultMsg = '';
    try {
      const { apiKey, apiSecret } = await resolveGateIoCredentials(req);
      const balanceCheck = await getGateIoBalances(apiKey, apiSecret);
      if (balanceCheck.success && balanceCheck.balances.SUT >= 0.1) {
        const mockPrice = 0.19; 
        console.log(`[CEX REAL ORDER] Placing real sell order on Gate.io. SUT Price: $${mockPrice}`);
        
        // Gate.io API로 실제 SUT 매도 주문 전송
        const orderRes = await createGateIoOrder(apiKey, apiSecret, 'sell', '0.1', mockPrice);
        if (orderRes.success) {
          orderResultMsg = `\n[Gate.io 실거래 연동] 실제 0.1 SUT 매도 주문이 거래소에 접수되었습니다. (주문 ID: ${orderRes.data.id})`;
          console.log("Gate.io 주문 생성 성공:", orderRes.data);
        } else {
          orderResultMsg = `\n[Gate.io 실거래 에러] 주문 전송 실패: ${orderRes.message}`;
        }
      } else if (balanceCheck.code === 'KEY_NOT_CONFIGURED') {
        orderResultMsg = `\n[Gate.io 실거래 미가동] API Key가 설정되지 않아 가상 장부 정산만 수행되었습니다.`;
      } else {
        orderResultMsg = `\n[Gate.io 실거래 미가동] 거래소 SUT 가용 잔고 부족 (0.1 SUT 미만)`;
      }
    } catch (orderErr) {
      console.error("Gate.io 주문 연동 오류:", orderErr.message);
      orderResultMsg = `\n[Gate.io 연동 오류] ${orderErr.message}`;
    }

    res.json({ 
      success: true, 
      message: `성공! 전체 ${activeUsers.length}명의 정회원에게 총 ${totalDistributedSut.toFixed(2)} SUT의 AI 트레이딩 수익이 분배되었습니다.${orderResultMsg}` 
    });
  } catch (err) {
    console.error("AI Profit 분배 오류:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/manager/ai-settings
 * @desc AI 그리드 봇 설정 및 API 키 등록 상태 불러오기
 */
router.get('/ai-settings', async (req, res) => {
  try {
    const managerEmail = req.managerEmail;
    const row = await queries.get(
      "SELECT * FROM manager_ai_settings WHERE LOWER(manager_email) = LOWER(?)",
      [managerEmail]
    );
    const credentials = await queries.get(
      "SELECT deposit_address FROM manager_gateio_credentials WHERE LOWER(manager_email) = LOWER(?)",
      [managerEmail]
    );
    const config = {
      ai_grid_status: 'OFF',
      ai_grid_lower: '0.15',
      ai_grid_upper: '0.30',
      ai_grid_count: '10',
      ai_grid_frequency: '5',
      hasApiKey: !!credentials,
      hasApiSecret: !!credentials,
      hasDepositAddress: !!(credentials && credentials.deposit_address)
    };

    if (row) {
      config.ai_grid_status = row.ai_grid_status;
      config.ai_grid_lower = row.ai_grid_lower;
      config.ai_grid_upper = row.ai_grid_upper;
      config.ai_grid_count = row.ai_grid_count;
      config.ai_grid_frequency = row.ai_grid_frequency;
    }
    
    res.json({ success: true, settings: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/manager/ai-settings
 * @desc AI 그리드 봇 설정 저장하기
 */
router.post('/ai-settings', async (req, res) => {
  const { status, lower, upper, count, frequency } = req.body;
  try {
    const managerEmail = req.managerEmail;
    const current = await queries.get(
      "SELECT * FROM manager_ai_settings WHERE LOWER(manager_email) = LOWER(?)",
      [managerEmail]
    );
    const next = {
      status: status || (current ? current.ai_grid_status : 'OFF'),
      lower: lower || (current ? current.ai_grid_lower : '0.15'),
      upper: upper || (current ? current.ai_grid_upper : '0.30'),
      count: count || (current ? current.ai_grid_count : '10'),
      frequency: frequency || (current ? current.ai_grid_frequency : '5')
    };

    await queries.run(`
      INSERT INTO manager_ai_settings
        (manager_email, ai_grid_status, ai_grid_lower, ai_grid_upper, ai_grid_count, ai_grid_frequency, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(manager_email) DO UPDATE SET
        ai_grid_status = excluded.ai_grid_status,
        ai_grid_lower = excluded.ai_grid_lower,
        ai_grid_upper = excluded.ai_grid_upper,
        ai_grid_count = excluded.ai_grid_count,
        ai_grid_frequency = excluded.ai_grid_frequency,
        updated_at = datetime('now')
    `, [managerEmail, next.status, next.lower, next.upper, next.count, next.frequency]);

    if (next.status !== 'ON') {
      await queries.run("DELETE FROM manager_gateio_credentials WHERE LOWER(manager_email) = LOWER(?)", [managerEmail]);
    }
    
    res.json({ success: true, message: 'AI 그리드 봇 설정이 성공적으로 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/manager/save-gateio-keys
 * @desc 24시간 오토 봇 가동을 위해 Gate.io API 키 및 입금 주소를 서버 DB에 암호화/저장
 */
router.post('/save-gateio-keys', async (req, res) => {
  const { apiKey, apiSecret, depositAddress } = req.body;
  try {
    if (isMaskedCredential(apiKey) || isMaskedCredential(apiSecret)) {
      return res.status(400).json({
        success: false,
        message: '마스킹된 Gate.io 키는 저장할 수 없습니다. 실제 API Key와 Secret 전체를 다시 입력해 주세요.'
      });
    }
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ success: false, message: 'Gate.io API Key와 Secret은 필수입니다.' });
    }

    await queries.run(`
      INSERT INTO manager_gateio_credentials
        (manager_email, encrypted_api_key, encrypted_api_secret, deposit_address, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(manager_email) DO UPDATE SET
        encrypted_api_key = excluded.encrypted_api_key,
        encrypted_api_secret = excluded.encrypted_api_secret,
        deposit_address = excluded.deposit_address,
        updated_at = datetime('now')
    `, [
      req.managerEmail,
      encryptText(apiKey.trim()),
      encryptText(apiSecret.trim()),
      depositAddress ? depositAddress.trim() : ''
    ]);
    
    res.json({ success: true, message: 'Gate.io API 키 및 주소가 서버 DB에 안전하게 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/manager/clear-gateio-keys
 * @desc 서버 DB에서 Gate.io API 키 및 주소 삭제
 */
router.post('/clear-gateio-keys', async (req, res) => {
  try {
    await queries.run("DELETE FROM manager_gateio_credentials WHERE LOWER(manager_email) = LOWER(?)", [req.managerEmail]);
    res.json({ success: true, message: '서버 DB에서 Gate.io API 키가 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/manager/gateio-order
 * @desc Gate.io 거래소 SUT 지정가 매수/매도 주문 전송
 */
router.post('/gateio-order', async (req, res) => {
  const { side, amount, price } = req.body;

  if (!side || !amount || !price) {
    return res.status(400).json({ success: false, message: '주문 방향(side), 수량(amount), 가격(price)은 필수 입력 사항입니다.' });
  }

  try {
    const { apiKey, apiSecret } = await resolveGateIoCredentials(req);
    const orderRes = await createGateIoOrder(apiKey, apiSecret, side, amount, price);
    if (orderRes.success) {
      res.json({
        success: true,
        message: `Gate.io 거래소에 SUT ${side === 'buy' ? '매수' : '매도'} 지정가 주문이 안전하게 등록되었습니다.`,
        order: orderRes.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Gate.io 주문 전송 실패: ${orderRes.message}`
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/manager/gateio-performance
 * @desc Gate.io 거래소 SUT 매매 데이터 기반 원금 및 실시간 수익률 산출
 */
router.get('/gateio-performance', async (req, res) => {
  try {
    const { apiKey, apiSecret } = await resolveGateIoCredentials(req);

    if (!apiKey || !apiSecret) {
      return res.json({ 
        success: true, 
        isConfigured: false, 
        message: 'API 키가 설정되어 있지 않아 데모 모드로 작동합니다.' 
      });
    }

    // 1. Gate.io 잔고 조회
    const balanceRes = await getGateIoBalances(apiKey, apiSecret);
    if (!balanceRes.success) {
      return res.json({ success: false, error: balanceRes.message || '잔고 조회 실패' });
    }
    const sutBalance = balanceRes.balances.SUT || 0;

    // 2. Gate.io 체결 내역 조회
    const tradesRes = await getGateIoMyTrades(apiKey, apiSecret);
    if (!tradesRes.success) {
      return res.json({ success: false, error: tradesRes.message || '체결 내역 조회 실패' });
    }

    const trades = tradesRes.data || [];
    
    // 3. 투자 원금(매수 누적 USDT) 집계
    let totalBuyUsdt = 0;
    trades.forEach(t => {
      if (t.side === 'buy') {
        const deal = t.deal ? parseFloat(t.deal) : (parseFloat(t.price) * parseFloat(t.amount));
        totalBuyUsdt += deal;
      }
    });

    // 4. 실시간 SUT 가격 조회 (Gate.io Public API)
    let sutPrice = 0.19; // 기본 폴백가
    try {
      const tickerRes = await axios.get('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=SUT_USDT', { timeout: 3000 });
      if (tickerRes.data && tickerRes.data.length > 0) {
        sutPrice = parseFloat(tickerRes.data[0].last);
      }
    } catch (tickErr) {
      console.error("[Performance API] SUT 가격 조회 에러:", tickErr.message);
    }

    // 5. 평가 금액 및 수익률 계산
    const currentValue = sutBalance * sutPrice;
    let yieldPercent = 0;
    if (totalBuyUsdt > 0) {
      yieldPercent = ((currentValue - totalBuyUsdt) / totalBuyUsdt) * 100;
    } else {
      // 거래 이력이 없거나 원금이 0인 경우 ➡️ SUT의 24h 변동률 또는 기준가(0.15) 대비 등락률 폴백
      try {
        const tickerRes = await axios.get('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=SUT_USDT', { timeout: 3000 });
        if (tickerRes.data && tickerRes.data.length > 0 && tickerRes.data[0].change_percentage !== undefined) {
          yieldPercent = parseFloat(tickerRes.data[0].change_percentage);
        } else {
          yieldPercent = ((sutPrice - 0.15) / 0.15) * 100;
        }
      } catch (tickErr) {
        yieldPercent = ((sutPrice - 0.15) / 0.15) * 100;
      }
    }

    // 6. DB에 저장된 주소 정보 조회
    let depositAddress = '';
    const depositRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'gateio_deposit_address'");
    if (depositRow) {
      depositAddress = depositRow.value;
    }

    // 7. 최근 30개의 수익률 히스토리 조회
    let yieldHistory = [];
    try {
      const historyRows = await queries.all(`
        SELECT yield_percent 
        FROM manager_yield_history 
        ORDER BY recorded_at DESC 
        LIMIT 30
      `);
      // 오래된 것 -> 최신 순으로 배열 반전
      yieldHistory = historyRows.map(h => h.yield_percent).reverse();
    } catch (histErr) {
      console.error("[Performance API] 히스토리 조회 실패:", histErr.message);
    }

    // 만약 데이터가 아예 없다면 임의로 실시간 수익률이라도 넣어줍니다
    if (yieldHistory.length === 0) {
      yieldHistory = [yieldPercent];
    }

    res.json({
      success: true,
      isConfigured: true,
      totalBuyUsdt,
      sutBalance,
      sutPrice,
      currentValue,
      yieldPercent,
      tradesCount: trades.length,
      // 보안을 위해 마스킹된 정보 제공 (다른 로컬 기기 UI에 락 표시 방지용)
      maskedApiKey: apiKey ? `${apiKey.substring(0, 6)}******` : '',
      maskedApiSecret: apiSecret ? `${apiSecret.substring(0, 6)}******` : '',
      depositAddress: depositAddress,
      yieldHistory: yieldHistory
    });
  } catch (err) {
    console.error("[Performance API Error]:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/manager/ai-logs
 * @desc 최근 AI 오토 봇 의사결정 브리핑 로그 조회
 */
router.get('/ai-logs', async (req, res) => {
  try {
    const logs = await queries.all(`
      SELECT id, decision, reason, proposed_price, proposed_amount, created_at
      FROM manager_ai_logs
      ORDER BY created_at DESC
      LIMIT 10
    `);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.__private = {
  isMaskedCredential,
  resolveGateIoCredentials
};

module.exports = router;
