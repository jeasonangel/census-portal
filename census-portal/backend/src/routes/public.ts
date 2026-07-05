import { Router } from 'express';
import { query } from '../db/pool';

const router = Router();

// ============================================================
// GET /public/regions - All regions (NO AUTH)
// ============================================================
router.get('/regions', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT code, name, population, area_km2 
       FROM spatial_geo 
       WHERE level = 'region' 
       ORDER BY name`
    );
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// Sub-region hierarchy (departments/districts/villages) is intentionally
// NOT exposed here — that drill-down requires an API key. See the
// matching routes under /protected for the authenticated equivalents.

// ============================================================
// GET /public/indicators (NO AUTH)
// ============================================================
router.get('/indicators', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT code, name, unit, category
       FROM indicators 
       WHERE is_active = true
       ORDER BY category, name`
    );
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// GET /public/data (NO AUTH) - region-level indicator values only.
// Department/district/village data requires an API key (see
// /protected/data, which accepts any geography level).
// ============================================================
router.get('/data', async (req, res, next) => {
  try {
    const { geography, indicator, year = 2026 } = req.query;

    if (!geography || !indicator) {
      return res.status(400).json({ error: 'geography and indicator are required' });
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
       WHERE g.code = $1 AND i.code = $2 AND dv.year = $3 AND g.level = 'region'`,
      [geography, indicator, year]
    );

    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// GET /public/search (NO AUTH) - regions only, same reasoning as /data.
// ============================================================
router.get('/search', async (req, res, next) => {
  try {
    const q = req.query.q as string;
    if (!q || q.length < 2) {
      return res.json({ data: [] });
    }

    const { rows } = await query(
      `SELECT code, name, level
       FROM spatial_geo
       WHERE name ILIKE $1 AND level = 'region'
       ORDER BY name
       LIMIT 20`,
      [`%${q}%`]
    );

    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

export default router;