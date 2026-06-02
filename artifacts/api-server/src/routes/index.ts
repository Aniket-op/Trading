import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ohlcvRouter from "./ohlcv";
import fundingRouter from "./funding";
import openInterestRouter from "./openInterest";
import liquidationsRouter from "./liquidations";
import orderbookRouter from "./orderbook";
import collectorRouter from "./collector";
import summaryRouter from "./summary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ohlcvRouter);
router.use(fundingRouter);
router.use(openInterestRouter);
router.use(liquidationsRouter);
router.use(orderbookRouter);
router.use(collectorRouter);
router.use(summaryRouter);

export default router;
