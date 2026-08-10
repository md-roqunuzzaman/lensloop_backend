import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { getPagination } from '../../utils/helpers';

interface CreateRentalInput {
  startDate: Date;
  endDate: Date;
  notes?: string;
  items: { gearItemId: string; quantity: number }[];
}

export const rentalService = {
  async create(customerId: string, input: CreateRentalInput) {
    const days = Math.ceil(
      (input.endDate.getTime() - input.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Fetching gear and calculating prices do not require a transaction lock.
    // Keeping this work outside makes the interactive transaction much shorter.
    const gearItems = await prisma.gearItem.findMany({
      where: { id: { in: input.items.map((item) => item.gearItemId) } },
    });
    const gearById = new Map(gearItems.map((gear) => [gear.id, gear]));
    let totalAmount = 0;
    const orderItemsData = input.items.map((line) => {
      const gear = gearById.get(line.gearItemId);
      if (!gear || !gear.isActive) {
        throw ApiError.notFound(`Gear item ${line.gearItemId} not found`);
      }
      if (gear.availableStock < line.quantity) {
        throw ApiError.badRequest(`"${gear.name}" only has ${gear.availableStock} unit(s) available`);
      }
      const subtotal = Number(gear.pricePerDay) * line.quantity * days;
      totalAmount += subtotal;

      return {
        gearItemId: gear.id,
        quantity: line.quantity,
        pricePerDay: gear.pricePerDay,
        subtotal,
      };
    });

    return prisma.$transaction(async (tx) => {
      for (const line of input.items) {
        // Make the availability check and decrement atomic to prevent overselling.
        const result = await tx.gearItem.updateMany({
          where: {
            id: line.gearItemId,
            isActive: true,
            availableStock: { gte: line.quantity },
          },
          data: { availableStock: { decrement: line.quantity } },
        });
        if (result.count === 0) {
          throw ApiError.badRequest('This gear item is no longer available in the requested quantity');
        }
      }

      const order = await tx.rentalOrder.create({
        data: {
          customerId,
          startDate: input.startDate,
          endDate: input.endDate,
          notes: input.notes,
          totalAmount,
          items: { create: orderItemsData },
        },
        include: { items: { include: { gearItem: true } } },
      });

      return order;
    }, { timeout: 15_000, maxWait: 5_000 });
  },

  async listForCustomer(customerId: string, query: { page?: string; limit?: string; status?: string }) {
    const { page, limit, skip } = getPagination(query);
    const where = { customerId, ...(query.status ? { status: query.status as never } : {}) };
    const [orders, total] = await Promise.all([
      prisma.rentalOrder.findMany({
        where,
        include: { items: { include: { gearItem: true } }, payment: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.rentalOrder.count({ where }),
    ]);
    return { items: orders, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async getById(customerId: string, orderId: string, role: string) {
    const order = await prisma.rentalOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { gearItem: true } },
        payment: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!order) throw ApiError.notFound('Rental order not found');
    if (role === 'CUSTOMER' && order.customerId !== customerId) {
      throw ApiError.forbidden('You do not have access to this order');
    }
    return order;
  },

  async cancel(customerId: string, orderId: string) {
    const order = await prisma.rentalOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw ApiError.notFound('Rental order not found');
    if (order.customerId !== customerId) throw ApiError.forbidden('You do not have access to this order');
    if (!['PLACED', 'CONFIRMED'].includes(order.status)) {
      throw ApiError.badRequest('This order can no longer be cancelled');
    }

    return prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.gearItem.update({
          where: { id: item.gearItemId },
          data: { availableStock: { increment: item.quantity } },
        });
      }
      return tx.rentalOrder.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    });
  },
};
