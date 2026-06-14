import express from 'express';
import { getCategoriesController } from '../../controllers/category.controller.js';

const router = express.Router();

router.get('/', getCategoriesController);

export default router;
