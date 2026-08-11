import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/ApiResponse';
import { blogService } from './blog.service';
import { ApiError } from '../../utils/ApiError';

export const blogController = {
  // Admin
  create: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const post = await blogService.create(req.user.userId, req.body);
    sendResponse(res, StatusCodes.CREATED, 'Blog post created as draft', post);
  }),

  listAdmin: catchAsync(async (req: Request, res: Response) => {
    const { items, meta } = await blogService.listAdmin(req.query as Record<string, string>);
    sendResponse(res, StatusCodes.OK, 'Blog posts fetched', items, meta);
  }),

  getByIdAdmin: catchAsync(async (req: Request, res: Response) => {
    const post = await blogService.getByIdAdmin(req.params.id);
    sendResponse(res, StatusCodes.OK, 'Blog post fetched', post);
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const post = await blogService.update(req.params.id, req.body);
    sendResponse(res, StatusCodes.OK, 'Blog post updated', post);
  }),

  publish: catchAsync(async (req: Request, res: Response) => {
    const post = await blogService.setPublished(req.params.id, true);
    sendResponse(res, StatusCodes.OK, 'Blog post published', post);
  }),

  unpublish: catchAsync(async (req: Request, res: Response) => {
    const post = await blogService.setPublished(req.params.id, false);
    sendResponse(res, StatusCodes.OK, 'Blog post moved back to draft', post);
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    await blogService.remove(req.params.id);
    sendResponse(res, StatusCodes.OK, 'Blog post deleted');
  }),

  // Public
  listPublic: catchAsync(async (req: Request, res: Response) => {
    const { items, meta } = await blogService.listPublic(req.query as Record<string, string>);
    sendResponse(res, StatusCodes.OK, 'Blog posts fetched', items, meta);
  }),

  getBySlug: catchAsync(async (req: Request, res: Response) => {
    const post = await blogService.getBySlug(req.params.slug);
    sendResponse(res, StatusCodes.OK, 'Blog post fetched', post);
  }),
};
