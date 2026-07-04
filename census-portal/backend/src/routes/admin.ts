import { Router } from 'express';
import { authenticateJWT, requireAdmin } from '../middleware/auth';
import { query } from '../db/pool';
import { BadRequest, Conflict, NotFound } from '../utils/errors';
import { PLAN_LIMITS } from '../config';

const router = Router();

// All admin routes require a signed-in ADMIN account
router.use(authenticateJWT, requireAdmin);

// ============================================================
// GET /admin/users - List accounts with plan/usage (for support
// staff deciding who to upgrade)
// ============================================================
router.get('/users', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name, u.user_type, u.plan,
              u.monthly_limit, u.requests_used, u.is_active, u.created_at,
              COUNT(ak.id) FILTER (WHERE ak.is_active) AS active_api_keys
       FROM users u
       LEFT JOIN api_keys ak ON ak.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// PATCH /admin/users/:id/plan - Grant a plan upgrade/downgrade
// (manual stand-in for a billing system: no payment is processed
// here, this just raises the account's API key limit)
// ============================================================
router.patch('/users/:id/plan', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { plan } = req.body;

    if (!plan || !PLAN_LIMITS[plan]) {
      throw BadRequest(`plan must be one of: ${Object.keys(PLAN_LIMITS).join(', ')}`);
    }

    const { rows } = await query(
      `UPDATE users SET plan = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, plan`,
      [plan, id]
    );

    if (rows.length === 0) {
      throw NotFound('User not found');
    }

    res.json({ data: rows[0] });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// GET /admin/upgrade-requests - Pending plan requests awaiting review
// ============================================================
router.get('/upgrade-requests', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT r.id, r.requested_plan, r.status, r.created_at,
              u.id AS user_id, u.email, u.full_name, u.plan AS current_plan
       FROM plan_upgrade_requests r
       JOIN users u ON u.id = r.user_id
       WHERE r.status = 'PENDING'
       ORDER BY r.created_at ASC`
    );
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// PATCH /admin/upgrade-requests/:id - Approve or reject a pending
// plan request. Approving updates the user's plan directly.
// ============================================================
router.patch('/upgrade-requests/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (action !== 'approve' && action !== 'reject') {
      throw BadRequest('action must be "approve" or "reject"');
    }

    const { rows } = await query(
      `SELECT id, user_id, requested_plan, status FROM plan_upgrade_requests WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) {
      throw NotFound('Request not found');
    }
    if (rows[0].status !== 'PENDING') {
      throw Conflict('Request has already been resolved');
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    if (action === 'approve') {
      await query(
        `UPDATE users SET plan = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [rows[0].requested_plan, rows[0].user_id]
      );
    }

    const { rows: updated } = await query(
      `UPDATE plan_upgrade_requests
       SET status = $1, resolved_by = $2, resolved_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, requested_plan, status, resolved_at`,
      [newStatus, req.user!.id, id]
    );

    res.json({ data: updated[0] });
  } catch (e) {
    next(e);
  }
});

export default router;
