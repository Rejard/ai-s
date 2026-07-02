const fs = require('fs');
const path = require('path');
const { queries } = require('./database');

const tempUploadDir = path.resolve(__dirname, '../temp_uploads');

if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}


async function cleanExpiredPendingKycUsers() {
  try {

    const expiredUsers = await queries.all(`
      SELECT id, wallet_address, id_card_path, joined_at
      FROM users
      WHERE status = 'PENDING_KYC'
        AND joined_at < datetime('now', '-24 hours')
    `);

    if (expiredUsers.length === 0) {
      await queries.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('scheduler_kyc_cleanup_last_run', ?)", [Date.now().toString()]);
      await queries.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('scheduler_kyc_cleanup_last_deleted', '0')");
      const kycRunRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'scheduler_kyc_cleanup_run_count'");
      const kycRunPrev = kycRunRow ? parseInt(kycRunRow.value, 10) || 0 : 0;
      await queries.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('scheduler_kyc_cleanup_run_count', ?)", [(kycRunPrev + 1).toString()]);
      return;
    }

    console.log(`[KYC AUTO-CLEANUP] Found ${expiredUsers.length} expired pending KYC requests (over 24 hours). Starting deletion...`);

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
        const auditMsg = `[${new Date().toISOString()}] System: Automatically canceled and deleted pending KYC registration request (exceeded 24h limit) for User ID: ${user.id} (${user.wallet_address})\n`;
        fs.appendFileSync(auditLogPath, auditMsg, 'utf8');
      } catch (auditErr) {
        console.error(`[KYC AUTO-CLEANUP] Audit log failed:`, auditErr.message);
      }
    }
    await queries.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('scheduler_kyc_cleanup_last_run', ?)", [Date.now().toString()]);
    await queries.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('scheduler_kyc_cleanup_last_deleted', ?)", [expiredUsers.length.toString()]);
    const kycRunRow2 = await queries.get("SELECT value FROM platform_settings WHERE key = 'scheduler_kyc_cleanup_run_count'");
    const kycRunPrev2 = kycRunRow2 ? parseInt(kycRunRow2.value, 10) || 0 : 0;
    await queries.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('scheduler_kyc_cleanup_run_count', ?)", [(kycRunPrev2 + 1).toString()]);
    const totalDelRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'scheduler_kyc_cleanup_total_deleted'");
    const totalDelPrev = totalDelRow ? parseInt(totalDelRow.value, 10) || 0 : 0;
    await queries.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('scheduler_kyc_cleanup_total_deleted', ?)", [(totalDelPrev + expiredUsers.length).toString()]);
  } catch (err) {
    console.error('❌ [KYC AUTO-CLEANUP ERROR]:', err.message);
  }
}


function initIdCardCleanupScheduler() {

  cleanExpiredPendingKycUsers();
  

  setInterval(() => {
    cleanExpiredPendingKycUsers();
  }, 3600000);
}

module.exports = {
  tempUploadDir,
  cleanExpiredPendingKycUsers,
  initIdCardCleanupScheduler
};
