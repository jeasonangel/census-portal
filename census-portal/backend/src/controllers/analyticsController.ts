import { Request, Response, NextFunction } from 'express';
import { query } from '../db/pool';
import { BadRequest, NotFound } from '../utils/errors';

const GEO_LEVELS = ['region', 'department', 'district', 'village'];
const DEFAULT_YEAR = 2026;

function parseYear(raw: unknown): number {
  const year = Number(raw);
  return Number.isFinite(year) ? year : DEFAULT_YEAR;
}

async function indicatorExists(code: string): Promise<boolean> {
  const { rowCount } = await query(`SELECT 1 FROM indicators WHERE code = $1`, [code]);
  return (rowCount ?? 0) > 0;
}

// ============================================================
// GET /analytics/regions - All regions with their full indicator
// profile for a given year (defaults to the current census year)
// ============================================================
async function getAllRegions(req: Request, res: Response, next: NextFunction) {
  try {
    const year = parseYear(req.query.year);

    const { rows } = await query(
      `SELECT g.code, g.name, g.population, g.area_km2,
              COALESCE(jsonb_object_agg(i.code, dv.value) FILTER (WHERE i.code IS NOT NULL), '{}'::jsonb) AS indicators
       FROM spatial_geo g
       LEFT JOIN data_values dv ON dv.geography_id = g.id AND dv.year = $1
       LEFT JOIN indicators i ON i.id = dv.indicator_id
       WHERE g.level = 'region'
       GROUP BY g.id
       ORDER BY g.name`,
      [year]
    );

    res.json({ data: rows, meta: { year } });
  } catch (e) {
    next(e);
  }
}

// ============================================================
// GET /analytics/regions/:code - Single region's full profile
// ============================================================
async function getRegionByCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.params;
    const year = parseYear(req.query.year);

    const { rows } = await query(
      `SELECT g.code, g.name, g.population, g.area_km2,
              COALESCE(jsonb_object_agg(i.code, dv.value) FILTER (WHERE i.code IS NOT NULL), '{}'::jsonb) AS indicators
       FROM spatial_geo g
       LEFT JOIN data_values dv ON dv.geography_id = g.id AND dv.year = $2
       LEFT JOIN indicators i ON i.id = dv.indicator_id
       WHERE g.level = 'region' AND g.code = $1
       GROUP BY g.id`,
      [code, year]
    );

    if (rows.length === 0) {
      throw NotFound(`Region "${code}" not found`);
    }

    res.json({ data: rows[0], meta: { year } });
  } catch (e) {
    next(e);
  }
}

// ============================================================
// GET /analytics/regions/rank/water - Regions ranked by access
// to clean water (best to worst)
// ============================================================
async function getRegionsRankedByWater(req: Request, res: Response, next: NextFunction) {
  try {
    const year = parseYear(req.query.year);

    const { rows } = await query(
      `SELECT g.code, g.name, dv.value AS water_access,
              RANK() OVER (ORDER BY dv.value DESC) AS rank
       FROM spatial_geo g
       JOIN data_values dv ON dv.geography_id = g.id
       JOIN indicators i ON i.id = dv.indicator_id AND i.code = 'WATER_ACCESS'
       WHERE g.level = 'region' AND dv.year = $1
       ORDER BY dv.value DESC`,
      [year]
    );

    res.json({ data: rows, meta: { year, indicator: 'WATER_ACCESS' } });
  } catch (e) {
    next(e);
  }
}

