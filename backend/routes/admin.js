const express = require('express');
const router = express.Router();
const { queries } = require('../database');

// 플랫폼 최초 마스터 관리자 (이명학 - Root Master Wallet) 지갑 주소 고정
const MASTER_ADMIN_WALLET = '0x015B8fA9aE51Dbebe7301a0A3F725Bf8811E5818';

// 남들의 어드민 데이터 불법 조회 및 제어를 원천 차단하는 철통 보안 미들웨어!
// 기존 지갑 주소 검증 대신, 본인 인증의 최종 진리인 구글 이메일 lemaiiisk@gmail.com을 기준으로 통제합니다.
const adminAuthMiddleware = (req, res, next) => {
  const adminEmail = req.headers['x-admin-email'];
  if (!adminEmail || adminEmail.toLowerCase().trim() !== 'lemaiiisk@gmail.com'.toLowerCase()) {
    return res.status(403).json({ 
      success: false, 
      message: '보안 경보: 어드민 권한이 존재하지 않습니다. 마스터 관리자 이메일(lemaiiisk@gmail.com)로 연동해 주십시오.' 
    });
  }
  next();
};

// 모든 어드민 라우트에 보안 차단 미들웨어 강제 마운트!
router.use(adminAuthMiddleware);

/**
 * @route GET /api/admin/pending-users
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
 * @route GET /api/admin/users
 * @desc 전체 회원 목록 조회
 */
router.get('/users', async (req, res) => {
  try {
    const allUsers = await queries.all(`
      SELECT id, wallet_address, email, name, phone, country, status, tier, joined_at, approved_at, trial_ends_at
      FROM users
      ORDER BY joined_at DESC
    `);
    res.json({ success: true, users: allUsers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/admin/approve-user
 * @desc 본사의 수동 KYC 승인 처리 (10일 무료 체험 및 가입 활성화)
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

    // 500명 마스터 제한 재검사
    const countRow = await queries.get("SELECT COUNT(*) as total FROM users WHERE status = 'APPROVED' AND wallet_address != '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'");
    const totalCount = countRow ? countRow.total : 0;
    if (totalCount >= 500) {
      return res.status(400).json({ success: false, message: '1차 승인 제한 인원 500명이 이미 가득 찼습니다.' });
    }

    // 승인 일시와 10일 무료 체험(TRIAL) 만료일 설정
    await queries.run(`
      UPDATE users
      SET status = 'APPROVED',
          tier = 'TRIAL',
          approved_at = datetime('now', 'localtime'),
          trial_ends_at = datetime('now', 'localtime', '+10 days')
      WHERE wallet_address = ?
    `, [cleanWallet]);

    // 🌟 가입 시뮬레이션용 가상 시드머니 1,000 USDT 자동 예치 기록 삽입 (Rejard님 특급 가상 시드 피드백)
    await queries.run(`
      INSERT OR IGNORE INTO payments (wallet_address, amount, type, status, tx_hash)
      VALUES (?, 1000.0, 'MONTHLY_SUBSCRIPTION', 'SUCCESS', '0xSimulatedWelcomeSeed')
    `, [cleanWallet]);

    res.json({
      success: true,
      message: '회원 KYC 및 가입이 정식으로 승인되었습니다. 오늘부터 10일간 무료 체험이 시작됩니다.'
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/admin/reject-user
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
 * @route GET /api/admin/stats
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
      JOIN users u ON p.wallet_address = u.wallet_address
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
 * @route POST /api/admin/update-user
 * @desc 관리자 전용 특정 회원의 모든 세부 정보 강제 수정 (지갑 및 초대관계 연쇄 정렬 포함)
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
    tier, 
    referrerAddress, 
    trialEndsAt 
  } = req.body;

  if (!targetWalletAddress || !walletAddress || !email || !name || !phone || !country || !status || !tier || !referrerAddress) {
    return res.status(400).json({ success: false, message: '모든 필수 수정 필드를 올바르게 기입해 주십시오.' });
  }

  const cleanTarget = targetWalletAddress.trim();
  const cleanNewWallet = walletAddress.trim();
  const cleanReferrer = referrerAddress.trim();

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

    // 3. 지갑 주소 변경에 따른 추천인 트리(referrals) 및 가맹 데이터 연쇄 업데이트 (강력한 무결성 수호 트랜잭션 수동 구현)
    if (cleanTarget !== cleanNewWallet) {
      // 3-1. referrals 테이블 관계 갱신
      await queries.run("UPDATE referrals SET user_address = ? WHERE user_address = ?", [cleanNewWallet, cleanTarget]);
      await queries.run("UPDATE referrals SET parent_address = ? WHERE parent_address = ?", [cleanNewWallet, cleanTarget]);
      await queries.run("UPDATE referrals SET grandparent_address = ? WHERE grandparent_address = ?", [cleanNewWallet, cleanTarget]);
      
      // 3-2. payments 테이블 지갑 연계 갱신
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
          tier = ?, 
          referrer_address = ?, 
          trial_ends_at = ? 
      WHERE wallet_address = ?
    `, [
      cleanNewWallet, 
      email.toLowerCase().trim(), 
      name, 
      phone, 
      country, 
      status, 
      tier, 
      cleanReferrer, 
      trialEndsAt || null, 
      cleanTarget
    ]);

    // 5. 추천 구조 변경(부모 변경)에 따른 트리 2단계 재연쇄 계산
    const newParent = await queries.get("SELECT parent_address FROM referrals WHERE user_address = ?", [cleanReferrer]);
    const newGrandparent = newParent ? newParent.parent_address : 'none';
    
    await queries.run(`
      UPDATE referrals 
      SET parent_address = ?, 
          grandparent_address = ? 
      WHERE user_address = ?
    `, [cleanReferrer, newGrandparent, cleanNewWallet]);

    res.json({ success: true, message: '회원 상세 정보 및 온체인 파트너 트리가 완벽하게 수정 반영되었습니다!' });

  } catch (err) {
    console.error('❌ 회원 정보 수정 API 오류:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
