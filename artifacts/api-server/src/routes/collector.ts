import { Router } from "express";
import { db } from "@workspace/db";
import { ohlcvTable, fundingTable, openInterestTable, liquidationsTable, orderbookTable } from "@workspace/db";
import { sql, count, max, min } from "drizzle-orm";

const router = Router();

router.get("/collector/status", async (req, res) => {
  const now = new Date();

  const [ohlcvStats, fundingStats, oiStats, liqStats, obStats] = await Promise.all([
    db.select({ count: count(), latest: max(ohlcvTable.timestamp), oldest: min(ohlcvTable.timestamp) }).from(ohlcvTable),
    db.select({ count: count(), latest: max(fundingTable.timestamp), oldest: min(fundingTable.timestamp) }).from(fundingTable),
    db.select({ count: count(), latest: max(openInterestTable.timestamp), oldest: min(openInterestTable.timestamp) }).from(openInterestTable),
    db.select({ count: count(), latest: max(liquidationsTable.timestamp), oldest: min(liquidationsTable.timestamp) }).from(liquidationsTable),
    db.select({ count: count(), latest: max(orderbookTable.timestamp), oldest: min(orderbookTable.timestamp) }).from(orderbookTable),
  ]);

  const makeItem = (name: string, stats: { count: number; latest: Date | null; oldest: Date | null }[], ageThresholdMinutes: number) => {
    const s = stats[0];
    const latest = s.latest;
    const ageMinutes = latest ? (now.getTime() - latest.getTime()) / 60000 : null;
    const status = s.count === 0 ? "empty" : ageMinutes === null ? "unknown" : ageMinutes < ageThresholdMinutes ? "healthy" : "stale";
    return {
      name,
      lastRun: latest?.toISOString() ?? null,
      recordCount: s.count,
      status,
      latestTimestamp: latest?.toISOString() ?? null,
      errorMessage: null,
    };
  };

  res.json({
    updatedAt: now.toISOString(),
    collectors: [
      makeItem("OHLCV (1m)", ohlcvStats, 2),
      makeItem("Funding Rate", fundingStats, 60),
      makeItem("Open Interest", oiStats, 5),
      makeItem("Liquidations", liqStats, 5),
      makeItem("Order Book", obStats, 2),
    ],
  });
});

export default router;
