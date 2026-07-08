import express from 'express';
import { uploadMediaController, deleteMediaController } from './media.controller.js';
import { requireAuth, restrictTo } from '../../middlewares/auth.middleware.js';
import { uploadMedia } from '../../middlewares/multer.js';
import verifyBusinessOwnership from '../../middlewares/verifyBusinessOwnership.js';

const router = express.Router();

// Enforce auth barrier
router.use(requireAuth);

// Upload endpoint mapping the multer memory buffer array ('file' is the multipart key)
// Restricted to vendors or admins. verifyBusinessOwnership runs after multer so the
// 'vendorId' form field is already parsed into req.body, and confirms the caller
// actually owns that business before any write happens.
router.post('/upload', restrictTo('vendor', 'admin'), uploadMedia.single('file'), verifyBusinessOwnership, uploadMediaController);

// Delete endpoint
router.post('/delete', restrictTo('vendor', 'admin'), verifyBusinessOwnership, deleteMediaController);

export default router;
