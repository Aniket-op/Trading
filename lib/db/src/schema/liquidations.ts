import { pgTable, serial, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const liquidationsTable = pgTable(
  "liquidations",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    side: text("side").notNull(),
    price: numeric("price", { precision: 20, scale: 8 }).notNull(),
    quantity: numeric("quantity", { precision: 30, scale: 8 }).notNull(),
    value: numeric("value", { precision: 30, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("liquidations_symbol_timestamp_idx").on(t.symbol, t.timestamp),
    index("liquidations_symbol_side_idx").on(t.symbol, t.side),
  ]
);

export const insertLiquidationSchema = createInsertSchema(liquidationsTable).omit({ id: true, createdAt: true });
export type InsertLiquidation = z.infer<typeof insertLiquidationSchema>;
export type Liquidation = typeof liquidationsTable.$inferSelect;
