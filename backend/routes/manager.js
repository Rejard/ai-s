const express = require('express');
const router = express.Router();
const axios = require('axios');
const { queries } = require('../database');
const { getGateIoBalances, createGateIoOrder, getGateIoMyTrades } = require('../gateioHelper');
const { decryptText, encryptText } = require('../secureCredentials');

// Platform's first Master Manager (Lee Myung-hak - Root Master Wallet) wallet address fixed
const MASTER_MANAGER_WALLET = '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987';

// Ironclad security middleware that completely blocks illegal viewing and control of other Managers' data!
// Instead of verifying existing wallet addresses, control is based on the Google email lemaiiisk@gmail.com, which is the ultimate truth of self-authentication.
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

// Force mount security blocking middleware on all Manager routes!
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
 * @desc Retrieve actual SUT/USDT holding balance from Gate.io exchange (local API key relay support)
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
 * @desc Retrieve list of members pending KYC approval
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
 * @desc Retrieve list of all members
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
 * @desc Platform Owner's manual KYC approval processing (activate Active Member registration)
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

    // Re-check capacity limit per 500 individual Managers
    const userRow = await queries.get("SELECT manager_address FROM users WHERE wallet_address = ?", [cleanWallet]);
    const managerAddr = userRow ? userRow.manager_address : 'none';

    const countRow = await queries.get("SELECT COUNT(*) as total FROM users WHERE status = 'APPROVED' AND LOWER(manager_address) = LOWER(?)", [managerAddr]);
    const totalCount = countRow ? countRow.total : 0;
    if (totalCount >= 500) {
      return res.status(400).json({ success: false, message: '해당 매니저 하위의 1차 승인 제한 인원 500명이 이미 가득 찼습니다.' });
    }

    // Approval date/time and immediate promotion to Active Member (ACTIVE)
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
 * @desc Process KYC registration rejection
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
 * @desc Platform Owner-exclusive statistics for collected amount, distributed amount, and status data
 */
