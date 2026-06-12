/**
 * Zero Trust Anomaly Detection Filter
 * Protects admin endpoints from spam, brute-force, or erratic behaviors.
 * Follows Cartridge-Style Modularization.
 */

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 50; // max 50 requests per minute
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes block for anomalies

// In-memory store for rate limiting and IP blocking
const requestLogs = new Map();
const blockedIPs = new Map();

function zeroTrustMiddleware(req, res, next) {
    // 1. Identify client
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // 2. Check if currently blocked
    if (blockedIPs.has(clientIp)) {
        const unblockTime = blockedIPs.get(clientIp);
        if (now < unblockTime) {
            console.warn(`[ZERO TRUST] Blocked request from ${clientIp}. Unblocks at ${new Date(unblockTime).toISOString()}`);
            return res.status(429).json({ error: "Zero Trust: Too many anomalous requests. You have been temporarily blocked." });
        } else {
            // Block expired
            blockedIPs.delete(clientIp);
            requestLogs.delete(clientIp);
        }
    }

    // 3. Rate limiting logic (Simple window per minute)
    if (!requestLogs.has(clientIp)) {
        requestLogs.set(clientIp, { count: 1, startTime: now });
    } else {
        const log = requestLogs.get(clientIp);
        if (now - log.startTime < WINDOW_MS) {
            log.count += 1;
            if (log.count > MAX_REQUESTS_PER_WINDOW) {
                // Anomaly detected: Spamming admin endpoints
                console.error(`[ZERO TRUST] Anomaly Detected: IP ${clientIp} exceeded ${MAX_REQUESTS_PER_WINDOW} reqs/min.`);
                blockedIPs.set(clientIp, now + BLOCK_DURATION_MS);
                return res.status(429).json({ error: "Zero Trust: Anomaly detected. Suspicious high-frequency access." });
            }
        } else {
            // Reset window
            log.count = 1;
            log.startTime = now;
        }
    }

    // 4. (Optional Future Check) Anomaly Payload Size Check
    if (req.body && JSON.stringify(req.body).length > 500000) {
        console.error(`[ZERO TRUST] Payload too large from ${clientIp}. Blocking.`);
        blockedIPs.set(clientIp, now + BLOCK_DURATION_MS);
        return res.status(403).json({ error: "Zero Trust: Payload too large." });
    }

    next();
}

module.exports = {
    zeroTrustMiddleware
};
