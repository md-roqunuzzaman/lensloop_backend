import { Router } from 'express';
import { blogController } from './blog.controller';
import { validate } from '../../middleware/validate.middleware';
import { blogSlugParamSchema, listPublicBlogSchema } from './blog.validation';

const router = Router();

// Public — only ever returns isPublished posts (enforced in the service layer)
router.get('/', validate(listPublicBlogSchema), blogController.listPublic);
router.get('/:slug', validate(blogSlugParamSchema), blogController.getBySlug);

export default router;
