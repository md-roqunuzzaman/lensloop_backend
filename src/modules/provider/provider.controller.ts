import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/ApiResponse';
import { providerService } from './provider.service';
import { ApiError } from '../../utils/ApiError';

export const providerController = {
  createGear: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const item = await providerService.createGear(req.user.userId, req.body);
    sendResponse(res, StatusCodes.CREATED, 'Gear item created', item);
  }),

  listMyGear: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { items, meta } = await providerService.listMyGear(
      req.user.userId,
      req.query as Record<string, string>,
    );
    sendResponse(res, StatusCodes.OK, 'Your gear inventory fetched', items, meta);
  }),

  updateGear: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const item = await providerService.updateGear(req.user.userId, req.params.id, req.body);
    sendResponse(res, StatusCodes.OK, 'Gear item updated', item);
  }),

  removeGear: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await providerService.removeGear(req.user.userId, req.params.id);
    sendResponse(res, StatusCodes.OK, 'Gear item removed');
  }),

  listOrders: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { items, meta } = await providerService.listIncomingOrders(
      req.user.userId,
      req.query as Record<string, string>,
    );
    sendResponse(res, StatusCodes.OK, 'Incoming orders fetched', items, meta);
  }),

  updateOrderStatus: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const order = await providerService.updateOrderStatus(req.user.userId, req.params.id, req.body.status);
    sendResponse(res, StatusCodes.OK, 'Order status updated', order);
  }),

  dashboard: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const stats = await providerService.dashboardStats(req.user.userId);
    sendResponse(res, StatusCodes.OK, 'Provider dashboard stats fetched', stats);
  }),
};
