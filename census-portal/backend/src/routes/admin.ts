import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { authenticateJWT, requireAdmin } from '../middleware/auth';
import { query, pool } from '../db/pool';
import { BadRequest, Conflict, NotFound } from '../utils/errors';
import { PLAN_LIMITS } from '../config';

const router = Router();

// All admin routes require a signed-in ADMIN account
router.use(authenticateJWT, requireAdmin);

// One data_values row per CSV row. geography_code/indicator_code must
// already exist (this is a data-value import, not a way to define new
// geographies or indicators); gender/age_group default to 'all' the
// same way seed.ts's hand-authored rows do.
const ImportRowSchema = z.object({
  geography_code: z.string().trim().min(1),
  indicator_code: z.string().trim().min(1),
  year: z.coerce.number().int().min(1900).max(2100),
  value: z.coerce.number(),
  gender: z.string().trim().min(1).optional(),
  age_group: z.string().trim().min(1).optional(),
  source: z.string().trim().optional(),
});

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

// Fields an admin may change on a single data_values row. Geography
// and indicator are intentionally not editable here — changing which
// place/indicator a row belongs to is a delete+recreate, not an edit.
const EditRowSchema = z
  .object({
    year: z.coerce.number().int().min(1900).max(2100).optional(),
    value: z.coerce.number().optional(),
    gender: z.string().trim().min(1).optional(),
    age_group: z.string().trim().min(1).optional(),
    source: z.string().trim().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

// ============================================================
// GET /admin/regions/:code/departments - Sub-region hierarchy for the
// admin data explorer. Mirrors /protected/regions/:code/departments,
// but gated on the signed-in admin's JWT instead of an API key — an
// admin browsing/editing the full dataset shouldn't need to also hold
// a personal API key.
// ============================================================
router.get('/regions/:code/departments', async (req, res, next) => {
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
// GET /admin/departments/:code/districts
// ============================================================
router.get('/departments/:code/districts', async (req, res, next) => {
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
// GET /admin/districts/:code/villages
// ============================================================
router.get('/districts/:code/villages', async (req, res, next) => {
  try {
    const { code } = req.params;
    const { rows } = await query(
      `SELECT v.name
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
// GET /admin/data - Search/browse individual data_values rows so an
// admin can find one record to correct, instead of re-running a full
// CSV import. Filterable by geography/indicator code, year, and a
// free-text match on geography/indicator name.
// ============================================================
router.get('/data', async (req, res, next) => {
  try {
    const { geography, indicator, year, search, page = '1', limit = '25' } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];

    if (typeof geography === 'string' && geography.trim()) {
      params.push(geography.trim());
      conditions.push(`g.code = $${params.length}`);
    }
    if (typeof indicator === 'string' && indicator.trim()) {
      params.push(indicator.trim());
      conditions.push(`i.code = $${params.length}`);
    }
    if (typeof year === 'string' && year.trim()) {
      params.push(parseInt(year, 10));
      conditions.push(`dv.year = $${params.length}`);
    }
    if (typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(g.name ILIKE $${params.length} OR i.name ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS count
       FROM data_values dv
       JOIN spatial_geo g ON g.id = dv.geography_id
       JOIN indicators i ON i.id = dv.indicator_id
       ${where}`,
      params
    );

    const { rows } = await query(
      `SELECT dv.id, g.code AS geography_code, g.name AS geography_name, g.level AS geography_level,
              i.code AS indicator_code, i.name AS indicator_name, i.unit,
              dv.year, dv.value, dv.gender, dv.age_group, dv.source, dv.last_updated
       FROM data_values dv
       JOIN spatial_geo g ON g.id = dv.geography_id
       JOIN indicators i ON i.id = dv.indicator_id
       ${where}
       ORDER BY dv.last_updated DESC, dv.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limitNum, offset]
    );

    res.json({ data: rows, meta: { total: countRows[0].count, page: pageNum, limit: limitNum } });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// PATCH /admin/data/:id - Edit a single data_values row (the value
// itself, or year/gender/age_group/source) without touching any other
// record. Since /public and /protected data endpoints read straight
// from this table, the corrected figure is live immediately.
// ============================================================
router.patch('/data/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = EditRowSchema.safeParse(req.body);
    if (!parsed.success) {
      throw BadRequest(parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; '));
    }

    const fields = parsed.data;
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(fields)) {
      values.push(val);
      sets.push(`${key} = $${values.length}`);
    }
    sets.push('last_updated = CURRENT_TIMESTAMP');
    values.push(id);

    let rows;
    try {
      ({ rows } = await query(
        `UPDATE data_values SET ${sets.join(', ')}
         WHERE id = $${values.length}
         RETURNING id, geography_id, indicator_id, year, value, gender, age_group, source, last_updated`,
        values
      ));
    } catch (e: any) {
      if (e.code === '23505') {
        throw Conflict('Another row already exists for that geography/indicator/year/gender/age_group combination');
      }
      throw e;
    }

    if (rows.length === 0) {
      throw NotFound('Data value not found');
    }

    res.json({ data: rows[0] });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// POST /admin/import - One-off manual CSV import of data_values.
// No live BUCREP/INS connection; an admin pastes/uploads a CSV
// export from wherever the source figures came from. Columns:
// geography_code, indicator_code, year, value, [gender, age_group,
// source]. Existing (geography, indicator, year, gender, age_group)
// combos are overwritten; unknown codes are reported per-row rather
// than failing the whole import.
// ============================================================
router.post('/import', async (req, res, next) => {
  try {
    const csv = typeof req.body.csv === 'string' ? req.body.csv : '';
    if (!csv.trim()) {
      throw BadRequest('csv (raw CSV text) is required');
    }

    let records: Record<string, string>[];
    try {
      records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
    } catch (e: any) {
      throw BadRequest(`Could not parse CSV: ${e.message}`);
    }

    if (records.length === 0) {
      throw BadRequest('CSV has no data rows');
    }

    const errors: { row: number; message: string }[] = [];
    let inserted = 0;
    let updated = 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (let i = 0; i < records.length; i++) {
        const rowNum = i + 2; // +1 for 0-index, +1 for the header row
        const parsed = ImportRowSchema.safeParse(records[i]);
        if (!parsed.success) {
          errors.push({
            row: rowNum,
            message: parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; '),
          });
          continue;
        }
        const row = parsed.data;

        const geo = await client.query(`SELECT id FROM spatial_geo WHERE code = $1`, [row.geography_code]);
        if (geo.rowCount === 0) {
          errors.push({ row: rowNum, message: `Unknown geography_code "${row.geography_code}"` });
          continue;
        }

        const ind = await client.query(`SELECT id FROM indicators WHERE code = $1`, [row.indicator_code]);
        if (ind.rowCount === 0) {
          errors.push({ row: rowNum, message: `Unknown indicator_code "${row.indicator_code}"` });
          continue;
        }

        const { rows: upserted } = await client.query(
          `INSERT INTO data_values (geography_id, indicator_id, year, value, gender, age_group, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (geography_id, indicator_id, year, gender, age_group)
           DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, last_updated = CURRENT_TIMESTAMP
           RETURNING (xmax = 0) AS inserted`,
          [
            geo.rows[0].id,
            ind.rows[0].id,
            row.year,
            row.value,
            row.gender || 'all',
            row.age_group || 'all',
            row.source || 'Manual Import',
          ]
        );

        if (upserted[0].inserted) inserted++;
        else updated++;
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({
      data: {
        total_rows: records.length,
        valid_rows: inserted + updated,
        inserted,
        updated,
        errors,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
