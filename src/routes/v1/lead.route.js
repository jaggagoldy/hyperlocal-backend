import express from 'express';
import { requireAuth, restrictTo } from '../../middlewares/auth.middleware.js';
import * as leadController from '../../controllers/lead.controller.js';

const router = express.Router();

// Apply auth middleware to all lead routes
router.use(requireAuth);
// Technically, leads are for vendors and admins
router.use(restrictTo('admin', 'vendor'));

router.get('/', leadController.getVendorLeads);
router.patch('/:id/status', leadController.updateLeadStatus);

export default router;
