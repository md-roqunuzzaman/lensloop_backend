import { z } from "zod";

export const createBlogSchema = z.object({
  body: z.object({
    title: z
      .string()
      .trim()
      .min(5, "Title must be at least 5 characters")
      .max(200),
    slug: z.string().trim().min(3).max(200).optional(), // auto-generate if not provided
    excerpt: z
      .string()
      .trim()
      .min(10, "Excerpt must be at least 10 characters")
      .max(300),
    content: z
      .string()
      .trim()
      .min(50, "Content must be at least 50 characters"),
    coverImage: z.string().url("Must be a valid image URL").optional(),
    category: z.string().trim().min(2).max(60),
    tags: z.array(z.string()).optional(),
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  }),
});

export const updateBlogSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().trim().min(5).max(200).optional(),
    slug: z.string().trim().min(3).max(200).optional(),
    excerpt: z.string().trim().min(10).max(300).optional(),
    content: z.string().trim().min(50).optional(),
    coverImage: z.string().url().optional(),
    category: z.string().trim().min(2).max(60).optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  }),
});

export const blogIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const blogSlugParamSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
});

export const listPublicBlogSchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      category: z.string().optional(),
      search: z.string().optional(),
    })
    .optional(),
});

export const listAdminBlogSchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
      search: z.string().optional(),
    })
    .optional(),
});
