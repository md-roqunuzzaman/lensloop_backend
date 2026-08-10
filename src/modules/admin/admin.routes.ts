import { Router } from 'express';
import { z } from 'zod';
import { adminController } from './admin.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { listGearSchema, listRentalsSchema, listUsersSchema, updateUserStatusSchema } from './admin.validation';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', adminController.dashboard);

router.get('/users', validate(listUsersSchema), adminController.listUsers);
router.patch('/users/:id', validate(updateUserStatusSchema), adminController.updateUserStatus);

router.get('/gear', validate(listGearSchema), adminController.listGear);
router.patch(
  '/gear/:id',
  validate(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ isActive: z.boolean() }) })),
  adminController.toggleGearActive,
);

router.get('/rentals', validate(listRentalsSchema), adminController.listRentals);

export default router;
