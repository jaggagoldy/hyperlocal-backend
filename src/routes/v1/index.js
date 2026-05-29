import express from 'express';
import authRoutes from '../../modules/auth/auth.routes.js';
import vendorRoutes from '../../modules/vendor/vendor.routes.js';
import searchRoutes from '../../modules/search/search.routes.js';
import adminRoutes from '../../modules/admin/admin.routes.js';
import analyticsRoutes from '../../modules/analytics/analytics.routes.js';
import mediaRoutes from '../../modules/media/media.routes.js';
import feedbackRoutes from '../../modules/feedback/feedback.routes.js';
import userRoutes from '../../modules/users/user.routes.js';
import catalogRoutes from './catalog.route.js';
import leadRoutes from './lead.route.js';
import superadminRoutes from '../../modules/superadmin/superadmin.routes.js';

const router = express.Router();

// Mock routes for now to ensure initialization passes
router.get('/ping', (req, res) => res.send('pong'));

router.use('/auth', authRoutes);
router.use('/vendors', vendorRoutes);
router.use('/search', searchRoutes);
router.use('/admin', adminRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/media', mediaRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/users', userRoutes);
router.use('/catalog', catalogRoutes);
router.use('/leads', leadRoutes);
router.use('/superadmin', superadminRoutes);

export default router;
