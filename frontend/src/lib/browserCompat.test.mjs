import assert from 'node:assert/strict';
import { detectUnsupportedBrowser } from './browserCompat.js';

const tests = [
  ['marks iOS Safari as supported', () => {
    const result = detectUnsupportedBrowser(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      undefined
    );
    assert.equal(result.supported, true);
  }],

  ['marks iPad Safari as supported', () => {
    const result = detectUnsupportedBrowser(
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      undefined
    );
    assert.equal(result.supported, true);
  }],

  ['marks Samsung Internet as supported', () => {
    const result = detectUnsupportedBrowser(
      'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/125.0.6422.165 Mobile Safari/537.36',
      undefined
    );
    assert.equal(result.supported, true);
  }],

  ['marks Chrome Desktop as supported', () => {
    const result = detectUnsupportedBrowser(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      undefined
    );
    assert.equal(result.supported, true);
  }],

  ['marks Chrome Mobile (Android) as supported', () => {
    const result = detectUnsupportedBrowser(
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36',
      undefined
    );
    assert.equal(result.supported, true);
  }],

  ['marks Trust Wallet DApp browser as supported via UA', () => {
    const result = detectUnsupportedBrowser(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 TrustWallet/10.0 Safari/604.1',
      undefined
    );
    assert.equal(result.supported, true);
  }],

  ['marks browser as supported when window.ethereum is present', () => {
    const fakeEthereum = { request: async () => [] };
    const result = detectUnsupportedBrowser(
      'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 SamsungBrowser/26.0 Chrome/125.0 Mobile Safari/537.36',
      fakeEthereum
    );
    assert.equal(result.supported, true);
  }],

  ['marks Chrome on iOS (CriOS) as supported', () => {
    const result = detectUnsupportedBrowser(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1',
      undefined
    );
    assert.equal(result.supported, true);
  }],

  ['marks Firefox on iOS (FxiOS) as supported', () => {
    const result = detectUnsupportedBrowser(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/604.1',
      undefined
    );
    assert.equal(result.supported, true);
  }],

  ['handles empty/null userAgent gracefully', () => {
    assert.equal(detectUnsupportedBrowser('', undefined).supported, true);
    assert.equal(detectUnsupportedBrowser(null, undefined).supported, true);
    assert.equal(detectUnsupportedBrowser(undefined, undefined).supported, true);
  }],
];

for (const [name, run] of tests) {
  run();
  console.log(`ok - ${name}`);
}
