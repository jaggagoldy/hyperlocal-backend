import express from 'express';
import { updateProfileController, changePasswordController, deleteMeController } from './user.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.put('/me', requireAuth, updateProfileController);
router.delete('/me', requireAuth, deleteMeController);
router.post('/change-password', requireAuth, changePasswordController);

export default router;
