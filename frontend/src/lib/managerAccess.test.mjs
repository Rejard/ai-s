import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');
const mobileDashboardSource = await readFile(new URL('../pages/user_mobile_dashboard.jsx', import.meta.url), 'utf8');
const pcDashboardSource = await readFile(new URL('../pages/user_pc_dashboard.jsx', import.meta.url), 'utf8');
const managerDashboardSource = await readFile(new URL('../pages/manager_mobile_dashboard.jsx', import.meta.url), 'utf8');
const adminCouncilTabSource = await readFile(new URL('../pages/admin/AdminCouncilTab.jsx', import.meta.url), 'utf8');
const authRouteSource = await readFile(new URL('../../../backend/routes/auth.js', import.meta.url), 'utf8');
const investmentRouteSource = await readFile(new URL('../../../backend/routes/investment.js', import.meta.url), 'utf8');

assert.equal(
  appSource.includes('isManagerViewer ? ('),
  true,
  'manager route must allow promoted managers'
);
assert.equal(
  appSource.includes('setInterval(refreshAccountRole, 10000)'),
  true,
  'account role must refresh without requiring a new login'
);

for (const [name, source] of [
  ['mobile dashboard', mobileDashboardSource],
  ['PC dashboard', pcDashboardSource],
]) {
  assert.equal(source.includes('const canAccessManager = isManagerAccount('), true, `${name} must use manager role`);
  assert.equal(source.includes('{canAccessManager && ('), true, `${name} must show the manager shortcut`);
  assert.equal(source.includes('/investment/council-stats'), false, `${name} must not request admin-only council stats`);
}

assert.equal(
  managerDashboardSource.includes('/investment/council-stats'),
  false,
  'manager dashboard must not request admin-only council stats'
);
assert.equal(
  appSource.includes("path=\"/council\""),
  false,
  'general member routes must not expose the council page'
);
assert.equal(
  adminCouncilTabSource.includes('/investment/council-stats'),
  false,
  'admin council tab must not call the investment council endpoint'
);
assert.match(
  investmentRouteSource,
  /router\.get\('\/council-stats',\s*requireAuthenticatedSession,\s*requireAdminCouncilAccess,/,
  'investment council stats must require authenticated admin access'
);

assert.equal(
  authRouteSource.match(/manager_address, is_manager/g)?.length,
  2,
  'both authentication status endpoints must select is_manager'
);
assert.equal(
  authRouteSource.match(/isManager: user\.is_manager === 1/g)?.length,
  2,
  'both authentication status endpoints must return isManager'
);

console.log('ok - promoted manager dashboard access');
