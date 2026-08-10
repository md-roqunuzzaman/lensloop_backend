import { z } from 'zod';

export const createReviewSchema = z.object({
  body: z.object({
    gearItemId: z.string().uuid(),
    rentalOrderId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(5, 'Please write at least a short comment').max(1000),
  }),
});
