import express from 'express';
import { getVerticalsController } from './verticals.controller.js';

const router = express.Router();

// Public: the live + coming-soon verticals that drive onboarding & home tiles.
router.get('/', getVerticalsController);

export default router;
