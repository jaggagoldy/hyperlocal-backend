import express from 'express';
import {
  registerController,
  loginController,
  forgotPasswordController,
  resetPasswordController,
  getMeController,
  checkExistenceController,
} from './auth.controller.js';
import { authLimiter, requireAuth } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Public Authentication Endpoints (password-only, single-role)
router.post('/check-existence', authLimiter, checkExistenceController);
router.post('/register', authLimiter, registerController);
router.post('/login', authLimiter, loginController);
router.post('/forgot-password', authLimiter, forgotPasswordController);
router.post('/reset-password', authLimiter, resetPasswordController);

// Protected Authentication Endpoints
router.get('/me', requireAuth, getMeController);

export default router;
