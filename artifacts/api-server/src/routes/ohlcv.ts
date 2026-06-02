import { Router } from "express";
import { db } from "@workspace/db";
import { ohlcvTable } from "@workspace/db";
import { desc, eq, and, gte, sql } from "drizzle-orm";

const router = Router();

router.get("/ohlcv", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";
  const timeframe = (req.query.timeframe as string) || "1h";
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const since = req.query.since as string | undefined;

  const conditions = [eq(ohlcvTable.symbol, symbol), eq(ohlcvTable.timeframe, timeframe)];
  if (since) {
    conditions.push(gte(ohlcvTable.timestamp, new Date(since)));
  }

  const rows = await db
    .select()
    .from(ohlcvTable)
    .where(and(...conditions))
    .orderBy(desc(ohlcvTable.timestamp))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      timeframe: r.timeframe,
      timestamp: r.timestamp.toISOString(),
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseFloat(r.volume),
    }))
  );
});

router.get("/ohlcv/latest", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";
  const timeframes = ["1m", "5m", "15m", "1h"];

  const results: Record<string, unknown> = { symbol };

  await Promise.all(
    timeframes.map(async (tf) => {
      const [row] = await db
        .select()
        .from(ohlcvTable)
        .where(and(eq(ohlcvTable.symbol, symbol), eq(ohlcvTable.timeframe, tf)))
        .orderBy(desc(ohlcvTable.timestamp))
        .limit(1);

      if (row) {
        results[tf] = {
          id: row.id,
          symbol: row.symbol,
          timeframe: row.timeframe,
          timestamp: row.timestamp.toISOString(),
          open: parseFloat(row.open),
          high: parseFloat(row.high),
          low: parseFloat(row.low),
          close: parseFloat(row.close),
          volume: parseFloat(row.volume),
        };
      }
    })
  );

  res.json(results);
});

export default router;
