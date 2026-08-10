import { z } from 'zod';

export const createRentalSchema = z.object({
  body: z
    .object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      notes: z.string().trim().max(500).optional(),
      items: z
        .array(
          z.object({
            gearItemId: z.string().uuid(),
            quantity: z.number().int().min(1).max(20),
          }),
        )
        .min(1, 'At least one gear item is required'),
    })
    .refine((data) => data.endDate > data.startDate, {
      message: 'End date must be after start date',
      path: ['endDate'],
    })
    .refine((data) => data.startDate >= new Date(new Date().toDateString()), {
      message: 'Start date cannot be in the past',
      path: ['startDate'],
    }),
});

export const listRentalsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.enum(['PLACED', 'CONFIRMED', 'CANCELLED', 'PAID', 'PICKED_UP', 'RETURNED']).optional(),
  }),
});

export const rentalIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
