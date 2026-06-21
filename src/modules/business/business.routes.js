import express from 'express';
import {
  createBusinessController,
  updateBusinessController,
  deleteBusinessController,
  registerBusinessSelfController,
  getMyBusinessesController,
  getBusinessDashboardController,
  getBusinessBySlugController,
  initiateClaimController,
  verifyClaimController,
  upgradeTierController,
} from './business.controller.js';
import { requireAuth, restrictTo } from '../../middlewares/auth.middleware.js';
import verifyBusinessOwnership from '../../middlewares/verifyBusinessOwnership.js';

const router = express.Router();

// Public route to fetch a business profile by slug
router.get('/:slug', getBusinessBySlugController);

// Apply auth middleware to all other business routes
router.use(requireAuth);

// Vendor Self-Registration (allows regular users to become service providers)
router.post('/register', registerBusinessSelfController);

// Claim an unclaimed imported listing (OTP), then optionally upgrade its tier.
router.post('/:id/claim/initiate', initiateClaimController);
router.post('/:id/claim/verify', verifyClaimController);
router.patch('/:id/tier', upgradeTierController);

// Retrieve all businesses owned by logged-in user
router.get('/me/list', getMyBusinessesController);

// Retrieve specific business dashboard analytics (requires x-business-id)
router.get('/me/dashboard', verifyBusinessOwnership, getBusinessDashboardController);

// Admin-only creation
router.post('/', restrictTo('admin'), createBusinessController);

// Update a business profile (Requires x-business-id to ensure ownership, or admin can bypass)
// For simplicity, we just use verifyBusinessOwnership
router.patch('/update', verifyBusinessOwnership, updateBusinessController);

// Admin-only soft delete
router.delete('/:id', restrictTo('admin'), deleteBusinessController);

export default router;
