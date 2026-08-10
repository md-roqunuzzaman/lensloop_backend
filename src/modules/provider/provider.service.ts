import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { getPagination, makeUniqueSlug } from '../../utils/helpers';

interface CreateGearInput {
  name: string;
  categoryId: string;
  description: string;
  brand?: string;
  images: string[];
  pricePerDay: number;
  stock: number;
  specifications?: Record<string, string>;
}

interface UpdateGearInput extends Partial<CreateGearInput> {
  availableStock?: number;
  isActive?: boolean;
}

// Rental order statuses a provider is allowed to move an order into, and the
// status(es) each transition is valid from.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  CONFIRMED: ['PLACED'],
  CANCELLED: ['PLACED', 'CONFIRMED'],
  PICKED_UP: ['PAID'],
  RETURNED: ['PICKED_UP'],
};

export const providerService = {
  async createGear(providerId: string, data: CreateGearInput) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw ApiError.badRequest('Selected category does not exist');

    return prisma.gearItem.create({
      data: {
        providerId,
        categoryId: data.categoryId,
        name: data.name,
        slug: makeUniqueSlug(data.name),
        description: data.description,
        brand: data.brand,
        images: data.images,
        pricePerDay: data.pricePerDay,
        stock: data.stock,
        availableStock: data.stock,
        specifications: data.specifications ?? {},
      },
    });
  },

  async listMyGear(providerId: string, query: { page?: string; limit?: string }) {
    const { page, limit, skip } = getPagination(query);
    const [items, total] = await Promise.all([
      prisma.gearItem.findMany({
        where: { providerId },
        include: { category: true, _count: { select: { orderItems: true, reviews: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.gearItem.count({ where: { providerId } }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async getOwnedGearOrThrow(providerId: string, gearId: string) {
    const item = await prisma.gearItem.findUnique({ where: { id: gearId } });
    if (!item) throw ApiError.notFound('Gear item not found');
    if (item.providerId !== providerId) throw ApiError.forbidden('You do not own this gear item');
    return item;
  },

  async updateGear(providerId: string, gearId: string, data: UpdateGearInput) {
    await this.getOwnedGearOrThrow(providerId, gearId);
    if (data.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) throw ApiError.badRequest('Selected category does not exist');
    }
    return prisma.gearItem.update({ where: { id: gearId }, data });
  },

  async removeGear(providerId: string, gearId: string) {
    await this.getOwnedGearOrThrow(providerId, gearId);
    const activeOrders = await prisma.rentalOrderItem.count({
      where: {
        gearItemId: gearId,
        rentalOrder: { status: { in: ['PLACED', 'CONFIRMED', 'PAID', 'PICKED_UP'] } },
      },
    });
    if (activeOrders > 0) {
      // Soft delete: keep history intact for active/past rentals.
      return prisma.gearItem.update({ where: { id: gearId }, data: { isActive: false } });
    }
    return prisma.gearItem.delete({ where: { id: gearId } });
  },

  async listIncomingOrders(providerId: string, query: { page?: string; limit?: string; status?: string }) {
    const { page, limit, skip } = getPagination(query);
    const where = {
      items: { some: { gearItem: { providerId } } },
      ...(query.status ? { status: query.status as never } : {}),
    };
    const [orders, total] = await Promise.all([
      prisma.rentalOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          items: { include: { gearItem: true } },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.rentalOrder.count({ where }),
    ]);
    return { items: orders, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async updateOrderStatus(providerId: string, orderId: string, nextStatus: string) {
    const order = await prisma.rentalOrder.findUnique({
      where: { id: orderId },
      include: { items: { include: { gearItem: true } } },
    });
    if (!order) throw ApiError.notFound('Rental order not found');

    const ownsItem = order.items.some((item) => item.gearItem.providerId === providerId);
    if (!ownsItem) throw ApiError.forbidden('This order does not contain any of your gear');

    const allowedFrom = ALLOWED_TRANSITIONS[nextStatus];
    if (!allowedFrom || !allowedFrom.includes(order.status)) {
      throw ApiError.badRequest(`Cannot move order from ${order.status} to ${nextStatus}`);
    }

    return prisma.$transaction(async (tx) => {
      // Restore stock when an order is cancelled or gear is returned.
      if (nextStatus === 'CANCELLED' || nextStatus === 'RETURNED') {
        for (const item of order.items) {
          await tx.gearItem.update({
            where: { id: item.gearItemId },
            data: { availableStock: { increment: item.quantity } },
          });
        }
      }
      return tx.rentalOrder.update({ where: { id: orderId }, data: { status: nextStatus as never } });
    });
  },

  async dashboardStats(providerId: string) {
    const [totalGear, activeGear, pendingOrders, activeRentals, revenueAgg] = await Promise.all([
      prisma.gearItem.count({ where: { providerId } }),
      prisma.gearItem.count({ where: { providerId, isActive: true } }),
      prisma.rentalOrder.count({
        where: { items: { some: { gearItem: { providerId } } }, status: 'PLACED' },
      }),
      prisma.rentalOrder.count({
        where: {
          items: { some: { gearItem: { providerId } } },
          status: { in: ['CONFIRMED', 'PAID', 'PICKED_UP'] },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'COMPLETED',
          rentalOrder: { items: { some: { gearItem: { providerId } } } },
        },
      }),
    ]);

    return {
      totalGear,
      activeGear,
      pendingOrders,
      activeRentals,
      totalRevenue: revenueAgg._sum.amount ?? 0,
    };
  },
};
