import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storesRouter from "./stores";
import productsRouter from "./products";
import ordersRouter from "./orders";
import aiRouter from "../ai-brain";
import analyticsRouter from "./analytics";
import billingRouter from "./billing";
import referralRouter from "./referral";
import adminRouter from "./admin";
import growthRouter from "./growth";
import waitlistRouter from "./waitlist";
import couponsRouter from "./coupons";
import reviewsRouter from "./reviews";
import ogRouter from "./og";
import whatsappRouter from "./whatsapp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ogRouter);
router.use(storesRouter);
router.use(couponsRouter);
router.use(reviewsRouter);
router.use(waitlistRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(aiRouter);
router.use(analyticsRouter);
router.use(billingRouter);
router.use(referralRouter);
router.use(adminRouter);
router.use(growthRouter);
router.use(whatsappRouter);

export default router;
