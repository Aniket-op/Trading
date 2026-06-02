import { Router } from "express";
import { db } from "@workspace/db";
import { openInterestTable } from "@workspace/db";
import { desc, eq, and, gte } from "drizzle-orm";

const router = Router();

router.get("/open-interest", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const since = req.query.since as string | undefined;

  const conditions = [eq(openInterestTable.symbol, symbol)];
  if (since) {
    conditions.push(gte(openInterestTable.timestamp, new Date(since)));
  }

  const rows = await db
    .select()
    .from(openInterestTable)
    .where(and(...conditions))
    .orderBy(desc(openInterestTable.timestamp))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      timestamp: r.timestamp.toISOString(),
      openInterest: parseFloat(r.openInterest),
      openInterestValue: parseFloat(r.openInterestValue),
    }))
  );
});

router.get("/open-interest/latest", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";

  const [row] = await db
    .select()
    .from(openInterestTable)
    .where(eq(openInterestTable.symbol, symbol))
    .orderBy(desc(openInterestTable.timestamp))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "No open interest data found" });
    return;
  }

  res.json({
    id: row.id,
    symbol: row.symbol,
    timestamp: row.timestamp.toISOString(),
    openInterest: parseFloat(row.openInterest),
    openInterestValue: parseFloat(row.openInterestValue),
  });
});

export default router;
