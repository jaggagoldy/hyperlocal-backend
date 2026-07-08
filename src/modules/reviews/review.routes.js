import express from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { submitReview, getVendorReviews, submitReviewReport } from './review.controller.js';

const router = express.Router();

router.post('/', requireAuth, submitReview);
router.get('/vendor/:vendorId', getVendorReviews);
router.post('/:id/report', requireAuth, submitReviewReport);

export default router;
