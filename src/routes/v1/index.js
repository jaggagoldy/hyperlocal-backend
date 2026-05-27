import express from 'express';
import authRoutes from '../../modules/auth/auth.routes.js';
import vendorRoutes from '../../modules/vendor/vendor.routes.js';
import searchRoutes from '../../modules/search/search.routes.js';
import adminRoutes from '../../modules/admin/admin.routes.js';
import analyticsRoutes from '../../modules/analytics/analytics.routes.js';
import mediaRoutes from '../../modules/media/media.routes.js';

const router = express.Router();

// Mock routes for now to ensure initialization passes
router.get('/ping', (req, res) => res.send('pong'));

router.use('/auth', authRoutes);
router.use('/vendors', vendorRoutes);
router.use('/search', searchRoutes);
router.use('/admin', adminRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/media', mediaRoutes);

export default router;
