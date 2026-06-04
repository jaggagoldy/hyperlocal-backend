import express from 'express';
import { checkout, getMyOrdersController, checkEligibilityController } from '../../controllers/order.controller.js';
import { optionalAuth, requireAuth } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Require authentication to place an order or enquiry
router.post('/checkout', requireAuth, checkout);

router.get('/my-orders', requireAuth, getMyOrdersController);
router.get('/eligibility', requireAuth, checkEligibilityController);

export default router;
