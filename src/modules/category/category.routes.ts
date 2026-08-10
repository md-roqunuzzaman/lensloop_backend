import { Router } from 'express';
import { categoryController } from './category.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createCategorySchema, idParamSchema, updateCategorySchema } from './category.validation';

const router = Router();

// Public
router.get('/', categoryController.getAll);
router.get('/:id', validate(idParamSchema), categoryController.getById);

// Admin only
router.post('/', authenticate, authorize('ADMIN'), validate(createCategorySchema), categoryController.create);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateCategorySchema), categoryController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), validate(idParamSchema), categoryController.remove);

export default router;
