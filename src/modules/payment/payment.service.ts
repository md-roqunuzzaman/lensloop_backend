import { prisma } from "../../config/prisma";
import { stripe } from "../../config/stripe";
import { ApiError } from "../../utils/ApiError";
import { generateTransactionId, getPagination } from "../../utils/helpers";
import { env } from "../../config/env";

export const paymentService = {
  // =========================================================
  // INITIATE PAYMENT
  // =========================================================

  async initiate(
    userId: string,
    rentalOrderId: string,
    method: "STRIPE" | "SSLCOMMERZ",
  ) {
    // -------------------------------------------------------
    // 1. Find rental order
    // -------------------------------------------------------

    const order = await prisma.rentalOrder.findUnique({
      where: {
        id: rentalOrderId,
      },

      include: {
        payment: true,

        items: {
          include: {
            gearItem: true,
          },
        },
      },
    });

    // -------------------------------------------------------
    // 2. Validate order
    // -------------------------------------------------------

    if (!order) {
      throw ApiError.notFound("Rental order not found");
    }

    if (order.customerId !== userId) {
      throw ApiError.forbidden("You do not have access to this order");
    }

    if (order.status !== "CONFIRMED") {
      throw ApiError.badRequest("Only confirmed orders can be paid for");
    }

    // -------------------------------------------------------
    // 3. Prevent paying an already-paid order
    // -------------------------------------------------------

    if (order.payment && order.payment.status === "COMPLETED") {
      throw ApiError.conflict("This order has already been paid for");
    }

    // -------------------------------------------------------
    // 4. Calculate rental duration
    //
    // Example:
    // startDate = Aug 10
    // endDate   = Aug 15
    //
    // 5 rental days
    // -------------------------------------------------------

    const startDate = new Date(order.startDate);
    const endDate = new Date(order.endDate);

    const differenceInMs = endDate.getTime() - startDate.getTime();

    const rentalDays = Math.ceil(differenceInMs / (1000 * 60 * 60 * 24));

    if (rentalDays <= 0) {
      throw ApiError.badRequest("Invalid rental duration");
    }

    // -------------------------------------------------------
    // 5. Generate transaction ID
    // -------------------------------------------------------

    const transactionId = generateTransactionId("GEARUP");

    // -------------------------------------------------------
    // 6. Calculate Stripe amount
    //
    // Example:
    //
    // $20/day
    // × 5 days
    // × quantity 2
    // = $200
    // -------------------------------------------------------

    const calculatedTotal = order.items.reduce((total, item) => {
      const pricePerDay = Number(item.pricePerDay);

      const quantity = Number(item.quantity);

      const itemTotal = pricePerDay * rentalDays * quantity;

      return total + itemTotal;
    }, 0);

    // -------------------------------------------------------
    // 7. Compare calculated amount with order total
    //
    // This protects against amount mismatch.
    // -------------------------------------------------------

    const orderTotal = Number(order.totalAmount);

    const amountDifference = Math.abs(calculatedTotal - orderTotal);

    if (amountDifference > 0.01) {
      throw ApiError.badRequest(
        `Payment amount mismatch. Order total: ${orderTotal}, calculated total: ${calculatedTotal}`,
      );
    }

    // -------------------------------------------------------
    // 8. Create / update payment
    // -------------------------------------------------------

    const payment = await prisma.payment.upsert({
      where: {
        rentalOrderId,
      },

      update: {
        method,
        status: "PENDING",
        transactionId,
        amount: order.totalAmount,
        paidAt: null,
        gatewayResponse: undefined,
      },

      create: {
        rentalOrderId,
        userId,
        method,
        transactionId,
        amount: order.totalAmount,
        status: "PENDING",
      },
    });

    // =======================================================
    // STRIPE
    // =======================================================

    if (method === "STRIPE") {
      // -----------------------------------------------------
      // Create Stripe Checkout Session
      // -----------------------------------------------------

      const session = await stripe.checkout.sessions.create({
        mode: "payment",

        payment_method_types: ["card"],

        line_items: order.items.map((item) => {
          const pricePerDay = Number(item.pricePerDay);

          const quantity = Number(item.quantity);

          /*
           * Stripe unit_amount is the price
           * of ONE complete line item.
           *
           * Example:
           *
           * $20/day × 5 days
           * = $100 per item
           *
           * quantity = 2
           *
           * Stripe total:
           * $100 × 2 = $200
           */

          const unitAmount = Math.round(pricePerDay * rentalDays * 100);

          return {
            price_data: {
              currency: "usd",

              product_data: {
                name: item.gearItem.name,
              },

              unit_amount: unitAmount,
            },

            quantity,
          };
        }),

        metadata: {
          rentalOrderId,
          transactionId,
        },

        success_url: `${env.clientUrl}/payment/success?transactionId=${transactionId}`,

        cancel_url: `${env.clientUrl}/payment/cancel?transactionId=${transactionId}`,
      });

      // -----------------------------------------------------
      // Return Stripe redirect information
      // -----------------------------------------------------

      return {
        payment,

        redirectUrl: session.url,

        sessionId: session.id,
      };
    }

    // =======================================================
    // SSL COMMERZ
    // =======================================================

    /*
     * SSLCommerz is currently scaffolded.
     *
     * For real SSLCommerz integration, this section should:
     *
     * 1. Send payment request to SSLCommerz
     * 2. Receive GatewayPageURL
     * 3. Return GatewayPageURL
     * 4. Handle success/fail/cancel/IPN callbacks
     * 5. Validate transaction server-side
     */

    const redirectUrl = `${env.clientUrl}/payment/sslcommerz-redirect?transactionId=${transactionId}`;

    return {
      payment,

      redirectUrl,

      sessionId: transactionId,
    };
  },

  // =========================================================
  // CONFIRM PAYMENT
  //
  // IMPORTANT:
  // This function should ONLY be called after
  // server-side gateway verification.
  //
  // For Stripe:
  // Stripe Webhook -> verify signature
  // -> verify payment_status
  // -> call this function
  // =========================================================

  async confirm(transactionId: string, gatewayReference?: string) {
    // -------------------------------------------------------
    // 1. Find payment
    // -------------------------------------------------------

    const payment = await prisma.payment.findUnique({
      where: {
        transactionId,
      },
    });

    if (!payment) {
      throw ApiError.notFound("Payment not found");
    }

    // -------------------------------------------------------
    // 2. Idempotency
    //
    // Stripe can send duplicate webhook events.
    // If already completed, don't update again.
    // -------------------------------------------------------

    if (payment.status === "COMPLETED") {
      return payment;
    }

    // -------------------------------------------------------
    // 3. Update payment + rental order atomically
    // -------------------------------------------------------

    return prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: {
          transactionId,
        },

        data: {
          status: "COMPLETED",

          paidAt: new Date(),

          gatewayResponse: gatewayReference
            ? {
                reference: gatewayReference,
              }
            : undefined,
        },
      });

      await tx.rentalOrder.update({
        where: {
          id: payment.rentalOrderId,
        },

        data: {
          status: "PAID",
        },
      });

      return updatedPayment;
    });
  },

  // =========================================================
  // MARK PAYMENT FAILED
  // =========================================================

  async markFailed(transactionId: string, reason?: string) {
    const payment = await prisma.payment.findUnique({
      where: {
        transactionId,
      },
    });

    if (!payment) {
      throw ApiError.notFound("Payment not found");
    }

    // Don't mark a completed payment as failed.
    if (payment.status === "COMPLETED") {
      return payment;
    }

    return prisma.payment.update({
      where: {
        transactionId,
      },

      data: {
        status: "FAILED",

        gatewayResponse: reason
          ? {
              error: reason,
            }
          : undefined,
      },
    });
  },

  // =========================================================
  // PAYMENT HISTORY
  // =========================================================

  async listForUser(
    userId: string,
    query: {
      page?: string;
      limit?: string;
    },
  ) {
    const { page, limit, skip } = getPagination(query);

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where: {
          userId,
        },

        include: {
          rentalOrder: {
            include: {
              items: {
                include: {
                  gearItem: true,
                },
              },
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        skip,

        take: limit,
      }),

      prisma.payment.count({
        where: {
          userId,
        },
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

  // =========================================================
  // GET PAYMENT BY ID
  // =========================================================

  async getById(userId: string, id: string, role: string) {
    const payment = await prisma.payment.findUnique({
      where: {
        id,
      },

      include: {
        rentalOrder: {
          include: {
            items: {
              include: {
                gearItem: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw ApiError.notFound("Payment not found");
    }

    // ADMIN can see any payment.
    // Customer can only see own payment.

    if (role !== "ADMIN" && payment.userId !== userId) {
      throw ApiError.forbidden("Access denied");
    }

    return payment;
  },
};
