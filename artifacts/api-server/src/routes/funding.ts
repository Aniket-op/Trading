import { Router } from "express";
import { db } from "@workspace/db";
import { fundingTable } from "@workspace/db";
import { desc, eq, and, gte } from "drizzle-orm";

const router = Router();

router.get("/funding", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const since = req.query.since as string | undefined;

  const conditions = [eq(fundingTable.symbol, symbol)];
  if (since) {
    conditions.push(gte(fundingTable.timestamp, new Date(since)));
  }

  const rows = await db
    .select()
    .from(fundingTable)
    .where(and(...conditions))
    .orderBy(desc(fundingTable.timestamp))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      timestamp: r.timestamp.toISOString(),
      fundingRate: parseFloat(r.fundingRate),
      nextFundingTime: r.nextFundingTime?.toISOString() ?? null,
    }))
  );
});

router.get("/funding/latest", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";

  const [row] = await db
    .select()
    .from(fundingTable)
    .where(eq(fundingTable.symbol, symbol))
    .orderBy(desc(fundingTable.timestamp))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "No funding rate data found" });
    return;
  }

  res.json({
    id: row.id,
    symbol: row.symbol,
    timestamp: row.timestamp.toISOString(),
    fundingRate: parseFloat(row.fundingRate),
    nextFundingTime: row.nextFundingTime?.toISOString() ?? null,
  });
});

export default router;
