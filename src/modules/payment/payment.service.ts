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
    console.log("\n========================================");
    console.log("💳 PAYMENT INITIATION START");
    console.log("User ID:", userId);
    console.log("Rental Order ID:", rentalOrderId);
    console.log("Payment Method:", method);
    console.log("========================================");

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

    console.log("Rental order found:", !!order);

    // -------------------------------------------------------
    // 2. Validate order
    // -------------------------------------------------------

    if (!order) {
      console.error("❌ Rental order not found:", rentalOrderId);

      throw ApiError.notFound("Rental order not found");
    }

    console.log("Order customer:", order.customerId);
    console.log("Current order status:", order.status);
    console.log("Order total:", order.totalAmount);

    if (order.customerId !== userId) {
      console.error("❌ Unauthorized payment attempt");

      throw ApiError.forbidden("You do not have access to this order");
    }

    if (order.status !== "CONFIRMED") {
      console.error("❌ Invalid order status for payment:", order.status);

      throw ApiError.badRequest("Only confirmed orders can be paid for");
    }

    // -------------------------------------------------------
    // 3. Prevent duplicate completed payment
    // -------------------------------------------------------

    if (order.payment && order.payment.status === "COMPLETED") {
      console.log("⚠️ Payment already completed");

      throw ApiError.conflict("This order has already been paid for");
    }

    // -------------------------------------------------------
    // 4. Calculate rental duration
    // -------------------------------------------------------

    const startDate = new Date(order.startDate);
    const endDate = new Date(order.endDate);

    const differenceInMs = endDate.getTime() - startDate.getTime();

    const rentalDays = Math.ceil(differenceInMs / (1000 * 60 * 60 * 24));

    console.log("Rental days:", rentalDays);

    if (rentalDays <= 0) {
      throw ApiError.badRequest("Invalid rental duration");
    }

    // -------------------------------------------------------
    // 5. Generate transaction ID
    // -------------------------------------------------------

    const transactionId = generateTransactionId("GEARUP");

    console.log("Generated transaction ID:", transactionId);

    // -------------------------------------------------------
    // 6. Calculate total
    // -------------------------------------------------------

    const calculatedTotal = order.items.reduce((total, item) => {
      const pricePerDay = Number(item.pricePerDay);

      const quantity = Number(item.quantity);

      const itemTotal = pricePerDay * rentalDays * quantity;

      console.log("Item calculation:", {
        gearItem: item.gearItem.name,
        pricePerDay,
        quantity,
        rentalDays,
        itemTotal,
      });

      return total + itemTotal;
    }, 0);

    const orderTotal = Number(order.totalAmount);

    console.log("Calculated total:", calculatedTotal);
    console.log("Database order total:", orderTotal);

    const amountDifference = Math.abs(calculatedTotal - orderTotal);

    if (amountDifference > 0.01) {
      console.error("❌ PAYMENT AMOUNT MISMATCH");

      throw ApiError.badRequest(
        `Payment amount mismatch. Order total: ${orderTotal}, calculated total: ${calculatedTotal}`,
      );
    }

    // -------------------------------------------------------
    // 7. Create / update payment
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

    console.log("✅ Payment record created/updated");
    console.log("Payment ID:", payment.id);
    console.log("Payment transactionId:", payment.transactionId);
    console.log("Payment status:", payment.status);

    // =======================================================
    // STRIPE
    // =======================================================

    if (method === "STRIPE") {
      console.log("\n========================================");
      console.log("💳 CREATING STRIPE CHECKOUT");
      console.log("========================================");

      const session = await stripe.checkout.sessions.create({
        mode: "payment",

        payment_method_types: ["card"],

        line_items: order.items.map((item) => {
          const pricePerDay = Number(item.pricePerDay);

          const quantity = Number(item.quantity);

          const unitAmount = Math.round(pricePerDay * rentalDays * 100);

          console.log("Stripe line item:", {
            name: item.gearItem.name,
            pricePerDay,
            rentalDays,
            quantity,
            unitAmount,
          });

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

      console.log("✅ Stripe Checkout created");
      console.log("Stripe Session ID:", session.id);
      console.log("Stripe Session URL:", session.url);

      console.log("Stripe metadata:", session.metadata);

      return {
        payment,

        redirectUrl: session.url,

        sessionId: session.id,
      };
    }

    // =======================================================
    // SSL COMMERZ
    // =======================================================

    console.log("⚠️ SSLCommerz integration is scaffolded");

    const redirectUrl = `${env.clientUrl}/payment/sslcommerz-redirect?transactionId=${transactionId}`;

    return {
      payment,

      redirectUrl,

      sessionId: transactionId,
    };
  },

  // =========================================================
  // CONFIRM PAYMENT
  // =========================================================

  async confirm(transactionId: string, gatewayReference?: string) {
    console.log("\n========================================");
    console.log("🔥 PAYMENT CONFIRM START");
    console.log("========================================");
    console.log("Transaction ID:", transactionId);
    console.log("Gateway Reference:", gatewayReference);
    console.log("========================================");

    // -------------------------------------------------------
    // 1. Find payment
    // -------------------------------------------------------

    const payment = await prisma.payment.findUnique({
      where: {
        transactionId,
      },
    });

    console.log(
      "Payment lookup result:",
      payment
        ? {
            id: payment.id,
            transactionId: payment.transactionId,
            rentalOrderId: payment.rentalOrderId,
            userId: payment.userId,
            status: payment.status,
            amount: payment.amount,
          }
        : null,
    );

    // -------------------------------------------------------
    // 2. Payment not found
    // -------------------------------------------------------

    if (!payment) {
      console.error("\n❌❌❌ PAYMENT NOT FOUND ❌❌❌");

      console.error("Transaction ID searched:", transactionId);

      console.error("Possible reason:");

      console.error("1. Stripe and backend are using different databases");

      console.error("2. Payment record was never created");

      console.error("3. Transaction ID changed");

      console.error("4. Wrong DATABASE_URL");

      console.error("5. Webhook is hitting a different backend");

      console.error("❌❌❌ END PAYMENT NOT FOUND ❌❌❌\n");

      throw ApiError.notFound("Payment not found");
    }

    // -------------------------------------------------------
    // 3. Idempotency
    // -------------------------------------------------------

    if (payment.status === "COMPLETED") {
      console.log("ℹ️ Payment already completed");

      return payment;
    }

    // -------------------------------------------------------
    // 4. Atomic database transaction
    // -------------------------------------------------------

    console.log("🔄 Starting Prisma transaction...");

    const result = await prisma.$transaction(async (tx) => {
      console.log("🔄 Updating payment...");

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

      console.log("✅ Payment updated:", {
        id: updatedPayment.id,
        status: updatedPayment.status,
        transactionId: updatedPayment.transactionId,
      });

      console.log("🔄 Updating rental order:", payment.rentalOrderId);

      const updatedOrder = await tx.rentalOrder.update({
        where: {
          id: payment.rentalOrderId,
        },

        data: {
          status: "PAID",
        },
      });

      console.log("✅ Rental order updated:", {
        id: updatedOrder.id,
        status: updatedOrder.status,
      });

      return {
        payment: updatedPayment,
        order: updatedOrder,
      };
    });

    console.log("\n========================================");
    console.log("🎉 PAYMENT CONFIRMATION SUCCESS");
    console.log("Payment ID:", result.payment.id);
    console.log("Rental Order ID:", result.order.id);
    console.log("Rental Order Status:", result.order.status);
    console.log("========================================\n");

    return result.payment;
  },

  // =========================================================
  // MARK PAYMENT FAILED
  // =========================================================

  async markFailed(transactionId: string, reason?: string) {
    console.log("❌ Marking payment as failed:", transactionId);

    const payment = await prisma.payment.findUnique({
      where: {
        transactionId,
      },
    });

    if (!payment) {
      throw ApiError.notFound("Payment not found");
    }

    if (payment.status === "COMPLETED") {
      console.log("Payment already completed. Cannot mark failed.");

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

    if (role !== "ADMIN" && payment.userId !== userId) {
      throw ApiError.forbidden("Access denied");
    }

    return payment;
  },
};
