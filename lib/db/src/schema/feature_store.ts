import { pgTable, serial, text, numeric, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const featureStoreTable = pgTable(
  "feature_store",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    atr14: numeric("atr14", { precision: 20, scale: 8 }),
    realizedVol24h: numeric("realized_vol_24h", { precision: 20, scale: 10 }),
    parkinsonVol24h: numeric("parkinson_vol_24h", { precision: 20, scale: 10 }),
    returns1h: numeric("returns_1h", { precision: 20, scale: 10 }),
    returns24h: numeric("returns_24h", { precision: 20, scale: 10 }),
    momentum14: numeric("momentum_14", { precision: 20, scale: 10 }),
    emaSlope20: numeric("ema_slope_20", { precision: 20, scale: 10 }),
    poc: numeric("poc", { precision: 20, scale: 8 }),
    vah: numeric("vah", { precision: 20, scale: 8 }),
    val: numeric("val", { precision: 20, scale: 8 }),
    orderbookImbalance: numeric("orderbook_imbalance", { precision: 20, scale: 8 }),
    bidAskRatio: numeric("bid_ask_ratio", { precision: 20, scale: 8 }),
    cvd: numeric("cvd", { precision: 30, scale: 8 }),
    shannonEntropy: numeric("shannon_entropy", { precision: 20, scale: 10 }),
    permutationEntropy: numeric("permutation_entropy", { precision: 20, scale: 10 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("feature_store_symbol_timestamp_idx").on(t.symbol, t.timestamp),
    unique("feature_store_symbol_timestamp_uniq").on(t.symbol, t.timestamp),
  ]
);

export const insertFeatureSchema = createInsertSchema(featureStoreTable).omit({ id: true, createdAt: true });
export type InsertFeature = z.infer<typeof insertFeatureSchema>;
export type Feature = typeof featureStoreTable.$inferSelect;