// ============================================================
// GET /analytics/departments/rank - Departments ranked by any
// indicator, optionally scoped to one region
// ?indicator=POP_TOT&order=desc&region=CE&limit=20&year=2026
// ============================================================
async function getDepartmentRankings(req: Request, res: Response, next: NextFunction) {
  try {
    const indicator = (req.query.indicator as string) || 'POP_TOT';
    const region = req.query.region as string | undefined;
    const year = parseYear(req.query.year);
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 58));

    if (!(await indicatorExists(indicator))) {
      throw BadRequest(`Unknown indicator "${indicator}"`);
    }

    const params: any[] = [indicator, year];
    let regionFilter = '';
    if (region) {
      params.push(region);
      regionFilter = `AND r.code = $${params.length}`;
    }
    params.push(limit);

    const { rows } = await query(
      `SELECT g.code, g.name, r.code AS region_code, r.name AS region_name, dv.value,
              RANK() OVER (ORDER BY dv.value ${order}) AS rank
       FROM spatial_geo g
       JOIN spatial_geo r ON r.id = g.parent_id
       JOIN data_values dv ON dv.geography_id = g.id
       JOIN indicators i ON i.id = dv.indicator_id AND i.code = $1
       WHERE g.level = 'department' AND dv.year = $2 ${regionFilter}
       ORDER BY dv.value ${order}
       LIMIT $${params.length}`,
      params
    );

    res.json({ data: rows, meta: { year, indicator, order: order.toLowerCase(), region: region || null } });
  } catch (e) {
    next(e);
  }
}

// ============================================================
// GET /analytics/compare/regions - Side-by-side comparison of
// 2+ regions across every indicator
// ?codes=CE,LT,NO&year=2026
// ============================================================
async function compareRegions(req: Request, res: Response, next: NextFunction) {
  try {
    const codesRaw = (req.query.codes as string) || '';
    const codes = codesRaw.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
    const year = parseYear(req.query.year);

    if (codes.length < 2) {
      throw BadRequest('Provide at least 2 region codes via ?codes=CE,LT,...');
    }

    const { rows } = await query(
      `SELECT g.code, g.name, g.population, g.area_km2,
              COALESCE(jsonb_object_agg(i.code, dv.value) FILTER (WHERE i.code IS NOT NULL), '{}'::jsonb) AS indicators
       FROM spatial_geo g
       LEFT JOIN data_values dv ON dv.geography_id = g.id AND dv.year = $2
       LEFT JOIN indicators i ON i.id = dv.indicator_id
       WHERE g.level = 'region' AND g.code = ANY($1::text[])
       GROUP BY g.id
       ORDER BY g.name`,
      [codes, year]
    );

    res.json({ data: rows, meta: { year, codes } });
  } catch (e) {
    next(e);
  }
}

// ============================================================
// GET /analytics/best-worst - Best and worst performing geography
// for a given indicator at a given level
// ?indicator=LIT_RATE&level=region&year=2026
// ============================================================
async function getBestWorst(req: Request, res: Response, next: NextFunction) {
  try {
    const indicator = (req.query.indicator as string) || 'LIT_RATE';
    const level = (req.query.level as string) || 'region';
    const year = parseYear(req.query.year);

    if (!GEO_LEVELS.includes(level)) {
      throw BadRequest(`level must be one of: ${GEO_LEVELS.join(', ')}`);
    }
    if (!(await indicatorExists(indicator))) {
      throw BadRequest(`Unknown indicator "${indicator}"`);
    }

    const base = `
       SELECT g.code, g.name, dv.value
       FROM spatial_geo g
       JOIN data_values dv ON dv.geography_id = g.id
       JOIN indicators i ON i.id = dv.indicator_id AND i.code = $1
       WHERE g.level = $2 AND dv.year = $3
       ORDER BY dv.value`;

    const [bestRes, worstRes] = await Promise.all([
      query(`${base} DESC LIMIT 1`, [indicator, level, year]),
      query(`${base} ASC LIMIT 1`, [indicator, level, year]),
    ]);

    res.json({
      data: {
        indicator,
        level,
        best: bestRes.rows[0] || null,
        worst: worstRes.rows[0] || null,
      },
      meta: { year },
    });
  } catch (e) {
    next(e);
  }
}

export const analyticsController = {
  getAllRegions,
  getRegionByCode,
  getRegionsRankedByWater,
  getDepartmentRankings,
  compareRegions,
  getBestWorst,
};
