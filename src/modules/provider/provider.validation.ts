import { z } from 'zod';

export const createGearSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(150),
    categoryId: z.string().uuid('A valid category must be selected'),
    description: z.string().trim().min(10).max(2000),
    brand: z.string().trim().max(80).optional(),
    images: z.array(z.string().url()).min(1, 'At least one image is required').max(8),
    pricePerDay: z.number().positive('Price must be greater than 0'),
    stock: z.number().int().min(1, 'Stock must be at least 1'),
    specifications: z.record(z.string()).optional(),
  }),
});

export const updateGearSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(2).max(150).optional(),
    categoryId: z.string().uuid().optional(),
    description: z.string().trim().min(10).max(2000).optional(),
    brand: z.string().trim().max(80).optional(),
    images: z.array(z.string().url()).min(1).max(8).optional(),
    pricePerDay: z.number().positive().optional(),
    stock: z.number().int().min(0).optional(),
    availableStock: z.number().int().min(0).optional(),
    specifications: z.record(z.string()).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const gearIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const listProviderGearSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['CONFIRMED', 'CANCELLED', 'PICKED_UP', 'RETURNED']),
  }),
});
