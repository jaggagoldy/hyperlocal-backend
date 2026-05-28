import express from 'express';
import { exploreVendorsController, getCitiesController, getCategoriesController } from './search.controller.js';

const router = express.Router();

// Public metadata routes
router.get('/cities', getCitiesController);
router.get('/categories', getCategoriesController);

// Public exploration route
router.get('/explore/:citySlug/:categorySlug', exploreVendorsController);

export default router;
