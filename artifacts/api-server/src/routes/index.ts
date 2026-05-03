import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storesRouter from "./stores";
import productsRouter from "./products";
import ordersRouter from "./orders";
import aiRouter from "./ai";
import analyticsRouter from "./analytics";
import billingRouter from "./billing";
import referralRouter from "./referral";
import adminRouter from "./admin";
import growthRouter from "./growth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storesRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(aiRouter);
router.use(analyticsRouter);
router.use(billingRouter);
router.use(referralRouter);
router.use(adminRouter);
router.use(growthRouter);

export default router;
