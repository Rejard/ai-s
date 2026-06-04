const express = require('express');
const router = express.Router();
const { queries } = require('../database');
const { triggerOnChainDistribution } = require('../contractHelper');

/**
 * @desc 회원의 가입비/월정액을 청구하고 상위 2단계 추천인에게 온체인 분배를 수행하는 핵심 내부 헬퍼 함수
 */
async function processSubscriptionPayment(user, chargeAmountUsdt, paymentType) {
  const userWallet = user.wallet_address.toLowerCase();
  
  // 1. referrals 테이블에서 1차/2차 추천인 정보 조회
  const refTree = await queries.get(`
    SELECT parent_address, grandparent_address FROM referrals WHERE user_address = ?
  `, [userWallet]);

  const ref1 = refTree ? refTree.parent_address : 'none';
  const ref2 = refTree ? refTree.grandparent_address : 'none';

  console.log(`[PAYMENT PROCESS] Charging ${user.name} (${userWallet}). Type: ${paymentType}`);
  console.log(`[PAYMENT PROCESS] Referral line -> Direct: ${ref1}, Grand: ${ref2}`);

  try {
    // 2. 스마트 컨트랙트 인출 & 2단계 배분 온체인 실행 (또는 시뮬레이션)
    const result = await triggerOnChainDistribution(userWallet, ref1, ref2, chargeAmountUsdt);

    if (result.success) {
      // 3. payments 결제 내역 등록 (SUCCESS)
      await queries.run(`
        INSERT INTO payments (wallet_address, amount, type, status, tx_hash, distributed_amount)
        VALUES (?, ?, ?, 'SUCCESS', ?, ?)
      `, [userWallet, chargeAmountUsdt, paymentType, result.txHash, result.ref1Share + result.ref2Share]);

      // 4. 회원의 등급 상태를 ACTIVE(정식 활성)로 격상 및 무료체험 종료
      await queries.run(`
        UPDATE users 
        SET tier = 'ACTIVE'
        WHERE wallet_address = ?
      `, [userWallet]);

      console.log(`✔ [PAYMENT SUCCESS] Payment processed successfully. Tx: ${result.txHash}`);
      return { success: true, txHash: result.txHash, result };
    }
  } catch (err) {
    console.error(`❌ [PAYMENT FAILED] Failed to charge ${userWallet}:`, err.message);
    
    // 결제 실패 내역 등록
    await queries.run(`
      INSERT INTO payments (wallet_address, amount, type, status, tx_hash, distributed_amount)
      VALUES (?, ?, ?, 'FAILED', NULL, 0)
    `, [userWallet, chargeAmountUsdt, paymentType]);

    // 결제가 안되면 혜택 일시 정지 (EXPIRED)
    await queries.run(`
      UPDATE users SET tier = 'EXPIRED' WHERE wallet_address = ?
    `, [userWallet]);

    throw err;
  }
}

/**
 * @route GET /api/cron/check-subscriptions
 * @desc [배치 시스템] 무료 체험 10일 만료 회원 자동 가입비 청구 및 월정액 스케줄러 배치
 */
router.get('/check-subscriptions', async (req, res) => {
  try {
    // 1. 가입 승인 후 10일이 경과(trial_ends_at < now)했으나 아직 TRIAL 등급인 회원들을 추출
    const expiredTrials = await queries.all(`
      SELECT wallet_address, name, email FROM users
      WHERE status = 'APPROVED' AND tier = 'TRIAL' AND datetime(trial_ends_at) < datetime('now', 'localtime')
    `);

    console.log(`[CRON BATCH] Found ${expiredTrials.length} users with expired trials.`);
    const successList = [];
    const failedList = [];

    for (const user of expiredTrials) {
      try {
        const paymentResult = await processSubscriptionPayment(user, 100.0, 'MEMBERSHIP_FEE');
        successList.push({ name: user.name, wallet: user.wallet_address, txHash: paymentResult.txHash });
      } catch (err) {
        failedList.push({ name: user.name, wallet: user.wallet_address, error: err.message });
      }
    }

    res.json({
      success: true,
      processedCount: expiredTrials.length,
      successList,
      failedList
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/cron/trigger-charge-manually
 * @desc [테스트 격발용 API] 10일 대기 없이 특정 회원의 가입비 즉시 수납 및 2단계 온체인 분배 강제 실행!
 */
router.post('/trigger-charge-manually', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ success: false, message: '지갑 주소가 누락되었습니다.' });
  }
  const cleanWallet = walletAddress.toLowerCase().trim();

  try {
    const user = await queries.get(`
      SELECT wallet_address, name, email, tier, status FROM users WHERE wallet_address = ?
    `, [cleanWallet]);

    if (!user) {
      return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
    }

    if (user.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: 'KYC 승인이 선행되지 않은 회원입니다. 본사 어드민에서 먼저 승인해 주세요.' });
    }

    // 이미 가입비를 성공적으로 낸 이력이 있는지 검증 (중복 가입비 청구 방지)
    const existingMembershipFee = await queries.get(`
      SELECT id FROM payments WHERE wallet_address = ? AND type = 'MEMBERSHIP_FEE' AND status = 'SUCCESS'
    `, [cleanWallet]);

    let paymentType = 'MEMBERSHIP_FEE';
    let chargeAmount = 100.0;

    if (existingMembershipFee) {
      // 이미 가입비를 냈다면 매월 청구하는 월정액 요금으로 부과 처리하여 중복 테스트 지원
      paymentType = 'MONTHLY_SUBSCRIPTION';
      console.log(`[TEST TRIGGER] Membership fee already paid. Charging monthly subscription instead.`);
    }

    // 결제 프로세스 강제 기동
    const paymentResult = await processSubscriptionPayment(user, chargeAmount, paymentType);

    res.json({
      success: true,
      message: `${paymentType === 'MEMBERSHIP_FEE' ? '가입비 100 USDT' : '월정액비 100 USDT'} 강제 수납 및 2단계 균등 분배(각 25%) 온체인 격발이 완료되었습니다.`,
      txHash: paymentResult.txHash,
      distributors: paymentResult.result
    });

  } catch (err) {
    res.status(500).json({ success: false, message: `격발 실패: ${err.message}` });
  }
});

module.exports = router;
