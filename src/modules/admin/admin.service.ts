import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { getPagination } from '../../utils/helpers';

export const adminService = {
  async listUsers(query: { page?: string; limit?: string; role?: string; search?: string }) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role as never;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, role: true, status: true, phone: true,
          avatar: true, createdAt: true,
          _count: { select: { gearItems: true, rentalOrders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async updateUserStatus(id: string, status: 'ACTIVE' | 'SUSPENDED') {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('User not found');
    if (user.role === 'ADMIN') throw ApiError.badRequest('Admin accounts cannot be suspended');
    return prisma.user.update({ where: { id }, data: { status } });
  },

  async listGear(query: { page?: string; limit?: string; search?: string }) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.GearItemWhereInput = query.search
      ? { name: { contains: query.search, mode: 'insensitive' } }
      : {};
    const [items, total] = await Promise.all([
      prisma.gearItem.findMany({
        where,
        include: { category: true, provider: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.gearItem.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async toggleGearActive(id: string, isActive: boolean) {
    const item = await prisma.gearItem.findUnique({ where: { id } });
    if (!item) throw ApiError.notFound('Gear item not found');
    return prisma.gearItem.update({ where: { id }, data: { isActive } });
  },

  async listRentals(query: { page?: string; limit?: string; status?: string }) {
    const { page, limit, skip } = getPagination(query);
    const where = query.status ? { status: query.status as never } : {};
    const [items, total] = await Promise.all([
      prisma.rentalOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true } },
          items: { include: { gearItem: true } },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.rentalOrder.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async dashboardStats() {
    const [totalUsers, totalCustomers, totalProviders, totalGear, totalOrders, activeOrders, revenueAgg, ordersByStatus] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'CUSTOMER' } }),
        prisma.user.count({ where: { role: 'PROVIDER' } }),
        prisma.gearItem.count(),
        prisma.rentalOrder.count(),
        prisma.rentalOrder.count({ where: { status: { in: ['PLACED', 'CONFIRMED', 'PAID', 'PICKED_UP'] } } }),
        prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'COMPLETED' } }),
        prisma.rentalOrder.groupBy({ by: ['status'], _count: { status: true } }),
      ]);

    return {
      totalUsers,
      totalCustomers,
      totalProviders,
      totalGear,
      totalOrders,
      activeOrders,
      totalRevenue: revenueAgg._sum.amount ?? 0,
      ordersByStatus: ordersByStatus.map((o) => ({ status: o.status, count: o._count.status })),
    };
  },
};
