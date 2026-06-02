import { Router } from "express";
import { db } from "@workspace/db";
import { featureStoreTable } from "@workspace/db";
import { desc, eq, and, gte } from "drizzle-orm";

const router = Router();

function serializeFeature(r: typeof featureStoreTable.$inferSelect) {
  return {
    id: r.id,
    symbol: r.symbol,
    timestamp: r.timestamp.toISOString(),
    atr14: r.atr14 != null ? parseFloat(r.atr14) : null,
    realizedVol24h: r.realizedVol24h != null ? parseFloat(r.realizedVol24h) : null,
    parkinsonVol24h: r.parkinsonVol24h != null ? parseFloat(r.parkinsonVol24h) : null,
    returns1h: r.returns1h != null ? parseFloat(r.returns1h) : null,
    returns24h: r.returns24h != null ? parseFloat(r.returns24h) : null,
    momentum14: r.momentum14 != null ? parseFloat(r.momentum14) : null,
    emaSlope20: r.emaSlope20 != null ? parseFloat(r.emaSlope20) : null,
    poc: r.poc != null ? parseFloat(r.poc) : null,
    vah: r.vah != null ? parseFloat(r.vah) : null,
    val: r.val != null ? parseFloat(r.val) : null,
    orderbookImbalance: r.orderbookImbalance != null ? parseFloat(r.orderbookImbalance) : null,
    bidAskRatio: r.bidAskRatio != null ? parseFloat(r.bidAskRatio) : null,
    cvd: r.cvd != null ? parseFloat(r.cvd) : null,
    shannonEntropy: r.shannonEntropy != null ? parseFloat(r.shannonEntropy) : null,
    permutationEntropy: r.permutationEntropy != null ? parseFloat(r.permutationEntropy) : null,
  };
}

router.get("/features", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const since = req.query.since as string | undefined;

  const conditions = [eq(featureStoreTable.symbol, symbol)];
  if (since) {
    conditions.push(gte(featureStoreTable.timestamp, new Date(since)));
  }

  const rows = await db
    .select()
    .from(featureStoreTable)
    .where(and(...conditions))
    .orderBy(desc(featureStoreTable.timestamp))
    .limit(limit);

  res.json(rows.map(serializeFeature));
});

router.get("/features/latest", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";

  const [row] = await db
    .select()
    .from(featureStoreTable)
    .where(eq(featureStoreTable.symbol, symbol))
    .orderBy(desc(featureStoreTable.timestamp))
    .limit(1);

  res.json({
    symbol,
    generatedAt: new Date().toISOString(),
    latest: row ? serializeFeature(row) : null,
  });
});

export default router;
