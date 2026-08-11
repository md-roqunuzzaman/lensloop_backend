import { z } from "zod";

export const listUsersSchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
      status: z.enum(["ACTIVE", "INACTIVE", "BANNED"]).optional(),
    })
    .optional(),
});

export const updateUserStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(["ACTIVE", "INACTIVE", "BANNED"]),
  }),
});

export const listGearSchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      category: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
});

export const toggleGearActiveSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ isActive: z.boolean() }),
});

export const listRentalsSchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      status: z.string().optional(),
      customerId: z.string().optional(),
    })
    .optional(),
});
