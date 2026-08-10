import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/ApiResponse';
import { reviewService } from './review.service';
import { ApiError } from '../../utils/ApiError';

export const reviewController = {
  create: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const review = await reviewService.create(req.user.userId, req.body);
    sendResponse(res, StatusCodes.CREATED, 'Review submitted', review);
  }),
};
