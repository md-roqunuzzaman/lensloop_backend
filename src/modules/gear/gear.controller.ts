import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/ApiResponse';
import { gearService } from './gear.service';

export const gearController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const { items, meta } = await gearService.list(req.query as Record<string, string>);
    sendResponse(res, StatusCodes.OK, 'Gear items fetched', items, meta);
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const item = await gearService.getById(req.params.id);
    sendResponse(res, StatusCodes.OK, 'Gear item fetched', item);
  }),
};
