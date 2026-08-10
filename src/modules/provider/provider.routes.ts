import { Router } from 'express';
import { providerController } from './provider.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createGearSchema,
  gearIdParamSchema,
  listProviderGearSchema,
  updateGearSchema,
  updateOrderStatusSchema,
} from './provider.validation';

const router = Router();

router.use(authenticate, authorize('PROVIDER'));

router.get('/dashboard', providerController.dashboard);

router.post('/gear', validate(createGearSchema), providerController.createGear);
router.get('/gear', validate(listProviderGearSchema), providerController.listMyGear);
router.put('/gear/:id', validate(updateGearSchema), providerController.updateGear);
router.delete('/gear/:id', validate(gearIdParamSchema), providerController.removeGear);

router.get('/orders', providerController.listOrders);
router.patch('/orders/:id', validate(updateOrderStatusSchema), providerController.updateOrderStatus);

export default router;
