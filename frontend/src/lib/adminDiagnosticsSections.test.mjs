import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const pageFile of ['../pages/admin_dashboard.jsx']) {
  const source = await readFile(new URL(pageFile, import.meta.url), 'utf8');

  assert.ok(source.includes('ADMIN_DIAGNOSTIC_SECTIONS'));
  assert.ok(source.includes('TOTAL_DIAGNOSTIC_NODE_COUNT'));
  assert.ok(!source.includes('/35? ??'));
  assert.ok(!source.includes('slice(19, 30)'));
  assert.ok(!source.includes('slice(30, 35)'));
}

console.log('ok - admin diagnostics dashboard uses shared section metadata');
