import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { upload } from './upload.middleware';

const router = Router();

/**
 * Local-disk image upload used for gear photos and avatars during
 * development. Swap the storage engine (e.g. to Cloudinary/S3) for
 * production without changing the route contract: it always returns
 * { url } for each uploaded file.
 */
router.post(
  '/',
  authenticate,
  authorize('PROVIDER', 'CUSTOMER', 'ADMIN'),
  upload.array('images', 8),
  catchAsync(async (req, res) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) throw ApiError.badRequest('No files were uploaded');
    const urls = files.map((f) => `/uploads/${f.filename}`);
    sendResponse(res, StatusCodes.CREATED, 'Files uploaded', { urls });
  }),
);

export default router;
