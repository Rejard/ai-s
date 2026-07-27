const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'Pay Admin & Unified Layout Verification',
  description: 'Verifies that purchase admin banner is present and dual mobile/PC layout branching is removed.',
  async run() {
    const dashboardPath = path.join(__dirname, '../frontend/src/pages/user_dashboard.jsx');
    const payAdminPath = path.join(__dirname, '../frontend/src/pages/PayAdminDashboard.jsx');
    const appPath = path.join(__dirname, '../frontend/src/App.jsx');

    if (!fs.existsSync(dashboardPath)) {
      return { ok: false, error: 'user_dashboard.jsx missing' };
    }

    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

    // 1. Check purchase admin route navigation
    if (!dashboardContent.includes("navigate('/pay-admin')")) {
      return { ok: false, error: 'Purchase admin navigation button missing in user_dashboard.jsx' };
    }

    // 2. Check removal of dual layout branching
    if (dashboardContent.includes('if (window.ethereum && isMobileDevice && !isFullModeOverride)')) {
      return { ok: false, error: 'Dual layout branching still present in user_dashboard.jsx' };
    }

    // 3. Check PayAdminDashboard back button returns to general user page ('/')
    const payAdminContent = fs.readFileSync(payAdminPath, 'utf8');
    if (!payAdminContent.includes("onClick={() => navigate('/')}") || !payAdminContent.includes('일반 사용자 페이지')) {
      return { ok: false, error: 'PayAdminDashboard back button does not return to General User Page' };
    }

    // 4. Check App.jsx routes
    const appContent = fs.readFileSync(appPath, 'utf8');
    if (!appContent.includes("path=\"/pay-admin\"")) {
      return { ok: false, error: 'pay-admin route missing in App.jsx' };
    }

    return { ok: true, message: 'All checks passed: Unified mobile layout, Pay Admin route, and General User Page return button correctly configured.' };
  }
};
