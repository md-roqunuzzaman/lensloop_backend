import { z } from "zod";

export const createPaymentSchema = z.object({
  body: z.object({
    rentalOrderId: z.string().uuid(),

    method: z.enum(["STRIPE", "SSLCOMMERZ"]),
  }),
});

export const listPaymentsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const paymentIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
