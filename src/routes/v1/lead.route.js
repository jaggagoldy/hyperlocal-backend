import express from 'express';
import { requireAuth, restrictTo } from '../../middlewares/auth.middleware.js';
import verifyBusinessOwnership from '../../middlewares/verifyBusinessOwnership.js';
import * as leadController from '../../controllers/lead.controller.js';

const router = express.Router();

// Apply auth middleware to all lead routes
router.use(requireAuth);
// Technically, leads are for vendors and admins
router.use(restrictTo('admin', 'vendor'));
// Confirms the caller owns the business identified by x-business-id/businessId
// before any lead is read or updated — closes the cross-vendor IDOR where a
// caller could pass any business id and read/update another vendor's leads.
router.use(verifyBusinessOwnership);

router.get('/', leadController.getVendorLeads);
router.patch('/:id/status', leadController.updateLeadStatus);

export default router;
