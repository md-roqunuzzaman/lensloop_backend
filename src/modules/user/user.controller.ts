import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/ApiResponse';
import { userService } from './user.service';
import { ApiError } from '../../utils/ApiError';

export const userController = {
  updateProfile: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const user = await userService.updateProfile(req.user.userId, req.body);
    sendResponse(res, StatusCodes.OK, 'Profile updated', user);
  }),

  changePassword: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await userService.changePassword(req.user.userId, req.body.currentPassword, req.body.newPassword);
    sendResponse(res, StatusCodes.OK, 'Password changed successfully');
  }),
};
