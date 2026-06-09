import assert from 'node:assert/strict';
import {
  buildAuthHeaders,
  clearAuthSession,
  getAuthToken,
  saveAuthSession,
} from './authSession.js';

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};

saveAuthSession('signed-token', { email: 'user@example.com', name: 'User' }, storage);
assert.equal(getAuthToken(storage), 'signed-token');
assert.deepEqual(buildAuthHeaders(storage), { Authorization: 'Bearer signed-token' });
assert.equal(storage.getItem('google_email'), 'user@example.com');

clearAuthSession(storage);
assert.equal(getAuthToken(storage), '');
assert.deepEqual(buildAuthHeaders(storage), {});

console.log('authSession tests passed');
