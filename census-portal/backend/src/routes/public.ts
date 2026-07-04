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

// ============================================================
// GET /public/regions/:code/departments (NO AUTH)
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
// GET /public/departments/:code/districts (NO AUTH)
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
// GET /public/districts/:code/villages (NO AUTH)
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
// GET /public/data (NO AUTH)
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
       WHERE g.code = $1 AND i.code = $2 AND dv.year = $3`,
      [geography, indicator, year]
    );

    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// GET /public/search (NO AUTH)
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
       WHERE name ILIKE $1
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