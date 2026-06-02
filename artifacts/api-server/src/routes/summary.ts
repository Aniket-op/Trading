import { Router } from "express";
import { db } from "@workspace/db";
import { ohlcvTable, fundingTable, openInterestTable, liquidationsTable, orderbookTable } from "@workspace/db";
import { count, max, min, eq, desc, and, gte, sql } from "drizzle-orm";

const router = Router();

router.get("/summary/overview", async (req, res) => {
  const now = new Date();

  const [ohlcvStats, fundingStats, oiStats, liqStats, obStats] = await Promise.all([
    db.select({ count: count(), latest: max(ohlcvTable.timestamp), oldest: min(ohlcvTable.timestamp) }).from(ohlcvTable),
    db.select({ count: count(), latest: max(fundingTable.timestamp), oldest: min(fundingTable.timestamp) }).from(fundingTable),
    db.select({ count: count(), latest: max(openInterestTable.timestamp), oldest: min(openInterestTable.timestamp) }).from(openInterestTable),
    db.select({ count: count(), latest: max(liquidationsTable.timestamp), oldest: min(liquidationsTable.timestamp) }).from(liquidationsTable),
    db.select({ count: count(), latest: max(orderbookTable.timestamp), oldest: min(orderbookTable.timestamp) }).from(orderbookTable),
  ]);

  const makeTableSummary = (tableName: string, stats: { count: number; latest: Date | null; oldest: Date | null }[]) => {
    const s = stats[0];
    const latest = s.latest;
    const ageMinutes = latest ? (now.getTime() - latest.getTime()) / 60000 : null;
    return {
      table: tableName,
      recordCount: s.count,
      latestTimestamp: latest?.toISOString() ?? null,
      oldestTimestamp: s.oldest?.toISOString() ?? null,
      dataAgeMinutes: ageMinutes !== null ? Math.round(ageMinutes * 10) / 10 : null,
    };
  };

  const tables = [
    makeTableSummary("ohlcv", ohlcvStats),
    makeTableSummary("funding", fundingStats),
    makeTableSummary("open_interest", oiStats),
    makeTableSummary("liquidations", liqStats),
    makeTableSummary("orderbook", obStats),
  ];

  const totalRecords = tables.reduce((sum, t) => sum + t.recordCount, 0);

  res.json({ generatedAt: now.toISOString(), totalRecords, tables });
});

router.get("/summary/market-snapshot", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);

  const [latestOhlcv1h, prevOhlcv1h, latestFunding, latestOI, latestOB] = await Promise.all([
    db.select().from(ohlcvTable).where(and(eq(ohlcvTable.symbol, symbol), eq(ohlcvTable.timeframe, "1h"))).orderBy(desc(ohlcvTable.timestamp)).limit(1),
    db.select().from(ohlcvTable).where(and(eq(ohlcvTable.symbol, symbol), eq(ohlcvTable.timeframe, "1h"))).orderBy(desc(ohlcvTable.timestamp)).limit(2),
    db.select().from(fundingTable).where(eq(fundingTable.symbol, symbol)).orderBy(desc(fundingTable.timestamp)).limit(1),
    db.select().from(openInterestTable).where(eq(openInterestTable.symbol, symbol)).orderBy(desc(openInterestTable.timestamp)).limit(1),
    db.select().from(orderbookTable).where(eq(orderbookTable.symbol, symbol)).orderBy(desc(orderbookTable.timestamp)).limit(1),
  ]);

  const [liqStats, ohlcvVolume1h] = await Promise.all([
    db
      .select({
        liqCount: count(),
        liqValue: sql<string>`COALESCE(SUM(CAST(${liquidationsTable.value} AS numeric)), 0)`,
      })
      .from(liquidationsTable)
      .where(and(eq(liquidationsTable.symbol, symbol), gte(liquidationsTable.timestamp, oneHourAgo))),
    db
      .select({ vol: sql<string>`COALESCE(SUM(CAST(${ohlcvTable.volume} AS numeric)), 0)` })
      .from(ohlcvTable)
      .where(and(eq(ohlcvTable.symbol, symbol), eq(ohlcvTable.timeframe, "1m"), gte(ohlcvTable.timestamp, oneHourAgo))),
  ]);

  const currentPrice = latestOhlcv1h[0] ? parseFloat(latestOhlcv1h[0].close) : null;
  const prevClose = prevOhlcv1h[1] ? parseFloat(prevOhlcv1h[1].close) : null;
  const priceChange1h = currentPrice !== null && prevClose !== null ? ((currentPrice - prevClose) / prevClose) * 100 : null;

  res.json({
    symbol,
    generatedAt: now.toISOString(),
    currentPrice,
    priceChange1h: priceChange1h !== null ? Math.round(priceChange1h * 100) / 100 : null,
    fundingRate: latestFunding[0] ? parseFloat(latestFunding[0].fundingRate) : null,
    openInterest: latestOI[0] ? parseFloat(latestOI[0].openInterest) : null,
    openInterestValue: latestOI[0] ? parseFloat(latestOI[0].openInterestValue) : null,
    liquidations1h: liqStats[0] ? liqStats[0].liqCount : null,
    liquidationsValue1h: liqStats[0] ? parseFloat(liqStats[0].liqValue) : null,
    bidAskRatio: latestOB[0] ? parseFloat(latestOB[0].bidAskRatio) : null,
    volume1h: ohlcvVolume1h[0] ? parseFloat(ohlcvVolume1h[0].vol) : null,
  });
});

export default router;
