import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/ApiResponse';
import { categoryService } from './category.service';

export const categoryController = {
  getAll: catchAsync(async (_req: Request, res: Response) => {
    const categories = await categoryService.getAll();
    sendResponse(res, StatusCodes.OK, 'Categories fetched', categories);
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const category = await categoryService.getById(req.params.id);
    sendResponse(res, StatusCodes.OK, 'Category fetched', category);
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const category = await categoryService.create(req.body);
    sendResponse(res, StatusCodes.CREATED, 'Category created', category);
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const category = await categoryService.update(req.params.id, req.body);
    sendResponse(res, StatusCodes.OK, 'Category updated', category);
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    await categoryService.remove(req.params.id);
    sendResponse(res, StatusCodes.OK, 'Category deleted');
  }),
};
