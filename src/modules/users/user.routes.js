import express from 'express';
import { updateProfileController, changePasswordController } from './user.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.put('/me', requireAuth, updateProfileController);
router.post('/change-password', requireAuth, changePasswordController);

export default router;
