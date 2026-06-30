const crypto = require('crypto');

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET is required for authenticated sessions.');
  }
  return secret;
}

function sign(value) {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function issueAuthToken(email, name = '') {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    email: String(email || '').toLowerCase().trim(),
    name: String(name || '').trim(),
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  })).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

function verifyAuthToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.email || !session.exp || session.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    session.email = session.email.toLowerCase().trim();
    return session;
  } catch {
    return null;
  }
}

function getRequestAuthToken(req) {
  const authorization = String(req.headers.authorization || '');
  if (authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  if (req.query && req.query.token) {
    return String(req.query.token).trim();
  }
  return '';
}

function requireAuthenticatedSession(req, res, next) {
  let session;
  const token = getRequestAuthToken(req);
  console.log(`[AUTH] Path: ${req.path}, Token length: ${token.length}`);
  try {
    session = verifyAuthToken(token);
  } catch (error) {
    console.log(`[AUTH] Verify error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }

  if (!session) {
    console.log(`[AUTH] Blocked: No session (Invalid or missing token)`);
    return res.status(401).json({
      success: false,
      message: 'A valid authenticated session is required.',
    });
  }

  req.authSession = session;
  req.authEmail = session.email;
  next();
}

module.exports = {
  issueAuthToken,
  verifyAuthToken,
  requireAuthenticatedSession,
};
