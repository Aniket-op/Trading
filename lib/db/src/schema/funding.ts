import { pgTable, serial, text, numeric, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fundingTable = pgTable(
  "funding",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    fundingRate: numeric("funding_rate", { precision: 20, scale: 10 }).notNull(),
    nextFundingTime: timestamp("next_funding_time", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("funding_symbol_timestamp_idx").on(t.symbol, t.timestamp),
    unique("funding_symbol_timestamp_uniq").on(t.symbol, t.timestamp),
  ]
);

export const insertFundingSchema = createInsertSchema(fundingTable).omit({ id: true, createdAt: true });
export type InsertFunding = z.infer<typeof insertFundingSchema>;
export type Funding = typeof fundingTable.$inferSelect;
