const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

function getEncryptionSecret() {
  const configured = process.env.GATEIO_CREDENTIAL_ENCRYPTION_KEY || process.env.PRIVATE_KEY;
  if (!configured) {
    throw new Error('GATEIO_CREDENTIAL_ENCRYPTION_KEY or PRIVATE_KEY is required to store Gate.io credentials.');
  }
  return configured;
}

function getEncryptionKey(secret = getEncryptionSecret()) {
  return crypto.createHash('sha256').update(String(secret)).digest().subarray(0, KEY_BYTES);
}

function encryptText(plainText, secret) {
  if (!plainText) return '';

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64')
  ].join(':');
}

function decryptText(payload, secret) {
  if (!payload) return '';

  const [version, ivB64, tagB64, encryptedB64] = String(payload).split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Invalid encrypted credential payload.');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(secret),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

module.exports = {
  decryptText,
  encryptText
};
