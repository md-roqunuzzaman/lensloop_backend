import { Router } from 'express';
import { gearController } from './gear.controller';
import { validate } from '../../middleware/validate.middleware';
import { gearIdSchema, listGearSchema } from './gear.validation';

const router = Router();

router.get('/', validate(listGearSchema), gearController.list);
router.get('/:id', validate(gearIdSchema), gearController.getById);

export default router;
