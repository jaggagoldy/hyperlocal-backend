import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, restrictTo } from '../../middlewares/auth.middleware.js';
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
router.post('/enquire', enquireLimiter, catalogController.enquireCatalogItem);

router.post(
  '/',
  requireAuth,
  restrictTo('admin', 'vendor'),
  uploadMedia.single('media'),
  catalogController.createCatalogItem
);

router.get(
  '/vendor/:vendorId',
  catalogController.getVendorCatalog
);

router.patch(
  '/:id',
  requireAuth,
  restrictTo('admin', 'vendor'),
  uploadMedia.single('media'),
  catalogController.updateCatalogItem
);

router.delete(
  '/:id',
  requireAuth,
  restrictTo('admin', 'vendor'),
  catalogController.deleteCatalogItem
);

export default router;
