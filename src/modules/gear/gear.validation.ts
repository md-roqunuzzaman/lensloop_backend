import { z } from 'zod';

export const listGearSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    category: z.string().uuid().optional(),
    brand: z.string().trim().optional(),
    minPrice: z.string().optional(),
    maxPrice: z.string().optional(),
    search: z.string().trim().optional(),
    available: z.enum(['true', 'false']).optional(),
    sort: z.enum(['price_asc', 'price_desc', 'newest', 'rating']).optional(),
  }),
});

export const gearIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
