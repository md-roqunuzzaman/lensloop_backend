// src/modules/admin/admin.routes.ts
import { Router } from "express";
import { z } from "zod";
import { adminController } from "./admin.controller";
import { blogController } from "../blog/blog.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  listGearSchema,
  listRentalsSchema,
  listUsersSchema,
  updateUserStatusSchema,
  toggleGearActiveSchema,
} from "./admin.validation";
import {
  blogIdParamSchema,
  createBlogSchema,
  listAdminBlogSchema,
  updateBlogSchema,
} from "../blog/blog.validation";

const router = Router();

// All routes below require ADMIN role
router.use(authenticate, authorize("ADMIN"));

// Dashboard stats
router.get("/dashboard", adminController.dashboard);

// Users
router.get("/users", validate(listUsersSchema), adminController.listUsers);
router.patch(
  "/users/:id",
  validate(updateUserStatusSchema),
  adminController.updateUserStatus,
);

// Gear
router.get("/gear", validate(listGearSchema), adminController.listGear);
router.patch(
  "/gear/:id",
  validate(toggleGearActiveSchema),
  adminController.toggleGearActive,
);

// Rentals
router.get(
  "/rentals",
  validate(listRentalsSchema),
  adminController.listRentals,
);

// Blog (CMS)
router.post("/blog", validate(createBlogSchema), blogController.create);
router.get("/blog", validate(listAdminBlogSchema), blogController.listAdmin);
router.get(
  "/blog/:id",
  validate(blogIdParamSchema),
  blogController.getByIdAdmin,
);
router.put("/blog/:id", validate(updateBlogSchema), blogController.update);
router.patch(
  "/blog/:id/publish",
  validate(blogIdParamSchema),
  blogController.publish,
);
router.patch(
  "/blog/:id/unpublish",
  validate(blogIdParamSchema),
  blogController.unpublish,
);
router.delete("/blog/:id", validate(blogIdParamSchema), blogController.remove);

export default router;
