import { Request, Response } from "express";
import Stripe from "stripe";
import { StatusCodes } from "http-status-codes";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/ApiResponse";
import { paymentService } from "./payment.service";
import { ApiError } from "../../utils/ApiError";
import { stripe } from "../../config/stripe";
import { env } from "../../config/env";

export const paymentController = {
  // ============================================
  // CREATE PAYMENT
  // ============================================

  create: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const { rentalOrderId, method } = req.body;

    const result = await paymentService.initiate(
      req.user.userId,
      rentalOrderId,
      method,
    );

    sendResponse(res, StatusCodes.CREATED, "Payment session created", result);
  }),

  // ============================================
  // PAYMENT HISTORY
  // ============================================

  list: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const { items, meta } = await paymentService.listForUser(
      req.user.userId,
      req.query as Record<string, string>,
    );

    sendResponse(res, StatusCodes.OK, "Payment history fetched", items, meta);
  }),

  // ============================================
  // GET PAYMENT BY ID
  // ============================================

  getById: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const payment = await paymentService.getById(
      req.user.userId,
      req.params.id,
      req.user.role,
    );

    sendResponse(res, StatusCodes.OK, "Payment fetched", payment);
  }),

  // ============================================
  // STRIPE WEBHOOK
  // ============================================

  stripeWebhook: catchAsync(async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];

    if (!signature || !env.stripe.webhookSecret) {
      res.status(StatusCodes.BAD_REQUEST).send("Webhook not configured");

      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        env.stripe.webhookSecret,
      );
    } catch (error) {
      console.error("Stripe webhook signature verification failed:", error);

      res
        .status(StatusCodes.BAD_REQUEST)
        .send("Webhook signature verification failed");

      return;
    }

    // ========================================
    // CHECKOUT COMPLETED
    // ========================================

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log("Stripe checkout completed:", session.id);

      // IMPORTANT:
      // Only mark payment as completed
      // if Stripe confirms that it is paid.

      if (session.payment_status !== "paid") {
        console.log("Stripe session is not paid:", session.payment_status);

        res.json({
          received: true,
        });

        return;
      }

      const transactionId = session.metadata?.transactionId;

      if (!transactionId) {
        console.error("Transaction ID missing from Stripe metadata");

        res.json({
          received: true,
        });

        return;
      }

      // Mark database payment as completed
      await paymentService.confirm(transactionId, session.id);
    }

    // Always acknowledge webhook
    res.json({
      received: true,
    });
  }),
};
