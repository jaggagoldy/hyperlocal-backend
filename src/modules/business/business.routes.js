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
  submitVerificationController,
  checkPotentialDuplicatesController,
  getSitemapSlugsController,
} from './business.controller.js';
import { requireAuth, restrictTo } from '../../middlewares/auth.middleware.js';
import verifyBusinessOwnership from '../../middlewares/verifyBusinessOwnership.js';

const router = express.Router();

// Registered before the '/:slug' catch-all below, since that route would
// otherwise match this path first (Express matches route registration order).
// requireAuth is applied directly here rather than via the router.use() further
// down, for the same reason.
router.get('/check-duplicates', requireAuth, checkPotentialDuplicatesController);

// Public, unauthenticated — feeds the frontend sitemap.ts. Two path segments,
// so it can never be shadowed by the single-segment '/:slug' catch-all below,
// but kept above it anyway for readability alongside the other pre-auth routes.
router.get('/sitemap/slugs', getSitemapSlugsController);

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

// Submit the business for ID verification (requires x-business-id; blocked until
// the Business Readiness gate passes — see computeVerificationReadiness)
router.post('/me/verification/submit', verifyBusinessOwnership, submitVerificationController);

// Admin-only creation
router.post('/', restrictTo('admin'), createBusinessController);

// Update a business profile (Requires x-business-id to ensure ownership, or admin can bypass)
// For simplicity, we just use verifyBusinessOwnership
router.patch('/update', verifyBusinessOwnership, updateBusinessController);

// Admin-only soft delete
router.delete('/:id', restrictTo('admin'), deleteBusinessController);

export default router;
