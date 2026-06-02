import { pgTable, serial, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orderbookTable = pgTable(
  "orderbook",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    bids: text("bids").notNull(),
    asks: text("asks").notNull(),
    bidAskRatio: numeric("bid_ask_ratio", { precision: 20, scale: 8 }).notNull(),
    midPrice: numeric("mid_price", { precision: 20, scale: 8 }).notNull(),
    spread: numeric("spread", { precision: 20, scale: 8 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orderbook_symbol_timestamp_idx").on(t.symbol, t.timestamp),
  ]
);

export const insertOrderbookSchema = createInsertSchema(orderbookTable).omit({ id: true, createdAt: true });
export type InsertOrderbook = z.infer<typeof insertOrderbookSchema>;
export type Orderbook = typeof orderbookTable.$inferSelect;
