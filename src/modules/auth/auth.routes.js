import express from 'express';
import {
  registerController,
  loginController,
  forgotPasswordController,
  resetPasswordController,
  getMeController,
  checkExistenceController,
  switchContextController,
  addSecondaryProfileController,
} from './auth.controller.js';
import { authLimiter, requireAuth } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Public Authentication Endpoints (password-only)
router.post('/check-existence', authLimiter, checkExistenceController);
router.post('/register', registerController);
router.post('/login', loginController);
router.post('/forgot-password', authLimiter, forgotPasswordController);
router.post('/reset-password', authLimiter, resetPasswordController);

// Protected Authentication Endpoints
router.get('/me', requireAuth, getMeController);
router.post('/switch-context', requireAuth, switchContextController);
router.post('/add-profile', requireAuth, addSecondaryProfileController);

export default router;
