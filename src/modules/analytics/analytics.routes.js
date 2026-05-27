import express from 'express';
import { logInteractionController } from './analytics.controller.js';

const router = express.Router();

// Asynchronous click engine endpoint
router.post('/interaction', logInteractionController);

export default router;
