import { Router } from 'express';
import { authenticateApiKey, authenticateJWT } from '../middleware/auth';
import { query } from '../db/pool';
import { generateApiKey, hashApiKey } from '../utils/apiKey';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/errors';
import { PLAN_LIMITS } from '../config';

const router = Router();

// ============================================================
// GET /protected/keys - List signed-in user's API keys
// ============================================================
router.get('/keys', authenticateJWT, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, key_prefix, is_active, created_at, last_used
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user!.id]
    );
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// POST /protected/keys - Create new API key
// ============================================================
router.post('/keys', authenticateJWT, async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    if (!name) {
      throw BadRequest('Key name required');
    }

    // Admins are exempt; everyone else is capped by their plan's key limit.
    if (req.user!.user_type !== 'ADMIN') {
      const plan = req.user!.plan || 'FREE';
      const maxKeys = PLAN_LIMITS[plan]?.maxApiKeys ?? PLAN_LIMITS.FREE.maxApiKeys;

      const { rows: activeKeys } = await query(
        `SELECT COUNT(*)::int AS count FROM api_keys WHERE user_id = $1 AND is_active = true`,
        [req.user!.id]
      );

      if (activeKeys[0].count >= maxKeys) {
        throw Forbidden(
          plan === 'FREE'
            ? `Free plan is limited to ${maxKeys} active API key. Revoke your existing key or upgrade to create more.`
            : `Your plan is limited to ${maxKeys} active API keys. Revoke an existing key or contact us to raise your limit.`,
          'PLAN_LIMIT_REACHED'
        );
      }
    }

    const { raw, prefix } = generateApiKey();
    const hashedKey = await hashApiKey(raw);

    const { rows } = await query(
      `INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, key_prefix, is_active, created_at`,
      [req.user!.id, name, hashedKey, prefix]
    );

    res.status(201).json({
      data: {
        ...rows[0],
        api_key: raw,
        message: 'Save this API key. It will not be shown again.',
      },
    });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// DELETE /protected/keys/:id - Revoke API key
// ============================================================
router.delete('/keys/:id', authenticateJWT, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rowCount } = await query(
      `UPDATE api_keys SET is_active = false
       WHERE id = $1 AND user_id = $2`,
      [id, req.user!.id]
    );

    if (rowCount === 0) {
      throw NotFound('Key not found');
    }

    res.json({ data: { revoked: true } });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// GET /protected/usage - Usage statistics
// ============================================================
router.get('/usage', authenticateJWT, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT monthly_limit, requests_used, is_unlimited, plan
       FROM users WHERE id = $1`,
      [req.user!.id]
    );

    const user = rows[0];
    const remaining = user.is_unlimited ? -1 : user.monthly_limit - user.requests_used;
    const pct = user.is_unlimited ? 0 : (user.requests_used / user.monthly_limit) * 100;

    const { rows: activeKeys } = await query(
      `SELECT COUNT(*)::int AS count FROM api_keys WHERE user_id = $1 AND is_active = true`,
      [req.user!.id]
    );

    const maxKeys = req.user!.user_type === 'ADMIN'
      ? -1
      : PLAN_LIMITS[user.plan]?.maxApiKeys ?? PLAN_LIMITS.FREE.maxApiKeys;

    res.json({
      data: {
        monthly_limit: user.monthly_limit,
        requests_used: user.requests_used,
        remaining,
        percentage_used: Math.min(100, pct),
        is_unlimited: user.is_unlimited,
        plan: user.plan,
        api_keys_used: activeKeys[0].count,
        api_keys_limit: maxKeys,
      },
    });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// POST /protected/upgrade-request - Ask an admin to change your plan
// (no billing happens here; an admin reviews and approves/rejects)
// ============================================================
router.post('/upgrade-request', authenticateJWT, async (req, res, next) => {
  try {
    const plan = typeof req.body.plan === 'string' ? req.body.plan.toUpperCase() : '';

    if (!PLAN_LIMITS[plan]) {
      throw BadRequest(`plan must be one of: ${Object.keys(PLAN_LIMITS).join(', ')}`);
    }
    if (plan === (req.user!.plan || 'FREE')) {
      throw BadRequest(`You are already on the ${plan} plan`);
    }

    const { rows: pending } = await query(
      `SELECT id FROM plan_upgrade_requests WHERE user_id = $1 AND status = 'PENDING'`,
      [req.user!.id]
    );
    if (pending.length > 0) {
      throw Conflict('You already have a pending plan request awaiting review');
    }

    const { rows } = await query(
      `INSERT INTO plan_upgrade_requests (user_id, requested_plan)
       VALUES ($1, $2)
       RETURNING id, requested_plan, status, created_at`,
      [req.user!.id, plan]
    );

    res.status(201).json({ data: rows[0] });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// GET /protected/upgrade-request - Most recent plan request status
// for the signed-in user (so the UI can show "pending review")
// ============================================================
router.get('/upgrade-request', authenticateJWT, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, requested_plan, status, created_at, resolved_at
       FROM plan_upgrade_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user!.id]
    );
    res.json({ data: rows[0] || null });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// GET /protected/regions/:code/departments - Sub-region hierarchy
// (API key required). The public equivalents were removed; only
// region-level browsing is unauthenticated.
// ============================================================
router.get('/regions/:code/departments', authenticateApiKey, async (req, res, next) => {
  try {
    const { code } = req.params;
    const { rows } = await query(
      `SELECT d.code, d.name, d.population
       FROM spatial_geo r
       JOIN spatial_geo d ON d.parent_id = r.id
       WHERE r.code = $1 AND d.level = 'department'
       ORDER BY d.name`,
      [code]
    );
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// GET /protected/departments/:code/districts (API key required)
// ============================================================
router.get('/departments/:code/districts', authenticateApiKey, async (req, res, next) => {
  try {
    const { code } = req.params;
    const { rows } = await query(
      `SELECT d.code, d.name
       FROM spatial_geo dept
       JOIN spatial_geo d ON d.parent_id = dept.id
       WHERE dept.code = $1 AND d.level = 'district'
       ORDER BY d.name`,
      [code]
    );
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// GET /protected/districts/:code/villages (API key required)
// ============================================================
router.get('/districts/:code/villages', authenticateApiKey, async (req, res, next) => {
  try {
    const { code } = req.params;
    const { rows } = await query(
      `SELECT v.code, v.name, v.population
       FROM spatial_geo dist
       JOIN spatial_geo v ON v.parent_id = dist.id
       WHERE dist.code = $1 AND v.level = 'village'
       ORDER BY v.name`,
      [code]
    );
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// GET /protected/data - Protected data access (API key required)
// ============================================================
router.get('/data', authenticateApiKey, async (req, res, next) => {
  try {
    const { geography, indicator, year = 2026 } = req.query;

    if (!geography || !indicator) {
      throw BadRequest('geography and indicator are required');
    }

    const { rows } = await query(
      `SELECT
         g.code AS geography_code,
         g.name AS geography_name,
         g.level AS geography_level,
         i.name AS indicator_name,
         i.unit,
         dv.year,
         dv.value
       FROM data_values dv
       JOIN spatial_geo g ON g.id = dv.geography_id
       JOIN indicators i ON i.id = dv.indicator_id
       WHERE g.code = $1 AND i.code = $2 AND dv.year = $3`,
      [geography, indicator, year]
    );

    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

export default router;
