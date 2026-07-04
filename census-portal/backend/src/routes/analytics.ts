import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController';
import { authenticateApiKey } from '../middleware/auth';

const router = Router();

// No router.use(authenticateApiKey) — applied per-route below.
// These are data-consumption endpoints (like /protected/data): they
// count against the caller's API key quota, same as any other route
// an NGO developer might build a feature on top of. They aren't
// surfaced in the Data Explorer UI, but remain available to anyone
// with a valid key.

router.get('/regions', authenticateApiKey, analyticsController.getAllRegions);
router.get('/regions/:code', authenticateApiKey, analyticsController.getRegionByCode);
router.get('/regions/rank/water', authenticateApiKey, analyticsController.getRegionsRankedByWater);
router.get('/departments/rank', authenticateApiKey, analyticsController.getDepartmentRankings);
router.get('/compare/regions', authenticateApiKey, analyticsController.compareRegions);
router.get('/best-worst', authenticateApiKey, analyticsController.getBestWorst);

export default router;
