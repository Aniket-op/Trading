import { Router } from "express";
import { db } from "@workspace/db";
import { regimeStatesTable } from "@workspace/db";
import { eq, desc, gte, and } from "drizzle-orm";

const router = Router();

// GET /regime/latest — current regime state
router.get("/regime/latest", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";

  const rows = await db
    .select()
    .from(regimeStatesTable)
    .where(eq(regimeStatesTable.symbol, symbol))
    .orderBy(desc(regimeStatesTable.timestamp))
    .limit(1);

  if (!rows.length) {
    return res.status(404).json({ error: "No regime data available yet. Run: python -m quant_bot.regime.trainer" });
  }

  const r = rows[0];
  res.json({
    id: r.id,
    symbol: r.symbol,
    timestamp: r.timestamp?.toISOString() ?? null,
    hmmBull: r.hmmBull ? parseFloat(r.hmmBull) : null,
    hmmBear: r.hmmBear ? parseFloat(r.hmmBear) : null,
    hmmSideways: r.hmmSideways ? parseFloat(r.hmmSideways) : null,
    hmmPanic: r.hmmPanic ? parseFloat(r.hmmPanic) : null,
    hmmState: r.hmmState,
    msRegime: r.msRegime ? parseFloat(r.msRegime) : null,
    msProb0: r.msProb0 ? parseFloat(r.msProb0) : null,
    msProb1: r.msProb1 ? parseFloat(r.msProb1) : null,
    msIsHighVol: r.msIsHighVol,
    modelsAgree: r.modelsAgree,
    regime: r.regime,
    regimeConfidence: r.regimeConfidence ? parseFloat(r.regimeConfidence) : null,
    createdAt: r.createdAt?.toISOString() ?? null,
  });
});

// GET /regime — history of regime states
router.get("/regime", async (req, res) => {
  const symbol = (req.query.symbol as string) || "BTC/USDT";
  const limit = Math.min(parseInt((req.query.limit as string) || "100"), 500);
  const since = req.query.since ? new Date(req.query.since as string) : null;

  let query = db
    .select()
    .from(regimeStatesTable)
    .where(
      since
        ? and(eq(regimeStatesTable.symbol, symbol), gte(regimeStatesTable.timestamp, since))
        : eq(regimeStatesTable.symbol, symbol)
    )
    .orderBy(desc(regimeStatesTable.timestamp))
    .limit(limit);

  const rows = await query;

  res.json(
    rows.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      timestamp: r.timestamp?.toISOString() ?? null,
      hmmBull: r.hmmBull ? parseFloat(r.hmmBull) : null,
      hmmBear: r.hmmBear ? parseFloat(r.hmmBear) : null,
      hmmSideways: r.hmmSideways ? parseFloat(r.hmmSideways) : null,
      hmmPanic: r.hmmPanic ? parseFloat(r.hmmPanic) : null,
      hmmState: r.hmmState,
      msRegime: r.msRegime ? parseFloat(r.msRegime) : null,
      msProb0: r.msProb0 ? parseFloat(r.msProb0) : null,
      msProb1: r.msProb1 ? parseFloat(r.msProb1) : null,
      msIsHighVol: r.msIsHighVol,
      modelsAgree: r.modelsAgree,
      regime: r.regime,
      regimeConfidence: r.regimeConfidence ? parseFloat(r.regimeConfidence) : null,
      createdAt: r.createdAt?.toISOString() ?? null,
    }))
  );
});

export default router;
