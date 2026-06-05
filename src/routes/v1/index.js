import express from 'express';
import authRoutes from '../../modules/auth/auth.routes.js';
import businessRoutes from '../../modules/business/business.routes.js';
import searchRoutes from '../../modules/search/search.routes.js';
import adminRoutes from '../../modules/admin/admin.routes.js';
import analyticsRoutes from '../../modules/analytics/analytics.routes.js';
import mediaRoutes from '../../modules/media/media.routes.js';
import feedbackRoutes from '../../modules/feedback/feedback.routes.js';
import userRoutes from '../../modules/users/user.routes.js';
import catalogRoutes from './catalog.route.js';
import leadRoutes from './lead.route.js';
import orderRoutes from './order.route.js';
import reviewRoutes from '../../modules/reviews/review.routes.js';
import superadminRoutes from '../../modules/superadmin/superadmin.routes.js';

const router = express.Router();

// Mock routes for now to ensure initialization passes
router.get('/ping', (req, res) => res.send('pong'));

router.use('/auth', authRoutes);
router.use('/business', businessRoutes);
router.use('/search', searchRoutes);
router.use('/admin', adminRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/media', mediaRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/users', userRoutes);
router.use('/catalog', catalogRoutes);
router.use('/leads', leadRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/superadmin', superadminRoutes);

export default router;
