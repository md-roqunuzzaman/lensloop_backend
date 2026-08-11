import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { getPagination, makeUniqueSlug } from "../../utils/helpers";

interface CreateBlogInput {
  title: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  category: string;
}

export const blogService = {
  // ---------- Admin ----------
  async create(authorId: string, data: CreateBlogInput) {
    return prisma.blogPost.create({
      data: {
        ...data,
        authorId,
        slug: makeUniqueSlug(data.title),
      },
    });
  },

  async listAdmin(query: {
    page?: string;
    limit?: string;
    status?: "DRAFT" | "PUBLISHED";
  }) {
    const { page, limit, skip } = getPagination(query);

    const where: Prisma.BlogPostWhereInput = {};

    if (query.status === "DRAFT") {
      where.isPublished = false;
    }

    if (query.status === "PUBLISHED") {
      where.isPublished = true;
    }

    const [items, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),

      prisma.blogPost.count({
        where,
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getByIdAdmin(id: string) {
    const post = await prisma.blogPost.findUnique({
      where: { id },
      include: { author: { select: { id: true, name: true } } },
    });
    if (!post) throw ApiError.notFound("Blog post not found");
    return post;
  },

  async update(id: string, data: Partial<CreateBlogInput>) {
    await this.getByIdAdmin(id);
    const payload: Prisma.BlogPostUpdateInput = { ...data };
    if (data.title) payload.slug = makeUniqueSlug(data.title);
    return prisma.blogPost.update({ where: { id }, data: payload });
  },

  async setPublished(id: string, isPublished: boolean) {
    await this.getByIdAdmin(id);
    return prisma.blogPost.update({
      where: { id },
      data: { isPublished, publishedAt: isPublished ? new Date() : null },
    });
  },

  async remove(id: string) {
    await this.getByIdAdmin(id);
    await prisma.blogPost.delete({ where: { id } });
  },

  // ---------- Public ----------
  async listPublic(query: {
    page?: string;
    limit?: string;
    category?: string;
    search?: string;
  }) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.BlogPostWhereInput = { isPublished: true };
    if (query.category)
      where.category = { equals: query.category, mode: "insensitive" };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { excerpt: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          category: true,
          publishedAt: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
        },
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.blogPost.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getBySlug(slug: string) {
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      include: { author: { select: { id: true, name: true, avatar: true } } },
    });
    if (!post || !post.isPublished)
      throw ApiError.notFound("Blog post not found");

    const related = await prisma.blogPost.findMany({
      where: {
        category: post.category,
        isPublished: true,
        id: { not: post.id },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        category: true,
        publishedAt: true,
      },
      take: 3,
    });

    return { ...post, related };
  },
};
