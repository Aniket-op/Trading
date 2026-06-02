import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ohlcvRouter from "./ohlcv";
import fundingRouter from "./funding";
import openInterestRouter from "./openInterest";
import liquidationsRouter from "./liquidations";
import orderbookRouter from "./orderbook";
import featuresRouter from "./features";
import collectorRouter from "./collector";
import summaryRouter from "./summary";
import regimeRouter from "./regime";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ohlcvRouter);
router.use(fundingRouter);
router.use(openInterestRouter);
router.use(liquidationsRouter);
router.use(orderbookRouter);
router.use(featuresRouter);
router.use(collectorRouter);
router.use(summaryRouter);
router.use(regimeRouter);

export default router;
