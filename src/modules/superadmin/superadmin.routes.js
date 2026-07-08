import express from 'express';
import {
  banUserController,
  suspendVendorController,
  getModerationQueueController,
  getReviewModerationQueueController,
  hideReviewController,
  restoreReviewController,
  getVerificationQueueController,
  reviewVerificationController,
  featureVendorController,
  getTicketsController,
  resolveTicketController,
  getCategoryAnalyticsController,
  getDashboardMetricsController,
  getVendorsController,
  getUsersController,
  getLeadsController,
  verifyVendorIdController,
  editVendorController,
  getAuditLogController,
  getSettingsController,
  updateSettingsController
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

// Review Moderation (Sprint 2 Batch 5)
router.get('/reviews/moderation-queue', getReviewModerationQueueController);
router.patch('/reviews/:id/hide', hideReviewController);
router.patch('/reviews/:id/restore', restoreReviewController);

// Vendor KYC & Monetization
router.get('/vendors', getVendorsController);
router.get('/verification-queue', getVerificationQueueController);
router.patch('/vendors/:id/verification', reviewVerificationController);
router.patch('/vendors/:id/verify', verifyVendorIdController);
router.patch('/vendors/:id/feature', featureVendorController);
router.patch('/vendors/:id', editVendorController);

// Users Management
router.get('/users', getUsersController);

// Ticketing & Support
router.get('/tickets', getTicketsController);
router.patch('/tickets/:id/resolve', resolveTicketController);

// Advanced Analytics & Lead Audit
router.get('/analytics/categories', getCategoryAnalyticsController);
router.get('/leads', getLeadsController);

// Audit Log (Sprint 2 Batch 4)
router.get('/audit-log', getAuditLogController);

// System Configuration
router.get('/settings', getSettingsController);
router.patch('/settings', updateSettingsController);

export default router;
