import express from 'express';
import { requestOtpController, verifyOtpController } from './auth.controller.js';
import { authLimiter } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Apply authLimiter strictly clamping down on entry routes
router.use(authLimiter);

router.post('/otp/request', requestOtpController);
router.post('/otp/verify', verifyOtpController);

export default router;
