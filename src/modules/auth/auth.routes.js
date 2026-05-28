import express from 'express';
import {
  requestOtpController,
  verifyOtpController,
  registerController,
  loginController,
  googleLoginController,
  forgotPasswordController,
  resetPasswordController,
  getMeController,
} from './auth.controller.js';
import { authLimiter, requireAuth } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Public Authentication Endpoints
router.post('/otp/request', authLimiter, requestOtpController);
router.post('/otp/verify', authLimiter, verifyOtpController);
router.post('/register', registerController);
router.post('/login', loginController);
router.post('/google', googleLoginController);
router.post('/forgot-password', authLimiter, forgotPasswordController);
router.post('/reset-password', authLimiter, resetPasswordController);

// Protected Authentication Endpoints
router.get('/me', requireAuth, getMeController);

export default router;
