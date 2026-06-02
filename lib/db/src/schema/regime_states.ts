import { pgTable, serial, text, numeric, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const regimeStatesTable = pgTable(
  "regime_states",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),

    // HMM state probabilities
    hmmBull: numeric("hmm_bull", { precision: 10, scale: 6 }),
    hmmBear: numeric("hmm_bear", { precision: 10, scale: 6 }),
    hmmSideways: numeric("hmm_sideways", { precision: 10, scale: 6 }),
    hmmPanic: numeric("hmm_panic", { precision: 10, scale: 6 }),
    hmmState: text("hmm_state"),                  // "Bull" | "Bear" | "Sideways" | "Panic"

    // Markov Switching outputs
    msRegime: numeric("ms_regime"),
    msProb0: numeric("ms_prob_0", { precision: 10, scale: 6 }),
    msProb1: numeric("ms_prob_1", { precision: 10, scale: 6 }),
    msIsHighVol: boolean("ms_is_high_vol"),

    // Agreement between models
    modelsAgree: boolean("models_agree"),

    // Final combined output
    regime: text("regime"),                        // "Bull" | "Bear" | "Sideways" | "Panic"
    regimeConfidence: numeric("regime_confidence", { precision: 10, scale: 6 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("regime_states_symbol_timestamp_idx").on(t.symbol, t.timestamp),
    unique("regime_states_symbol_timestamp_uniq").on(t.symbol, t.timestamp),
  ]
);

export const insertRegimeStateSchema = createInsertSchema(regimeStatesTable).omit({ id: true, createdAt: true });
export type InsertRegimeState = z.infer<typeof insertRegimeStateSchema>;
export type RegimeState = typeof regimeStatesTable.$inferSelect;
