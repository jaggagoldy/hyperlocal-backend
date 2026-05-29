import express from 'express';
import {
  banUserController,
  suspendVendorController,
  getModerationQueueController,
  featureVendorController,
  getTicketsController,
  resolveTicketController,
  getCategoryAnalyticsController,
  getDashboardMetricsController,
  getVendorsController,
  getUsersController,
  getLeadsController,
  verifyVendorIdController
} from './superadmin.controller.js';
import { requireAuth, requireSuperadmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Enforce strictly admin-only RBAC barrier
router.use(requireAuth, requireSuperadmin);

// Dashboard Metrics
router.get('/metrics', getDashboardMetricsController);

// Trust & Safety
router.patch('/users/:id/ban', banUserController);
router.patch('/vendors/:id/suspend', suspendVendorController);
router.get('/moderation-queue', getModerationQueueController);

// Vendor KYC & Monetization
router.get('/vendors', getVendorsController);
router.patch('/vendors/:id/verify', verifyVendorIdController);
router.patch('/vendors/:id/feature', featureVendorController);

// Users Management
router.get('/users', getUsersController);

// Ticketing & Support
router.get('/tickets', getTicketsController);
router.patch('/tickets/:id/resolve', resolveTicketController);

// Advanced Analytics & Lead Audit
router.get('/analytics/categories', getCategoryAnalyticsController);
router.get('/leads', getLeadsController);

export default router;
