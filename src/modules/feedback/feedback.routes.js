import express from 'express';
import { submitFeedbackController, getFeedbackController, joinWaitlistController } from './feedback.controller.js';
import { requireAuth, restrictTo, optionalAuth } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Public / Optional Auth submission
router.post('/', optionalAuth, submitFeedbackController);

// Coming-Soon vertical waitlist (public)
router.post('/waitlist', optionalAuth, joinWaitlistController);

// Admin-only retrieval
router.get('/', requireAuth, restrictTo('admin'), getFeedbackController);

export default router;
