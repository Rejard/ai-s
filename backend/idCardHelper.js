const fs = require('fs');
const path = require('path');
const { queries } = require('./database');

const tempUploadDir = path.resolve(__dirname, '../temp_uploads');

if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

/**
 * 48시간 이상 승인(APPROVED)되지 않은 PENDING_KYC 회원의 가입 신청을 취소하고 신분증 파일을 자동 정리합니다.
 */
async function cleanExpiredPendingKycUsers() {
  try {
    // 48시간이 경과한 PENDING_KYC 회원들을 조회합니다.
    // SQLite의 joined_at은 로컬 시간 또는 UTC 타임스탬프를 보므로, 두 조건을 안전하게 포함시킵니다.
    const expiredUsers = await queries.all(`
      SELECT id, wallet_address, id_card_path, joined_at
      FROM users
      WHERE status = 'PENDING_KYC'
        AND (
          joined_at < datetime('now', '-48 hours')
          OR joined_at < datetime('now', 'localtime', '-48 hours')
        )
    `);

    if (expiredUsers.length === 0) {
      return;
    }

    console.log(`[KYC AUTO-CLEANUP] Found ${expiredUsers.length} expired pending KYC requests (over 48 hours). Starting deletion...`);

    for (const user of expiredUsers) {
      if (user.id_card_path) {
        const fileName = path.basename(user.id_card_path);
        const fullPath = path.join(tempUploadDir, fileName);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
            console.log(`[KYC AUTO-CLEANUP] Successfully unlinked expired ID card file: ${fullPath}`);
          } catch (fileErr) {
            console.error(`[KYC AUTO-CLEANUP] Failed to delete file at ${fullPath}:`, fileErr.message);
          }
        }
      }

      await queries.run("DELETE FROM users WHERE id = ?", [user.id]);
      console.log(`[KYC AUTO-CLEANUP] Canceled registration request and deleted user DB record: ${user.wallet_address}`);

      try {
        const auditLogPath = path.resolve(__dirname, '../kyc_audit.log');
        const auditMsg = `[${new Date().toISOString()}] System: Automatically canceled and deleted pending KYC registration request (exceeded 48h limit) for User ID: ${user.id} (${user.wallet_address})\n`;
        fs.appendFileSync(auditLogPath, auditMsg, 'utf8');
      } catch (auditErr) {
        console.error(`[KYC AUTO-CLEANUP] Audit log failed:`, auditErr.message);
      }
    }
  } catch (err) {
    console.error('❌ [KYC AUTO-CLEANUP ERROR]:', err.message);
  }
}

/**
 * 48시간 만료 체크 스케줄러를 가동합니다. (6시간 주기)
 */
function initIdCardCleanupScheduler() {
  // 백엔드 실행 시 즉시 1회 작동
  cleanExpiredPendingKycUsers();
  
  // 6시간마다 주기적으로 실행 (6 * 60 * 60 * 1000)
  setInterval(() => {
    cleanExpiredPendingKycUsers();
  }, 21600000);
}

module.exports = {
  tempUploadDir,
  cleanExpiredPendingKycUsers,
  initIdCardCleanupScheduler
};
