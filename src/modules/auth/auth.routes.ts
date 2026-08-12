import { Router } from "express";

import { authController } from "./auth.controller";

import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";

import { loginSchema, refreshSchema, registerSchema } from "./auth.validation";

const router = Router();

// Register
router.post("/register", validate(registerSchema), authController.register);

// Login
router.post("/login", validate(loginSchema), authController.login);

router.post("/google", authController.google);

// Refresh access token
router.post("/refresh", validate(refreshSchema), authController.refresh);

// Current user
router.get("/me", authenticate, authController.me);

// Logout
router.post("/logout", authController.logout);

export default router;
