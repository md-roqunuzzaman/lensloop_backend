import { Router } from 'express';
import { userController } from './user.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { changePasswordSchema, updateProfileSchema } from './user.validation';

const router = Router();

router.use(authenticate);
router.put('/me', validate(updateProfileSchema), userController.updateProfile);
router.put('/me/password', validate(changePasswordSchema), userController.changePassword);

export default router;
