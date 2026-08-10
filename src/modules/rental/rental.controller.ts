import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/ApiResponse';
import { rentalService } from './rental.service';
import { ApiError } from '../../utils/ApiError';

export const rentalController = {
  create: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const order = await rentalService.create(req.user.userId, req.body);
    sendResponse(res, StatusCodes.CREATED, 'Rental order placed', order);
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { items, meta } = await rentalService.listForCustomer(
      req.user.userId,
      req.query as Record<string, string>,
    );
    sendResponse(res, StatusCodes.OK, 'Rental orders fetched', items, meta);
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const order = await rentalService.getById(req.user.userId, req.params.id, req.user.role);
    sendResponse(res, StatusCodes.OK, 'Rental order fetched', order);
  }),

  cancel: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const order = await rentalService.cancel(req.user.userId, req.params.id);
    sendResponse(res, StatusCodes.OK, 'Rental order cancelled', order);
  }),
};
