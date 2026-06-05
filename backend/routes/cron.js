const express = require('express');
const router = express.Router();
const { queries } = require('../database');
const { triggerOnChainDistribution } = require('../contractHelper');

/**
 * @desc Core internal helper function that charges the member's Registration Fee/monthly fee and performs on-chain Distribution to the top 2-tier referrers
 */
async function processSubscriptionPayment(user, chargeAmountUsdt, paymentType) {
  const userWallet = user.wallet_address.toLowerCase();
  
  const ref1 = 'none';
  const ref2 = 'none';

  console.log(`[PAYMENT PROCESS] Charging ${user.name} (${userWallet}). Type: ${paymentType}`);

  try {
    // 2. Smart contract Withdrawal & 2-tier Distribution on-chain execution (or simulation)
    const result = await triggerOnChainDistribution(userWallet, ref1, ref2, chargeAmountUsdt);

    if (result.success) {
      // 3. Register payments transaction history (SUCCESS)
      await queries.run(`
        INSERT INTO payments (wallet_address, amount, type, status, tx_hash, distributed_amount)
        VALUES (?, ?, ?, 'SUCCESS', ?, ?)
      `, [userWallet, chargeAmountUsdt, paymentType, result.txHash, result.ref1Share + result.ref2Share]);

      // 4. Upgrade member's status to ACTIVE (officially active) and end free trial
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
    
    // Register payment failure history
    await queries.run(`
      INSERT INTO payments (wallet_address, amount, type, status, tx_hash, distributed_amount)
      VALUES (?, ?, ?, 'FAILED', NULL, 0)
    `, [userWallet, chargeAmountUsdt, paymentType]);

    // If payment fails, benefits are temporarily suspended (EXPIRED)
    await queries.run(`
      UPDATE users SET tier = 'EXPIRED' WHERE wallet_address = ?
    `, [userWallet]);

    throw err;
  }
}

/**
 * @route GET /api/cron/check-subscriptions
 * @desc [Batch System] Automatic Registration Fee billing and monthly fee scheduler batch for members whose 10-day free trial has expired
 */
router.get('/check-subscriptions', async (req, res) => {
  try {
    // 1. Extract members who are still in TRIAL status even though 10 days have passed since registration approval (trial_ends_at < now)
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
 * @desc [Test Trigger API] Immediate receipt of a specific member's Registration Fee and forced execution of 2-tier on-chain Distribution without a 10-day waiting period!
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

    // Verify if registration fee has been successfully paid (prevent duplicate fee billing)
    const existingMembershipFee = await queries.get(`
      SELECT id FROM payments WHERE wallet_address = ? AND type = 'MEMBERSHIP_FEE' AND status = 'SUCCESS'
    `, [cleanWallet]);

    let paymentType = 'MEMBERSHIP_FEE';
    let chargeAmount = 100.0;

    if (existingMembershipFee) {
      // If registration fee has already been paid, process as a monthly subscription fee to support duplicate testing
      paymentType = 'MONTHLY_SUBSCRIPTION';
      console.log(`[TEST TRIGGER] Membership fee already paid. Charging monthly subscription instead.`);
    }

    // Force payment process initiation
    const paymentResult = await processSubscriptionPayment(user, chargeAmount, paymentType);

    res.json({
      success: true,
      message: `${paymentType === 'MEMBERSHIP_FEE' ? '가입비 100 SUT' : '월정액비 100 SUT'} 강제 수납 및 온체인 격발이 완료되었습니다.`,
      txHash: paymentResult.txHash,
      distributors: paymentResult.result
    });

  } catch (err) {
    res.status(500).json({ success: false, message: `격발 실패: ${err.message}` });
  }
});

module.exports = router;
