const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminRouteSource = fs.readFileSync(path.join(__dirname, 'routes', 'admin.js'), 'utf8');

assert.ok(
  adminRouteSource.includes("router.post('/run-diagnostics'"),
  'run-diagnostics route must exist'
);
assert.ok(
  adminRouteSource.includes("const result = await performSystemDiagnostics();"),
  'run-diagnostics must reuse the safe diagnostics path'
);
assert.equal(
  adminRouteSource.includes('performSystemDiagnostics(true)'),
  false,
  'run-diagnostics must not trigger heavy test mode'
);
assert.equal(
  adminRouteSource.includes('runHeavyTests'),
  false,
  'heavy diagnostics mode should be removed from the admin route'
);

console.log('systemDiagnosticsRouteSafeMode test passed');
