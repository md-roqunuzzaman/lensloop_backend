import { Router } from "express";

import { paymentController } from "./payment.controller";

import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";

import {
  createPaymentSchema,
  listPaymentsSchema,
  paymentIdSchema,
} from "./payment.validation";

const router = Router();

// ============================================
// CREATE PAYMENT
// ============================================

router.post(
  "/create",
  authenticate,
  authorize("CUSTOMER"),
  validate(createPaymentSchema),
  paymentController.create,
);

// ============================================
// PAYMENT HISTORY
// ============================================

router.get(
  "/",
  authenticate,
  validate(listPaymentsSchema),
  paymentController.list,
);

// ============================================
// GET PAYMENT BY ID
// ============================================

router.get(
  "/:id",
  authenticate,
  validate(paymentIdSchema),
  paymentController.getById,
);

export default router;
