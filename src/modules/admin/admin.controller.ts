import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/ApiResponse';
import { adminService } from './admin.service';

export const adminController = {
  listUsers: catchAsync(async (req: Request, res: Response) => {
    const { items, meta } = await adminService.listUsers(req.query as Record<string, string>);
    sendResponse(res, StatusCodes.OK, 'Users fetched', items, meta);
  }),

  updateUserStatus: catchAsync(async (req: Request, res: Response) => {
    const user = await adminService.updateUserStatus(req.params.id, req.body.status);
    sendResponse(res, StatusCodes.OK, 'User status updated', user);
  }),

  listGear: catchAsync(async (req: Request, res: Response) => {
    const { items, meta } = await adminService.listGear(req.query as Record<string, string>);
    sendResponse(res, StatusCodes.OK, 'Gear listings fetched', items, meta);
  }),

  toggleGearActive: catchAsync(async (req: Request, res: Response) => {
    const item = await adminService.toggleGearActive(req.params.id, req.body.isActive);
    sendResponse(res, StatusCodes.OK, 'Gear listing updated', item);
  }),

  listRentals: catchAsync(async (req: Request, res: Response) => {
    const { items, meta } = await adminService.listRentals(req.query as Record<string, string>);
    sendResponse(res, StatusCodes.OK, 'Rental orders fetched', items, meta);
  }),

  dashboard: catchAsync(async (_req: Request, res: Response) => {
    const stats = await adminService.dashboardStats();
    sendResponse(res, StatusCodes.OK, 'Admin dashboard stats fetched', stats);
  }),
};