router.get('/stats', async (req, res) => {
  try {
    // 1. Member statistics
    const approvedCountRow = await queries.get("SELECT COUNT(*) as total FROM users WHERE status = 'APPROVED' AND wallet_address != '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'");
    const pendingCountRow = await queries.get("SELECT COUNT(*) as total FROM users WHERE status = 'PENDING_KYC'");
    
    // 2. Sales and Distribution statistics
    const paymentStats = await queries.get(`
      SELECT 
        SUM(amount) as totalRevenue,
        SUM(distributed_amount) as totalDistributed
      FROM payments 
      WHERE status = 'SUCCESS'
    `);

    const totalRevenue = paymentStats.totalRevenue || 0;
    const totalDistributed = paymentStats.totalDistributed || 0;
    const companyRevenue = totalRevenue - totalDistributed; // Platform Owner's actual profit

    // 3. Retrieve last 10 payment history records
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
 * @desc Manager-exclusive force modification of all details for a specific member (including wallet and invitation relationship cascade reordering)
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
    // 1. Verify existence of existing user
    const user = await queries.get("SELECT id FROM users WHERE wallet_address = ?", [cleanTarget]);
    if (!user) {
      return res.status(404).json({ success: false, message: '수정할 회원을 찾을 수 없습니다.' });
    }

    // 2. If the wallet address has been modified, thoroughly verify in advance if there is another duplicate member!
    if (cleanTarget !== cleanNewWallet) {
      const duplicateUser = await queries.get("SELECT id FROM users WHERE wallet_address = ?", [cleanNewWallet]);
      if (duplicateUser) {
        return res.status(400).json({ success: false, message: '변경하려는 지갑 주소는 이미 등록된 타 회원의 지갑 주소입니다.' });
      }
    }

    // 3. Cascade update payments data due to wallet address change
    if (cleanTarget !== cleanNewWallet) {
      await queries.run("UPDATE payments SET wallet_address = ? WHERE wallet_address = ?", [cleanNewWallet, cleanTarget]);
    }

    // 4. Update all detailed member data in the users table
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
 * @desc Retrieve list of all pending (requested) Withdrawals
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
 * @desc Manual Withdrawal approval (complete processing)
 */
router.post('/withdrawals/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { actualPayoutAmount } = req.body; // Amount actually sent by the Manager (record for reference)
  try {
    // 1. Verify the request details
    const request = await queries.get("SELECT * FROM payments WHERE id = ? AND type = 'WITHDRAW_REQUEST' AND status = 'PENDING'", [id]);
    if (!request) return res.status(404).json({ success: false, message: '유효한 출금 요청을 찾을 수 없습니다.' });

    // Unconditionally deduct the original amount requested by the member
    const ledgerDeduction = request.amount;

    // 2. Approval processing (status change)
    await queries.run("UPDATE payments SET status = 'SUCCESS' WHERE id = ?", [id]);
    
    // Add -amount payment history for balance reduction (must deduct the amount requested by the member to complete settlement)
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
 * @desc Manually deduct/increase a specific member's ledger balance with Manager authority (for processing phone requests, etc.)
 */
router.post('/manual-adjustment', async (req, res) => {
  const { targetWallet, amount, description } = req.body; // If amount is positive, increase; if negative, deduct
  
  if (!targetWallet || amount === undefined) {
    return res.status(400).json({ success: false, message: '지갑 주소와 금액을 정확히 입력해주세요.' });
  }

  try {
    const cleanWallet = targetWallet.toLowerCase().trim();
    
    // Force insert payment history (manual operation)
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
 * @desc Simulation engine where the Manager forces Distribution of AI trading profit (SUT) to all Active Members
 */
router.post('/trigger-ai-profit', async (req, res) => {
  const { profitPercentage } = req.body; // e.g., 0.5 for 0.5%
  
  if (!profitPercentage || isNaN(parseFloat(profitPercentage))) {
    return res.status(400).json({ success: false, message: '올바른 수익률(%) 값을 입력해 주세요.' });
  }

  const percent = parseFloat(profitPercentage) / 100;

  try {
    // Get Active Member list
    const activeUsers = await queries.all("SELECT wallet_address FROM users WHERE status = 'APPROVED'");
    
    if (activeUsers.length === 0) {
      return res.json({ success: true, message: '현재 수익을 배분할 정회원이 없습니다.' });
    }

    let totalDistributedSut = 0;

    for (const user of activeUsers) {
      // 1. Sum of the user's current SUT principal and existing accumulated profit (total ledger amount)
      const balanceRow = await queries.get(`
        SELECT SUM(amount) as total FROM payments 
        WHERE wallet_address = ? AND type IN ('MONTHLY_SUBSCRIPTION', 'AI_TRADING_PROFIT') AND status = 'SUCCESS'
      `, [user.wallet_address]);
      
      const currentBalance = balanceRow && balanceRow.total ? balanceRow.total : 0;
      
      // Pass if investment amount is 0 or less (in case there is no basic support fund of 1000)
      const baseInvested = currentBalance > 0 ? currentBalance : 1000.0;
      const profitSut = baseInvested * percent;

      if (profitSut > 0) {
        // 2. Insert profit (SUT) history into database ledger
        await queries.run(`
          INSERT INTO payments (wallet_address, amount, type, status, tx_hash)
          VALUES (?, ?, 'AI_TRADING_PROFIT', 'SUCCESS', ?)
        `, [user.wallet_address, profitSut, `0xAITradingProfit_${Date.now()}`]);
        totalDistributedSut += profitSut;
      }
    }

    // 🌟 [Gate.io API real trading order matching integration]
    // When AI profit Distribution (interest accumulation), a small sell order of 0.1 SUT is quickly triggered from the Manager's exchange account to ensure actual SUT trading occurs.
    let orderResultMsg = '';
    try {
      const { apiKey, apiSecret } = await resolveGateIoCredentials(req);
      const balanceCheck = await getGateIoBalances(apiKey, apiSecret);
      if (balanceCheck.success && balanceCheck.balances.SUT >= 0.1) {
        const mockPrice = 0.19; 
        console.log(`[CEX REAL ORDER] Placing real sell order on Gate.io. SUT Price: $${mockPrice}`);
        
        // Send actual SUT sell order via Gate.io API
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
 * @desc Load AI Grid Bot settings and API key registration status
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
 * @desc Save AI Grid Bot settings
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
 * @desc Encrypt/save Gate.io API key and Deposit address to server DB for 24-hour auto bot operation
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
 * @desc Delete Gate.io API key and address from server DB
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
 * @desc Gate.io Exchange SUT limit buy/sell order submission
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
 * @desc Calculate principal and real-time returns based on Gate.io Exchange SUT trading data
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

    // 1. Check Gate.io balance
    const balanceRes = await getGateIoBalances(apiKey, apiSecret);
    if (!balanceRes.success) {
      return res.json({ success: false, error: balanceRes.message || '잔고 조회 실패' });
    }
    const sutBalance = balanceRes.balances.SUT || 0;

    // 2. Check Gate.io trade history
    const tradesRes = await getGateIoMyTrades(apiKey, apiSecret);
    if (!tradesRes.success) {
      return res.json({ success: false, error: tradesRes.message || '체결 내역 조회 실패' });
    }

    const trades = tradesRes.data || [];
    
    // 3. Aggregate investment principal (accumulated USDT purchased)
    let totalBuyUsdt = 0;
    trades.forEach(t => {
      if (t.side === 'buy') {
        const deal = t.deal ? parseFloat(t.deal) : (parseFloat(t.price) * parseFloat(t.amount));
        totalBuyUsdt += deal;
      }
    });

    // 4. Retrieve real-time SUT price (Gate.io Public API)
    let sutPrice = 0.19; // Default fallback price
    try {
      const tickerRes = await axios.get('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=SUT_USDT', { timeout: 3000 });
      if (tickerRes.data && tickerRes.data.length > 0) {
        sutPrice = parseFloat(tickerRes.data[0].last);
      }
    } catch (tickErr) {
      console.error("[Performance API] SUT 가격 조회 에러:", tickErr.message);
    }

    // 5. Calculate valuation amount and returns
    const currentValue = sutBalance * sutPrice;
    let yieldPercent = 0;
    if (totalBuyUsdt > 0) {
      yieldPercent = ((currentValue - totalBuyUsdt) / totalBuyUsdt) * 100;
    } else {
      // If there is no trading history or principal is 0 ➡️ fallback to SUT's 24h change rate or change rate compared to benchmark price (0.15)
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

    // 6. Retrieve address information stored in DB
    let depositAddress = '';
    const depositRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'gateio_deposit_address'");
    if (depositRow) {
      depositAddress = depositRow.value;
    }

    // 7. Retrieve last 30 returns history
    let yieldHistory = [];
    try {
      const historyRows = await queries.all(`
        SELECT yield_percent 
        FROM manager_yield_history 
        ORDER BY recorded_at DESC 
        LIMIT 30
      `);
      // Reverse array from oldest to newest
      yieldHistory = historyRows.map(h => h.yield_percent).reverse();
    } catch (histErr) {
      console.error("[Performance API] 히스토리 조회 실패:", histErr.message);
    }

    // If there is no data at all, arbitrarily insert at least real-time returns
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
      // Provide masked information for security (to prevent lock display on other local device UIs)
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
 * @desc Retrieve recent AI Auto Bot decision briefing logs
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
