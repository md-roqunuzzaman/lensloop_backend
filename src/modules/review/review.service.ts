import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';

interface CreateReviewInput {
  gearItemId: string;
  rentalOrderId: string;
  rating: number;
  comment: string;
}

export const reviewService = {
  async create(customerId: string, input: CreateReviewInput) {
    const order = await prisma.rentalOrder.findUnique({
      where: { id: input.rentalOrderId },
      include: { items: true },
    });
    if (!order) throw ApiError.notFound('Rental order not found');
    if (order.customerId !== customerId) throw ApiError.forbidden('You do not have access to this order');
    if (order.status !== 'RETURNED') {
      throw ApiError.badRequest('You can only review gear after it has been returned');
    }
    const rentedThisItem = order.items.some((item) => item.gearItemId === input.gearItemId);
    if (!rentedThisItem) throw ApiError.badRequest('This gear item was not part of the given order');

    const existing = await prisma.review.findUnique({
      where: { rentalOrderId_gearItemId: { rentalOrderId: input.rentalOrderId, gearItemId: input.gearItemId } },
    });
    if (existing) throw ApiError.conflict('You have already reviewed this item for this order');

    return prisma.review.create({
      data: {
        gearItemId: input.gearItemId,
        rentalOrderId: input.rentalOrderId,
        customerId,
        rating: input.rating,
        comment: input.comment,
      },
      include: { customer: { select: { id: true, name: true, avatar: true } } },
    });
  },
};
