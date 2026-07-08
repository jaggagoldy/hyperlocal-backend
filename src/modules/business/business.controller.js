import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import {
  createBusinessProfile,
  updateBusinessProfile,
  softDeleteBusinessProfile,
  registerBusinessSelf,
  getMyBusinesses,
  getBusinessDashboardData,
  getBusinessBySlug,
  submitVerificationRequest,
  findPotentialDuplicates,
  getSitemapSlugs,
} from '../../services/business.service.js';
import { initiateClaim, verifyClaim, upgradeTier } from '../../services/claim.service.js';
import { createAuthResult } from '../../services/auth.service.js';
import prisma from '../../config/prisma.js';
import { sendSuccess } from '../../utils/responseHandler.js';

export const getBusinessBySlugController = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const business = await getBusinessBySlug(slug);
  sendSuccess(res, StatusCodes.OK, 'Business fetched successfully', business);
});

export const createBusinessController = catchAsync(async (req, res) => {
  const business = await createBusinessProfile(req.body);
  sendSuccess(res, StatusCodes.CREATED, 'Business created successfully', business);
});

export const updateBusinessController = catchAsync(async (req, res) => {
  // Use the business ID attached by verifyBusinessOwnership middleware
  const businessId = req.business.id;
  const business = await updateBusinessProfile(businessId, req.body);
  sendSuccess(res, StatusCodes.OK, 'Business updated successfully', business);
});

export const deleteBusinessController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await softDeleteBusinessProfile(id);
  sendSuccess(res, StatusCodes.OK, 'Business deleted successfully', result);
});

// Sprint 3 Batch 2: check for existing (possibly unclaimed) businesses that
// might be the same one, before a vendor self-registers a new listing.
export const checkPotentialDuplicatesController = catchAsync(async (req, res) => {
  const { businessName, district, pincode, state } = req.query;
  const candidates = await findPotentialDuplicates({ businessName, district, pincode, state });
  sendSuccess(res, StatusCodes.OK, 'Potential duplicates fetched successfully', candidates);
});

// Sprint 3 Batch 4: public, unauthenticated — consumed by the frontend's
// sitemap.ts build/revalidate step, not by any logged-in user.
export const getSitemapSlugsController = catchAsync(async (req, res) => {
  const slugs = await getSitemapSlugs();
  sendSuccess(res, StatusCodes.OK, 'Sitemap slugs fetched successfully', slugs);
});

// Self-register a new business profile
export const registerBusinessSelfController = catchAsync(async (req, res) => {
  const business = await registerBusinessSelf(req.user.id, req.body);
  // registerBusinessSelf flips the user to a vendor profile; issue a fresh token
  // reflecting that so the client can enter the dashboard immediately and enable
  // the customer↔business switcher. Business fields stay top-level for back-compat.
  const freshUser = await prisma.user.findUnique({ where: { id: req.user.id } });
  const auth = freshUser ? createAuthResult(freshUser) : {};
  sendSuccess(res, StatusCodes.CREATED, 'Business profile registered successfully', { ...business, ...auth });
});

// Retrieve all businesses for the logged in user
export const getMyBusinessesController = catchAsync(async (req, res) => {
  const businesses = await getMyBusinesses(req.user.id);
  sendSuccess(res, StatusCodes.OK, 'Businesses fetched successfully', businesses);
});

// Retrieve dashboard data for a specific business
export const getBusinessDashboardController = catchAsync(async (req, res) => {
  // Extract businessId attached by verifyBusinessOwnership middleware
  const businessId = req.business.id;
  const result = await getBusinessDashboardData(businessId);
  sendSuccess(res, StatusCodes.OK, 'Dashboard data fetched successfully', result);
});

// Submit the business for ID verification (Sprint 2 Batch 2).
export const submitVerificationController = catchAsync(async (req, res) => {
  const businessId = req.business.id;
  const business = await submitVerificationRequest(businessId);
  sendSuccess(res, StatusCodes.OK, 'Verification request submitted successfully', business);
});

// --- Phase F: claim an unclaimed (imported) listing, then upgrade its tier ---

export const initiateClaimController = catchAsync(async (req, res) => {
  const result = await initiateClaim(req.params.id, req.user, req.body?.phone);
  sendSuccess(res, StatusCodes.OK, 'Verification code sent', result);
});

export const verifyClaimController = catchAsync(async (req, res) => {
  const business = await verifyClaim(req.params.id, req.user, req.body?.code);
  sendSuccess(res, StatusCodes.OK, 'Listing claimed successfully', business);
});

export const upgradeTierController = catchAsync(async (req, res) => {
  const business = await upgradeTier(req.params.id, req.user, req.body?.listingTier);
  sendSuccess(res, StatusCodes.OK, 'Listing tier updated', business);
});
