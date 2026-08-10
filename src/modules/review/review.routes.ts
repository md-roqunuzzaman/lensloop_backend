import { Router } from 'express';
import { reviewController } from './review.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createReviewSchema } from './review.validation';

const router = Router();

router.post('/', authenticate, authorize('CUSTOMER'), validate(createReviewSchema), reviewController.create);

export default router;
