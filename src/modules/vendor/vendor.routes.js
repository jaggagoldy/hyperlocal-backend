import express from 'express';
import {
  createVendorController,
  updateVendorController,
  deleteVendorController,
  registerVendorSelfController,
  getMyVendorProfileController,
  getVendorBySlugController,
} from './vendor.controller.js';
import { requireAuth, restrictTo } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Vendor Dashboard Profile Retrieval
router.get('/my-profile', requireAuth, restrictTo('vendor', 'admin'), getMyVendorProfileController);

// Public route to fetch a vendor profile by slug
router.get('/:slug', getVendorBySlugController);

// Apply auth middleware to all other vendor routes
router.use(requireAuth);

// Vendor Self-Registration (allows regular users to become service providers)
router.post('/register', registerVendorSelfController);

// Admin-only creation
router.post('/', restrictTo('admin'), createVendorController);

// Vendor/Admin updates
router.patch('/:id', restrictTo('admin', 'vendor'), updateVendorController);

// Admin-only soft delete
router.delete('/:id', restrictTo('admin'), deleteVendorController);

export default router;
