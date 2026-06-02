-- quant_bot database schema
-- Phase 1: Data Infrastructure

CREATE TABLE IF NOT EXISTS ohlcv (
    id          SERIAL PRIMARY KEY,
    symbol      TEXT NOT NULL,
    timeframe   TEXT NOT NULL,
    timestamp   TIMESTAMPTZ NOT NULL,
    open        NUMERIC(20, 8) NOT NULL,
    high        NUMERIC(20, 8) NOT NULL,
    low         NUMERIC(20, 8) NOT NULL,
    close       NUMERIC(20, 8) NOT NULL,
    volume      NUMERIC(30, 8) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (symbol, timeframe, timestamp)
);
CREATE INDEX IF NOT EXISTS ohlcv_symbol_timeframe_timestamp_idx ON ohlcv (symbol, timeframe, timestamp);

CREATE TABLE IF NOT EXISTS funding (
    id               SERIAL PRIMARY KEY,
    symbol           TEXT NOT NULL,
    timestamp        TIMESTAMPTZ NOT NULL,
    funding_rate     NUMERIC(20, 10) NOT NULL,
    next_funding_time TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (symbol, timestamp)
);

CREATE TABLE IF NOT EXISTS open_interest (
    id                  SERIAL PRIMARY KEY,
    symbol              TEXT NOT NULL,
    timestamp           TIMESTAMPTZ NOT NULL,
    open_interest       NUMERIC(30, 8) NOT NULL,
    open_interest_value NUMERIC(30, 8) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (symbol, timestamp)
);

CREATE TABLE IF NOT EXISTS liquidations (
    id         SERIAL PRIMARY KEY,
    symbol     TEXT NOT NULL,
    timestamp  TIMESTAMPTZ NOT NULL,
    side       TEXT NOT NULL,
    price      NUMERIC(20, 8) NOT NULL,
    quantity   NUMERIC(30, 8) NOT NULL,
    value      NUMERIC(30, 8) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS liquidations_symbol_timestamp_idx ON liquidations (symbol, timestamp);

CREATE TABLE IF NOT EXISTS orderbook (
    id            SERIAL PRIMARY KEY,
    symbol        TEXT NOT NULL,
    timestamp     TIMESTAMPTZ NOT NULL,
    bids          TEXT NOT NULL,
    asks          TEXT NOT NULL,
    bid_ask_ratio NUMERIC(20, 8),
    mid_price     NUMERIC(20, 8),
    spread        NUMERIC(20, 8),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orderbook_symbol_timestamp_idx ON orderbook (symbol, timestamp);

-- Phase 2: Feature Store

CREATE TABLE IF NOT EXISTS feature_store (
    id                  SERIAL PRIMARY KEY,
    symbol              TEXT NOT NULL,
    timestamp           TIMESTAMPTZ NOT NULL,
    atr14               NUMERIC(20, 8),
    realized_vol_24h    NUMERIC(20, 10),
    parkinson_vol_24h   NUMERIC(20, 10),
    returns_1h          NUMERIC(20, 10),
    returns_24h         NUMERIC(20, 10),
    momentum_14         NUMERIC(20, 10),
    ema_slope_20        NUMERIC(20, 10),
    poc                 NUMERIC(20, 8),
    vah                 NUMERIC(20, 8),
    val                 NUMERIC(20, 8),
    orderbook_imbalance NUMERIC(20, 8),
    bid_ask_ratio       NUMERIC(20, 8),
    cvd                 NUMERIC(30, 8),
    shannon_entropy     NUMERIC(20, 10),
    permutation_entropy NUMERIC(20, 10),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (symbol, timestamp)
);
CREATE INDEX IF NOT EXISTS feature_store_symbol_timestamp_idx ON feature_store (symbol, timestamp);

-- Phase 3: Regime Detection

CREATE TABLE IF NOT EXISTS regime_states (
    id                SERIAL PRIMARY KEY,
    symbol            TEXT NOT NULL,
    timestamp         TIMESTAMPTZ NOT NULL,
    hmm_bull          NUMERIC(10, 6),
    hmm_bear          NUMERIC(10, 6),
    hmm_sideways      NUMERIC(10, 6),
    hmm_panic         NUMERIC(10, 6),
    hmm_state         TEXT,
    ms_regime         INTEGER,
    ms_prob_0         NUMERIC(10, 6),
    ms_prob_1         NUMERIC(10, 6),
    ms_is_high_vol    BOOLEAN,
    models_agree      BOOLEAN,
    regime            TEXT,
    regime_confidence NUMERIC(10, 6),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (symbol, timestamp)
);
CREATE INDEX IF NOT EXISTS regime_states_symbol_timestamp_idx ON regime_states (symbol, timestamp);
