const assert = require('assert');

process.env.AUTH_SESSION_SECRET = 'test-session-secret';

const { issueAuthToken, verifyAuthToken } = require('./authSession');

const token = issueAuthToken('Manager@Example.com', 'Manager');
const session = verifyAuthToken(token);

assert.equal(session.email, 'manager@example.com');
assert.equal(session.name, 'Manager');
assert.equal(verifyAuthToken(`${token}tampered`), null);
assert.equal(verifyAuthToken('invalid-token'), null);

console.log('authSession tests passed');
