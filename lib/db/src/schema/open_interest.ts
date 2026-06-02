import { pgTable, serial, text, numeric, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const openInterestTable = pgTable(
  "open_interest",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    openInterest: numeric("open_interest", { precision: 30, scale: 8 }).notNull(),
    openInterestValue: numeric("open_interest_value", { precision: 30, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("open_interest_symbol_timestamp_idx").on(t.symbol, t.timestamp),
    unique("open_interest_symbol_timestamp_uniq").on(t.symbol, t.timestamp),
  ]
);

export const insertOpenInterestSchema = createInsertSchema(openInterestTable).omit({ id: true, createdAt: true });
export type InsertOpenInterest = z.infer<typeof insertOpenInterestSchema>;
export type OpenInterest = typeof openInterestTable.$inferSelect;
