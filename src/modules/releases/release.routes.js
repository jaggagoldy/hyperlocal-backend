import express from 'express';
import {
  listPublicReleasesController,
  getPublicReleaseController,
  getTimelineController,
  listInternalReleasesController,
  getInternalReleaseController,
} from './release.controller.js';
import { requireAuth, requireSuperadmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// ── Internal (superadmin only) — declared before the public :version route ──
// so "/internal" is never captured as a version param.
router.use('/internal', requireAuth, requireSuperadmin);
router.get('/internal', listInternalReleasesController);
router.get('/internal/:version', getInternalReleaseController);

// ── Public "What's New" (no auth) ──
router.get('/', listPublicReleasesController);
router.get('/timeline', getTimelineController);
router.get('/:version', getPublicReleaseController);

export default router;
