import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/user/user.routes";
import gearRoutes from "../modules/gear/gear.routes";
import categoryRoutes from "../modules/category/category.routes";
import rentalRoutes from "../modules/rental/rental.routes";
import paymentRoutes from "../modules/payment/payment.routes";
import providerRoutes from "../modules/provider/provider.routes";
import reviewRoutes from "../modules/review/review.routes";
import adminRoutes from "../modules/admin/admin.routes";
import uploadRoutes from "../modules/upload/upload.routes";
import blogRoutes from "../modules/blog/blog.routes";
const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/gear", gearRoutes);
router.use("/categories", categoryRoutes);
router.use("/rentals", rentalRoutes);
router.use("/payments", paymentRoutes);
router.use("/provider", providerRoutes);
router.use("/reviews", reviewRoutes);
router.use("/admin", adminRoutes);
router.use("/uploads", uploadRoutes);
router.use("/blog", blogRoutes);

export default router;
