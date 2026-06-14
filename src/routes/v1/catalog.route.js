import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, optionalAuth } from '../../middlewares/auth.middleware.js';
import verifyBusinessOwnership from '../../middlewares/verifyBusinessOwnership.js';
import { uploadMedia } from '../../middlewares/multer.js';
import * as catalogController from '../../controllers/catalog.controller.js';

const router = express.Router();

const enquireLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // Limit each IP to 3 requests per windowMs
  message: {
    status: 'error',
    message: 'Too many inquiries from this IP, please try again after 10 minutes',
  },
});

router.get('/explore', catalogController.exploreCatalogItems);
router.get('/business/:businessId', catalogController.getBusinessCatalog);
router.get('/', catalogController.getBusinessCatalog);
router.get('/:id', catalogController.getCatalogItemById);
router.post('/enquire', optionalAuth, enquireLimiter, catalogController.enquireCatalogItem);

// Protected Routes (Require business ownership)
router.use(requireAuth);
router.use(verifyBusinessOwnership);

router.post(
  '/',
  uploadMedia.single('media'),
  catalogController.createCatalogItem
);

router.patch(
  '/:id',
  uploadMedia.single('media'),
  catalogController.updateCatalogItem
);

router.delete(
  '/:id',
  catalogController.deleteCatalogItem
);

export default router;
