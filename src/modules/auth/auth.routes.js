import express from 'express';
import {
  verifyOtpController,
  registerController,
  loginController,
  googleLoginController,
  forgotPasswordController,
  resetPasswordController,
  getMeController,
  checkExistenceController,
  onboardController,
  switchContextController,
  addSecondaryProfileController,
} from './auth.controller.js';
import { authLimiter, requireAuth } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Public Authentication Endpoints
router.post('/check-existence', authLimiter, checkExistenceController);
router.post('/otp/verify', authLimiter, verifyOtpController);
router.post('/onboard', onboardController);
router.post('/register', registerController);
router.post('/login', loginController);
router.post('/google', googleLoginController);
router.post('/forgot-password', authLimiter, forgotPasswordController);
router.post('/reset-password', authLimiter, resetPasswordController);

// Protected Authentication Endpoints
router.get('/me', requireAuth, getMeController);
router.post('/switch-context', requireAuth, switchContextController);
router.post('/add-profile', requireAuth, addSecondaryProfileController);

export default router;
