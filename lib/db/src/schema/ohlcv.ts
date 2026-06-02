import { pgTable, serial, text, numeric, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ohlcvTable = pgTable(
  "ohlcv",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    open: numeric("open", { precision: 20, scale: 8 }).notNull(),
    high: numeric("high", { precision: 20, scale: 8 }).notNull(),
    low: numeric("low", { precision: 20, scale: 8 }).notNull(),
    close: numeric("close", { precision: 20, scale: 8 }).notNull(),
    volume: numeric("volume", { precision: 30, scale: 8 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ohlcv_symbol_timeframe_timestamp_idx").on(t.symbol, t.timeframe, t.timestamp),
    unique("ohlcv_symbol_timeframe_timestamp_uniq").on(t.symbol, t.timeframe, t.timestamp),
  ]
);

export const insertOhlcvSchema = createInsertSchema(ohlcvTable).omit({ id: true, createdAt: true });
export type InsertOhlcv = z.infer<typeof insertOhlcvSchema>;
export type Ohlcv = typeof ohlcvTable.$inferSelect;
