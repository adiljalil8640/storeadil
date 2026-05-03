import { Router, type IRouter } from "express";
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
import devSeedRouter from "./dev-seed";

const router: IRouter = Router();

// Dev-only: only register the seed route in development so it is never
// reachable in production even if someone bypasses the NODE_ENV guard inside.
if (process.env.NODE_ENV === "development") {
  router.use(devSeedRouter);
}
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

router.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

export default router;
