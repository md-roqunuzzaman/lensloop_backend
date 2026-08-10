import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { getPagination } from '../../utils/helpers';

interface GearQuery {
  page?: string;
  limit?: string;
  category?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  search?: string;
  available?: string;
  sort?: string;
}

export const gearService = {
  async list(query: GearQuery) {
    const { page, limit, skip } = getPagination(query);

    const where: Prisma.GearItemWhereInput = { isActive: true };
    if (query.category) where.categoryId = query.category;
    if (query.brand) where.brand = { equals: query.brand, mode: 'insensitive' };
    if (query.available === 'true') where.availableStock = { gt: 0 };
    if (query.minPrice || query.maxPrice) {
      where.pricePerDay = {
        ...(query.minPrice ? { gte: Number(query.minPrice) } : {}),
        ...(query.maxPrice ? { lte: Number(query.maxPrice) } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { brand: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: Prisma.GearItemOrderByWithRelationInput = { createdAt: 'desc' };
    if (query.sort === 'price_asc') orderBy = { pricePerDay: 'asc' };
    if (query.sort === 'price_desc') orderBy = { pricePerDay: 'desc' };
    if (query.sort === 'newest') orderBy = { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      prisma.gearItem.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: true,
          provider: { select: { id: true, name: true } },
          reviews: { select: { rating: true } },
        },
      }),
      prisma.gearItem.count({ where }),
    ]);

    const withRating = items.map((item) => {
      const ratings = item.reviews.map((r) => r.rating);
      const avgRating = ratings.length
        ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
        : null;
      const { reviews, ...rest } = item;
      return { ...rest, avgRating, reviewCount: ratings.length };
    });

    return {
      items: withRating,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getById(id: string) {
    const item = await prisma.gearItem.findUnique({
      where: { id },
      include: {
        category: true,
        provider: { select: { id: true, name: true, email: true, phone: true } },
        reviews: {
          include: { customer: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!item || !item.isActive) throw ApiError.notFound('Gear item not found');

    const ratings = item.reviews.map((r) => r.rating);
    const avgRating = ratings.length
      ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
      : null;

    // Fetch related items from the same category
    const related = await prisma.gearItem.findMany({
      where: { categoryId: item.categoryId, isActive: true, id: { not: id } },
      take: 4,
      include: { category: true },
    });

    return { ...item, avgRating, reviewCount: ratings.length, related };
  },
};
