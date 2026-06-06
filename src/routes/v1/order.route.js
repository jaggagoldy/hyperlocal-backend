import express from 'express';
import { checkout, getMyOrdersController, checkEligibilityController, getVendorOrdersController, updateOrderStatusController } from '../../controllers/order.controller.js';
import { optionalAuth, requireAuth } from '../../middlewares/auth.middleware.js';
import { restrictTo } from '../../middlewares/auth.middleware.js';
import verifyBusinessOwnership from '../../middlewares/verifyBusinessOwnership.js';

const router = express.Router();

// Require authentication to place an order or enquiry
router.post('/', requireAuth, checkout);
router.post('/checkout', requireAuth, checkout);

router.get('/my-orders', requireAuth, getMyOrdersController);
router.get('/eligibility', requireAuth, checkEligibilityController);

// Vendor Routes
router.get('/vendor', requireAuth, restrictTo('vendor', 'admin'), verifyBusinessOwnership, getVendorOrdersController);
router.patch('/vendor/:id', requireAuth, restrictTo('vendor', 'admin'), verifyBusinessOwnership, updateOrderStatusController);

export default router;
