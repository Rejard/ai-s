import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pageFiles = [
  '../pages/ConsentPage.jsx',
  '../pages/PcConsentPage.jsx',
  '../pages/WaitingPage.jsx',
  '../pages/PcWaitingPage.jsx',
];

for (const pageFile of pageFiles) {
  const source = await readFile(new URL(pageFile, import.meta.url), 'utf8');

  assert.equal(
    source.includes("navigate('/manager')"),
    false,
    `${pageFile} must not expose a manager navigation control`
  );
  assert.equal(
    source.includes('Master Manager'),
    false,
    `${pageFile} must not display a manager mode card`
  );
}

console.log('ok - onboarding pages hide manager mode controls');
