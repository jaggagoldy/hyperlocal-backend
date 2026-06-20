import express from 'express';
import { getRegionsController } from './regions.controller.js';

const router = express.Router();

// Public: canonical Haryana + Punjab district lists that drive onboarding's
// State -> District dropdowns and the consumer location filter.
router.get('/', getRegionsController);

export default router;
