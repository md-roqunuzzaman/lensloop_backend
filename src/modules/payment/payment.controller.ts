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
  // =========================================================
  // CREATE PAYMENT
  // =========================================================

  create: catchAsync(async (req: Request, res: Response) => {
    console.log("\n========================================");
    console.log("💳 CREATE PAYMENT REQUEST");
    console.log("========================================");

    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const { rentalOrderId, method } = req.body;

    console.log("User:", req.user.userId);
    console.log("Rental Order ID:", rentalOrderId);
    console.log("Method:", method);

    if (!rentalOrderId) {
      throw ApiError.badRequest("rentalOrderId is required");
    }

    if (method !== "STRIPE" && method !== "SSLCOMMERZ") {
      throw ApiError.badRequest("Invalid payment method");
    }

    const result = await paymentService.initiate(
      req.user.userId,
      rentalOrderId,
      method,
    );

    console.log("✅ Payment session created");

    sendResponse(res, StatusCodes.CREATED, "Payment session created", result);
  }),

  // =========================================================
  // PAYMENT HISTORY
  // =========================================================

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

  // =========================================================
  // GET PAYMENT BY ID
  // =========================================================

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

  // =========================================================
  // STRIPE WEBHOOK
  // =========================================================

  stripeWebhook: catchAsync(async (req: Request, res: Response) => {
    console.log("\n");
    console.log("========================================");
    console.log("🔥🔥🔥 STRIPE WEBHOOK RECEIVED 🔥🔥🔥");
    console.log("========================================");

    const signature = req.headers["stripe-signature"];

    if (!signature) {
      console.error("❌ Stripe signature missing");

      res.status(StatusCodes.BAD_REQUEST).send("Stripe signature missing");

      return;
    }

    if (!env.stripe.webhookSecret) {
      console.error("❌ Stripe webhook secret missing");

      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send("Webhook secret not configured");

      return;
    }

    let event: Stripe.Event;

    // =====================================================
    // VERIFY STRIPE SIGNATURE
    // =====================================================

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        env.stripe.webhookSecret,
      );

      console.log("✅ Stripe signature verified");
    } catch (error) {
      console.error("❌ Stripe signature verification failed:");

      console.error(error);

      res
        .status(StatusCodes.BAD_REQUEST)
        .send("Webhook signature verification failed");

      return;
    }

    console.log("Stripe Event ID:", event.id);

    console.log("Stripe Event Type:", event.type);

    // =====================================================
    // CHECKOUT SESSION COMPLETED
    // =====================================================

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log("\n");
      console.log("========================================");
      console.log("💰 STRIPE CHECKOUT COMPLETED");
      console.log("========================================");

      console.log("Session ID:", session.id);

      console.log("Payment Status:", session.payment_status);

      console.log("Session Status:", session.status);

      console.log("Amount:", session.amount_total);

      console.log("Currency:", session.currency);

      console.log("Metadata:", session.metadata);

      console.log("========================================");

      // ---------------------------------------------------
      // Stripe must confirm payment
      // ---------------------------------------------------

      if (session.payment_status !== "paid") {
        console.log("⚠️ Payment is not paid:", session.payment_status);

        res.json({
          received: true,
        });

        return;
      }

      // ---------------------------------------------------
      // Get transaction ID
      // ---------------------------------------------------

      const transactionId = session.metadata?.transactionId;

      const rentalOrderId = session.metadata?.rentalOrderId;

      console.log("Transaction ID:", transactionId);

      console.log("Rental Order ID:", rentalOrderId);

      if (!transactionId) {
        console.error("❌ Transaction ID missing from Stripe metadata");

        res.json({
          received: true,
        });

        return;
      }

      if (!rentalOrderId) {
        console.error("❌ Rental Order ID missing from Stripe metadata");

        res.json({
          received: true,
        });

        return;
      }

      // ---------------------------------------------------
      // Confirm payment
      // ---------------------------------------------------

      try {
        console.log("\n🔍 Calling paymentService.confirm()");

        console.log("Transaction:", transactionId);

        console.log("Stripe Session:", session.id);

        const payment = await paymentService.confirm(transactionId, session.id);

        console.log("\n🎉🎉🎉 PAYMENT SUCCESSFULLY CONFIRMED 🎉🎉🎉");

        console.log("Payment ID:", payment.id);

        console.log("Transaction ID:", payment.transactionId);

        console.log("Payment Status:", payment.status);
      } catch (error) {
        console.error("\n❌❌❌ PAYMENT CONFIRMATION FAILED ❌❌❌");

        console.error(error);

        throw error;
      }
    }

    // =====================================================
    // PAYMENT FAILED
    // =====================================================

    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log("❌ Stripe async payment failed:", session.id);
    }

    // =====================================================
    // PAYMENT INTENT SUCCEEDED
    // =====================================================

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      console.log("✅ PaymentIntent succeeded:", paymentIntent.id);

      console.log("PaymentIntent metadata:", paymentIntent.metadata);
    }

    // =====================================================
    // ACKNOWLEDGE WEBHOOK
    // =====================================================

    console.log("\n========================================");
    console.log("✅ STRIPE WEBHOOK ACKNOWLEDGED");
    console.log("Event:", event.id);
    console.log("========================================\n");

    res.json({
      received: true,
    });
  }),
};
