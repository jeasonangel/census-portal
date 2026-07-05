import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { compareApiKey } from '../utils/apiKey';
import { query } from '../db/pool';
import { Unauthorized, Forbidden, TooManyRequests } from '../utils/errors';
import { RATE_LIMITS, config } from '../config';

// ============================================================
// API key authentication - for data-access endpoints consumed
// by external integrations. Enforces per-key monthly quotas.
// ============================================================
export async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw Unauthorized('Missing X-API-Key header');
    }

    const prefix = apiKey.slice(0, 12);

    const { rows } = await query(
      `SELECT u.id, u.email, u.user_type, u.monthly_limit, u.requests_used,
              ak.id as key_id, ak.key_hash
       FROM api_keys ak
       JOIN users u ON u.id = ak.user_id
       WHERE ak.key_prefix = $1 AND ak.is_active = true`,
      [prefix]
    );

    if (rows.length === 0) {
      throw Unauthorized('Invalid API key');
    }

    // Verify the actual key
    let matched = null;
    for (const row of rows) {
      if (await compareApiKey(apiKey, row.key_hash)) {
        matched = row;
        break;
      }
    }

    if (!matched) {
      throw Unauthorized('Invalid API key');
    }

    // From here on this is a genuine, resolved API key — write one
    // usage_logs row per request once the response finishes, whatever
    // the eventual status code (quota rejection included). Fired after
    // the client already has its response, so a logging failure can
    // never affect the request itself.
    const endpoint = req.originalUrl;
    const method = req.method;
    const ip = req.ip;
    const userId = matched.id;
    const apiKeyId = matched.key_id;
    res.on('finish', () => {
      query(
        `INSERT INTO usage_logs (user_id, api_key_id, endpoint, method, status_code, response_time_ms, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, apiKeyId, endpoint, method, res.statusCode, Date.now() - start, ip]
      ).catch((err) => console.error('Failed to write usage log:', err));
    });

    // Check rate limit
    if (matched.user_type !== 'ADMIN') {
      const limit = RATE_LIMITS[matched.user_type as keyof typeof RATE_LIMITS] || RATE_LIMITS.USER;
      if (matched.requests_used >= limit) {
        throw TooManyRequests(`Monthly quota of ${limit} requests reached.`);
      }

      // Increment request count
      await query(`UPDATE users SET requests_used = requests_used + 1 WHERE id = $1`, [
        matched.id,
      ]);
    }

    // Update last used
    await query(`UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = $1`, [
      matched.key_id,
    ]);

    req.user = {
      id: matched.id,
      email: matched.email,
      user_type: matched.user_type,
      monthly_limit: matched.monthly_limit,
      requests_used: matched.requests_used + 1,
    };
    req.apiKeyId = matched.key_id;

    next();
  } catch (err) {
    next(err);
  }
}

// ============================================================
// JWT authentication - for account/session endpoints (managing
// one's own API keys, usage stats). Requires a signed-in user,
// not a specific API key — this is what lets a user manage their
// keys without already having one cached on the device.
// ============================================================
export async function authenticateJWT(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      throw Unauthorized('Missing or malformed Authorization header');
    }

    let payload: { uid: number };
    try {
      payload = jwt.verify(token, config.jwt.secret) as { uid: number };
    } catch {
      throw Unauthorized('Invalid or expired session');
    }

    const { rows } = await query(
      `SELECT id, email, user_type, plan, is_active FROM users WHERE id = $1`,
      [payload.uid]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      throw Unauthorized('Account not found or inactive');
    }

    req.user = {
      id: rows[0].id,
      email: rows[0].email,
      user_type: rows[0].user_type,
      plan: rows[0].plan,
    };

    next();
  } catch (err) {
    next(err);
  }
}

// ============================================================
// Admin gate - chain after authenticateJWT on routes that should
// only be reachable by staff (e.g. granting plan upgrades).
// ============================================================
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.user_type !== 'ADMIN') {
    return next(Forbidden('Admin access required'));
  }
  next();
}
