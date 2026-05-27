import express from 'express';
import { exploreVendorsController } from './search.controller.js';

const router = express.Router();

// Public exploration route
router.get('/explore/:citySlug/:categorySlug', exploreVendorsController);

export default router;
