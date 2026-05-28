import express from 'express';
import {
  createVendorController,
  updateVendorController,
  deleteVendorController,
  registerVendorSelfController,
  getMyVendorProfileController,
} from './vendor.controller.js';
import { requireAuth, restrictTo } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Apply auth middleware to all vendor routes
router.use(requireAuth);

// Vendor Self-Registration (allows regular users to become service providers)
router.post('/register', registerVendorSelfController);

// Vendor Dashboard Profile Retrieval
router.get('/my-profile', restrictTo('vendor', 'admin'), getMyVendorProfileController);

// Admin-only creation
router.post('/', restrictTo('admin'), createVendorController);

// Vendor/Admin updates
router.patch('/:id', restrictTo('admin', 'vendor'), updateVendorController);

// Admin-only soft delete
router.delete('/:id', restrictTo('admin'), deleteVendorController);

export default router;
