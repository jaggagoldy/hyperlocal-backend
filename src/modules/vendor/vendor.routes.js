import express from 'express';
import { createVendorController, updateVendorController, deleteVendorController } from './vendor.controller.js';
import { requireAuth, restrictTo } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Apply auth middleware to all vendor routes
router.use(requireAuth);

// Admin-only creation
router.post('/', restrictTo('admin'), createVendorController);

// Vendor/Admin updates
router.patch('/:id', restrictTo('admin', 'vendor'), updateVendorController);

// Admin-only soft delete
router.delete('/:id', restrictTo('admin'), deleteVendorController);

export default router;
