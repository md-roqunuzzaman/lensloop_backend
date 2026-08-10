import { Router } from 'express';
import { rentalController } from './rental.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createRentalSchema, listRentalsSchema, rentalIdSchema } from './rental.validation';

const router = Router();

router.use(authenticate);

router.post('/', authorize('CUSTOMER'), validate(createRentalSchema), rentalController.create);
router.get('/', authorize('CUSTOMER'), validate(listRentalsSchema), rentalController.list);
router.get('/:id', validate(rentalIdSchema), rentalController.getById);
router.patch('/:id/cancel', authorize('CUSTOMER'), validate(rentalIdSchema), rentalController.cancel);

export default router;
