import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/ApiResponse';
import { authService } from './auth.service';
import { ApiError } from '../../utils/ApiError';

export const authController = {
  register: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    sendResponse(res, StatusCodes.CREATED, 'Registration successful', result);
  }),

  login: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    sendResponse(res, StatusCodes.OK, 'Login successful', result);
  }),

  refresh: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body.refreshToken);
    sendResponse(res, StatusCodes.OK, 'Token refreshed', result);
  }),

  me: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const user = await authService.me(req.user.userId);
    sendResponse(res, StatusCodes.OK, 'Current user fetched', user);
  }),
};
