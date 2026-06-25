
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 500;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

const requestLogs = new Map();
const blockedIPs = new Map();

function zeroTrustMiddleware(req, res, next) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (blockedIPs.has(clientIp)) {
        const unblockTime = blockedIPs.get(clientIp);
        if (now < unblockTime) {
            console.warn(`[ZERO TRUST] Blocked request from ${clientIp}. Unblocks at ${new Date(unblockTime).toISOString()}`);
            return res.status(429).json({ error: "Zero Trust: Too many anomalous requests. You have been temporarily blocked." });
        } else {
            blockedIPs.delete(clientIp);
            requestLogs.delete(clientIp);
        }
    }

    if (!requestLogs.has(clientIp)) {
        requestLogs.set(clientIp, { count: 1, startTime: now });
    } else {
        const log = requestLogs.get(clientIp);
        if (now - log.startTime < WINDOW_MS) {
            log.count += 1;
            if (log.count > MAX_REQUESTS_PER_WINDOW) {
                console.error(`[ZERO TRUST] Anomaly Detected: IP ${clientIp} exceeded ${MAX_REQUESTS_PER_WINDOW} reqs/min.`);
                blockedIPs.set(clientIp, now + BLOCK_DURATION_MS);
                return res.status(429).json({ error: "Zero Trust: Anomaly detected. Suspicious high-frequency access." });
            }
        } else {
            log.count = 1;
            log.startTime = now;
        }
    }

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
