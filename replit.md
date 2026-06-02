# Quant Bot — Data Infrastructure

A crypto quantitative trading data pipeline with a real-time monitoring dashboard. Collects OHLCV, funding rates, open interest, liquidations, and order book snapshots from Binance Futures. Built in phases following a hedge-fund-style methodology.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

### Python Data Collector

```bash
cd quant_bot
pip install -r requirements.txt

# One-time backfill (6 months of historical OHLCV):
python -m quant_bot.data_collector.backfill

# Live collector (runs every 60 seconds):
python -m quant_bot.data_collector.collector
```

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite, TanStack Query, Recharts, Wouter
- Python: CCXT, psycopg2, asyncio

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/` — Drizzle DB schema (ohlcv, funding, open_interest, liquidations, orderbook)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/dashboard/src/` — React monitoring dashboard
- `quant_bot/data_collector/` — Python CCXT collectors
  - `collector.py` — live collection loop (runs every 60s)
  - `backfill.py` — 6-month historical backfill

## Architecture decisions

- Contract-first OpenAPI spec drives both frontend hooks (React Query) and backend Zod validation schemas via Orval codegen.
- Python data collector is independent of the Node.js API server — it writes directly to PostgreSQL, the API server reads from the same DB.
- `ON CONFLICT DO NOTHING` on OHLCV, funding, and open interest ensures idempotent upserts; the collector can restart safely.
- Liquidations and orderbook snapshots are append-only (no unique constraint) since each snapshot is a distinct event.
- React Query `refetchInterval: 30000` on all dashboard queries provides live monitoring without WebSockets.

## Product — Phase 1: Data Infrastructure

- Real-time dashboard showing BTC/USDT market snapshot (price, funding, OI, liquidations)
- Collector health monitoring — shows status (healthy/stale/empty) and record counts per data type
- DB statistics table showing data age and total records
- Per-table views: OHLCV (multi-timeframe), Funding Rates, Open Interest, Liquidations, Orderbook
- Recharts price/rate charts with 30s auto-refresh

## Phase Roadmap

- **Phase 1** ✅ — Data infrastructure (OHLCV, funding, OI, liquidations, orderbook + dashboard)
- **Phase 2** — Feature engine (ATR, realized vol, volume profile, orderbook imbalance, CVD, entropy)
- **Phase 3** — Regime detection (HMM + Markov Switching)
- **Phase 4** — Kalman trend filter
- **Phase 5** — Bayesian probability engine
- **Phase 6** — Alpha engine
- **Phase 7** — Risk engine (kill switch, volatility scaling, drawdown limits)
- **Phase 8** — Position sizing (Kelly fraction, risk-per-trade)
- **Phase 9** — Backtesting (walk-forward, Monte Carlo)
- **Phase 10** — Paper trading (Binance Futures Testnet)
- **Phase 11** — Live deployment

## Gotchas

- Always run `pnpm run typecheck:libs` after changing `lib/db/src/schema/` before typechecking the API server.
- Run `pnpm --filter @workspace/api-spec run codegen` after every OpenAPI spec change.
- The Python collector requires `DATABASE_URL` env var — same one used by the Node API server.
- Binance does not expose a public REST endpoint for live liquidation data; `collector.py` uses aggTrades filtered approach. For full liquidation streams, a WebSocket feed (`wss://fstream.binance.com/stream?streams=btcusdt@forceOrder`) is needed.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
