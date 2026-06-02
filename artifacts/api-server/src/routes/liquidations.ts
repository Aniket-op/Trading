import { Router } from "express";
import { db } from "@workspace/db";
import { liquidationsTable } from "@workspace/db";
import { desc, eq, and, gte } from "drizzle-orm";

const router = Router();

router.get("/liquidations", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const since = req.query.since as string | undefined;

  const conditions = [eq(liquidationsTable.symbol, symbol)];
  if (since) {
    conditions.push(gte(liquidationsTable.timestamp, new Date(since)));
  }

  const rows = await db
    .select()
    .from(liquidationsTable)
    .where(and(...conditions))
    .orderBy(desc(liquidationsTable.timestamp))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      timestamp: r.timestamp.toISOString(),
      side: r.side,
      price: parseFloat(r.price),
      quantity: parseFloat(r.quantity),
      value: parseFloat(r.value),
    }))
  );
});

export default router;
