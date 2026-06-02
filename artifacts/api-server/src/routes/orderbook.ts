import { Router } from "express";
import { db } from "@workspace/db";
import { orderbookTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/orderbook", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 200);

  const rows = await db
    .select()
    .from(orderbookTable)
    .where(eq(orderbookTable.symbol, symbol))
    .orderBy(desc(orderbookTable.timestamp))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      timestamp: r.timestamp.toISOString(),
      bids: r.bids,
      asks: r.asks,
      bidAskRatio: parseFloat(r.bidAskRatio),
      midPrice: parseFloat(r.midPrice),
      spread: r.spread ? parseFloat(r.spread) : null,
    }))
  );
});

router.get("/orderbook/latest", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";

  const [row] = await db
    .select()
    .from(orderbookTable)
    .where(eq(orderbookTable.symbol, symbol))
    .orderBy(desc(orderbookTable.timestamp))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "No orderbook data found" });
    return;
  }

  res.json({
    id: row.id,
    symbol: row.symbol,
    timestamp: row.timestamp.toISOString(),
    bids: row.bids,
    asks: row.asks,
    bidAskRatio: parseFloat(row.bidAskRatio),
    midPrice: parseFloat(row.midPrice),
    spread: row.spread ? parseFloat(row.spread) : null,
  });
});

export default router;
