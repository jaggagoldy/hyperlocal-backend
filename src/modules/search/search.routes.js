import express from 'express';
import { exploreVendorsController, getCitiesController, getCategoriesController } from './search.controller.js';
import { autocompleteController } from './search.autocomplete.js';

const router = express.Router();

// Public metadata routes
router.get('/cities', getCitiesController);
router.get('/categories', getCategoriesController);

// Discovery autocomplete (Sprint 2 · Batch 1) — declared before the
// param-catching explore route below so it's never shadowed.
router.get('/autocomplete', autocompleteController);

// Public exploration route
router.get('/explore/:citySlug/:categorySlug', exploreVendorsController);

export default router;
