import express from 'express';
import {
  dashboardController,
  createCityController,
  createCategoryController,
  moderateVendorController,
  subscriptionOverrideController,
  listBusinessesController,
} from './admin.controller.js';
import { requireAuth, restrictTo } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Enforce strictly admin-only RBAC barrier for all operational routes
router.use(requireAuth, restrictTo('admin'));

// Admin Intelligence Interface
router.get('/metrics/dashboard', dashboardController);

// Paginated, filterable business list for admin moderation
router.get('/businesses', listBusinessesController);

// Administrative Command Overrides
router.post('/cities', createCityController);
router.post('/categories', createCategoryController);
router.patch('/vendors/:id/status', moderateVendorController);
router.patch('/vendors/:id/subscription', subscriptionOverrideController);

export default router;
