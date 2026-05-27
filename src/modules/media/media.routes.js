import express from 'express';
import { uploadMediaController, deleteMediaController } from './media.controller.js';
import { requireAuth, restrictTo } from '../../middlewares/auth.middleware.js';
import { uploadMedia } from '../../middlewares/multer.js';

const router = express.Router();

// Enforce auth barrier
router.use(requireAuth);

// Upload endpoint mapping the multer memory buffer array ('file' is the multipart key)
// Restricted to vendors or admins
router.post('/upload', restrictTo('vendor', 'admin'), uploadMedia.single('file'), uploadMediaController);

// Delete endpoint
router.post('/delete', restrictTo('vendor', 'admin'), deleteMediaController);

export default router;
