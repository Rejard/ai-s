import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

process.env.GATEIO_CREDENTIAL_ENCRYPTION_KEY = 'test-encryption-secret';

const require = createRequire(import.meta.url);
const { encryptText } = require('./secureCredentials');
const managerRouter = require('./routes/manager');

test('masked Gate.io credentials fall back to server-stored credentials', async () => {
  const resolver = managerRouter.__private?.resolveGateIoCredentials;
  assert.equal(typeof resolver, 'function');

  const store = {
    async get() {
      return {
        encrypted_api_key: encryptText('real-api-key'),
        encrypted_api_secret: encryptText('real-api-secret')
      };
    }
  };

  const credentials = await resolver({
    managerEmail: 'manager@example.com',
    headers: {
      'x-gateio-api-key': 'real-a******',
      'x-gateio-api-secret': 'real-s******'
    }
  }, store);

  assert.deepEqual(credentials, {
    apiKey: 'real-api-key',
    apiSecret: 'real-api-secret'
  });
});
