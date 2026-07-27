const path = require('path');

module.exports = {
  id: 'pay-admin-subscription-diag',
  name: 'Pay Admin Subscription Verification Diagnostic',
  layer: 'TASK',
  linkedTask: 'TASK-PAY-ADMIN-SUB',

  async run(ctx) {
    try {
      const dbModulePath = path.join(__dirname, '..', '..', 'backend', 'database.js');
      const { queries, initializeDatabase } = require(dbModulePath);

      await initializeDatabase();

      // 1. Check users table schema for subscription_expires_at
      const columns = await queries.all("PRAGMA table_info(users)");
      const hasSubCol = columns.some(c => c.name === 'subscription_expires_at');
      if (!hasSubCol) {
        return { status: 'ERROR', details: 'users 테이블에 subscription_expires_at 컬럼이 존재하지 않습니다.' };
      }

      // 2. Check top admin email lemaiiisk@gmail.com subscription status
      const admin = await queries.get("SELECT subscription_expires_at FROM users WHERE LOWER(email) = 'lemaiiisk@gmail.com'");
      if (!admin) {
        return { status: 'WARN', details: '최상위 관리자 계정(lemaiiisk@gmail.com)이 DB에 존재하지 않습니다.' };
      }

      if (!admin.subscription_expires_at || !admin.subscription_expires_at.startsWith('9999')) {
        return { status: 'ERROR', details: `관리자 계정 구독 만료일이 9999년이 아닙니다: ${admin.subscription_expires_at}` };
      }

      return {
        status: 'OK',
        details: 'subscription_expires_at 컬럼 및 최고 관리자 9999년 구독 상태 검증 성공'
      };
    } catch (err) {
      return { status: 'ERROR', details: `진단 중 예외 발생: ${err.message}` };
    }
  }
};
