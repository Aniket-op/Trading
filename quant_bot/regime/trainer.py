"""
Phase 3 — Regime Trainer + Live Runner

Handles:
  1. Loading raw data from PostgreSQL
  2. Building feature matrix for HMM + MS
  3. Training both models
  4. Running live inference every 60s
  5. Storing regime results to `regime_states` table

Run:
    python -m quant_bot.regime.trainer

DB table required:
    CREATE TABLE IF NOT EXISTS regime_states (
        id           SERIAL PRIMARY KEY,
        symbol       TEXT NOT NULL,
        timestamp    TIMESTAMPTZ NOT NULL,
        hmm_bull     NUMERIC(10, 6),
        hmm_bear     NUMERIC(10, 6),
        hmm_sideways NUMERIC(10, 6),
        hmm_panic    NUMERIC(10, 6),
        hmm_state    TEXT,
        ms_regime    INTEGER,
        ms_prob_0    NUMERIC(10, 6),
        ms_prob_1    NUMERIC(10, 6),
        ms_is_high_vol BOOLEAN,
        models_agree BOOLEAN,
        regime       TEXT,
        regime_confidence NUMERIC(10, 6),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (symbol, timestamp)
    );
"""

import logging
import os
import sys
import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras

from .regime_classifier import RegimeClassifier

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("regime.trainer")

DATABASE_URL = os.getenv("DATABASE_URL", "")
SYMBOL = "BTC/USDT"
INTERVAL_SECONDS = 60

# How many hours of 1h candles to train on (~6 months)
TRAINING_WINDOW_HOURS = 4320  # 6 months

# Minimum hours before we can train
MIN_TRAINING_HOURS = 200


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def ensure_regime_table(conn):
    """Create regime_states table if it doesn't exist."""
    sql = """
        CREATE TABLE IF NOT EXISTS regime_states (
            id               SERIAL PRIMARY KEY,
            symbol           TEXT NOT NULL,
            timestamp        TIMESTAMPTZ NOT NULL,
            hmm_bull         NUMERIC(10, 6),
            hmm_bear         NUMERIC(10, 6),
            hmm_sideways     NUMERIC(10, 6),
            hmm_panic        NUMERIC(10, 6),
            hmm_state        TEXT,
            ms_regime        INTEGER,
            ms_prob_0        NUMERIC(10, 6),
            ms_prob_1        NUMERIC(10, 6),
            ms_is_high_vol   BOOLEAN,
            models_agree     BOOLEAN,
            regime           TEXT,
            regime_confidence NUMERIC(10, 6),
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (symbol, timestamp)
        );
    """
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    log.info("regime_states table ready")


def fetch_ohlcv_for_regime(conn, symbol: str, limit: int) -> pd.DataFrame:
    """
    Fetch the most recent `limit` 1h candles, ordered oldest→newest.
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT timestamp, open, high, low, close, volume
            FROM (
                SELECT timestamp, open, high, low, close, volume
                FROM ohlcv
                WHERE symbol = %s AND timeframe = '1h'
                ORDER BY timestamp DESC
                LIMIT %s
            ) sub
            ORDER BY timestamp ASC
            """,
            (symbol, limit),
        )
        rows = cur.fetchall()

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def fetch_realized_vol(conn, symbol: str, limit_1m: int = 1440) -> pd.Series:
    """
    Fetch 1m close prices for realized vol computation.
    Returns a Series of 1m realized vol (rolling 60-bar, annualized).
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT timestamp, close
            FROM (
                SELECT timestamp, close
                FROM ohlcv
                WHERE symbol = %s AND timeframe = '1m'
                ORDER BY timestamp DESC
                LIMIT %s
            ) sub
            ORDER BY timestamp ASC
            """,
            (symbol, limit_1m),
        )
        rows = cur.fetchall()

    if not rows:
        return pd.Series(dtype=float)

    df = pd.DataFrame(rows)
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    log_returns = np.log(df["close"] / df["close"].shift(1))
    # Rolling 60m realized vol, annualized
    realized_vol = log_returns.rolling(60).std() * np.sqrt(525600)
    return realized_vol.dropna()


def build_hmm_features(df_1h: pd.DataFrame, realized_vol_series: pd.Series) -> pd.DataFrame:
    """
    Build the (T, 3) feature matrix for HMM:
      - returns:       1h log returns
      - volatility:    aligned realized vol (from 1m, mapped to 1h)
      - volume_change: normalized 1h volume change

    Returns DataFrame with columns [returns, volatility, volume_change],
    indexed by timestamp, NaNs forward-filled.
    """
    close = df_1h["close"].astype(float)
    volume = df_1h["volume"].astype(float)

    returns = np.log(close / close.shift(1))
    volume_change = volume.pct_change()

    # Use realized vol from 1m as volatility signal (constant per hour)
    # If available, use the last known value aligned to 1h timestamps
    if len(realized_vol_series) > 0:
        vol_scalar = float(realized_vol_series.iloc[-1])
    else:
        vol_scalar = float(returns.std() * np.sqrt(8760))  # fallback: daily vol annualized

    # For historical training, compute rolling 24h realized vol on the 1h data
    rolling_vol = returns.rolling(24).std() * np.sqrt(8760)

    features = pd.DataFrame({
        "returns": returns,
        "volatility": rolling_vol,
        "volume_change": volume_change,
    }, index=df_1h.index)

    features = features.replace([np.inf, -np.inf], np.nan)
    features = features.fillna(method="ffill").fillna(0.0)
    features = features.dropna()

    return features


def upsert_regime(conn, result: dict):
    """Store regime classification result to DB."""
    sql = """
        INSERT INTO regime_states (
            symbol, timestamp,
            hmm_bull, hmm_bear, hmm_sideways, hmm_panic,
            hmm_state,
            ms_regime, ms_prob_0, ms_prob_1, ms_is_high_vol,
            models_agree,
            regime, regime_confidence
        )
        VALUES (
            %(symbol)s, %(timestamp)s,
            %(hmm_bull)s, %(hmm_bear)s, %(hmm_sideways)s, %(hmm_panic)s,
            %(hmm_state)s,
            %(ms_regime)s, %(ms_prob_0)s, %(ms_prob_1)s, %(ms_is_high_vol)s,
            %(models_agree)s,
            %(regime)s, %(regime_confidence)s
        )
        ON CONFLICT (symbol, timestamp) DO UPDATE SET
            hmm_bull         = EXCLUDED.hmm_bull,
            hmm_bear         = EXCLUDED.hmm_bear,
            hmm_sideways     = EXCLUDED.hmm_sideways,
            hmm_panic        = EXCLUDED.hmm_panic,
            hmm_state        = EXCLUDED.hmm_state,
            ms_regime        = EXCLUDED.ms_regime,
            ms_prob_0        = EXCLUDED.ms_prob_0,
            ms_prob_1        = EXCLUDED.ms_prob_1,
            ms_is_high_vol   = EXCLUDED.ms_is_high_vol,
            models_agree     = EXCLUDED.models_agree,
            regime           = EXCLUDED.regime,
            regime_confidence = EXCLUDED.regime_confidence
    """
    
    clean_row = {}
    for k, v in result.items():
        if isinstance(v, np.bool_):
            clean_row[k] = bool(v)
        elif isinstance(v, (np.float64, np.float32)):
            clean_row[k] = float(v)
        elif isinstance(v, (np.int64, np.int32)):
            clean_row[k] = int(v)
        else:
            clean_row[k] = v
            
    with conn.cursor() as cur:
        cur.execute(sql, clean_row)
    conn.commit()


def run_once(conn, classifier: RegimeClassifier) -> dict | None:
    """
    One full regime classification cycle.
    Returns the classification result dict, or None on failure.
    """
    df_1h = fetch_ohlcv_for_regime(conn, SYMBOL, TRAINING_WINDOW_HOURS)
    if df_1h.empty or len(df_1h) < MIN_TRAINING_HOURS:
        log.warning(f"Insufficient 1h OHLCV data: {len(df_1h)} rows (need {MIN_TRAINING_HOURS})")
        return None

    realized_vol = fetch_realized_vol(conn, SYMBOL)
    features = build_hmm_features(df_1h, realized_vol)

    if len(features) < MIN_TRAINING_HOURS:
        log.warning(f"Not enough feature rows after cleaning: {len(features)}")
        return None

    # Build returns series for MS model (1h log returns)
    close = df_1h["close"].astype(float)
    returns_series = np.log(close / close.shift(1)).dropna()

    try:
        result = classifier.classify(features, returns_series, symbol=SYMBOL)
        upsert_regime(conn, result)
        log.info(
            f"✅ Regime: {result['regime']} | "
            f"confidence={result['regime_confidence']:.3f} | "
            f"Bull={result['hmm_bull']:.3f} Bear={result['hmm_bear']:.3f} "
            f"Sideways={result['hmm_sideways']:.3f} Panic={result['hmm_panic']:.3f} | "
            f"agree={result['models_agree']}"
        )
        return result
    except Exception as e:
        log.error(f"Classification error: {e}", exc_info=True)
        return None


def main():
    if not DATABASE_URL:
        log.error("DATABASE_URL environment variable is not set")
        sys.exit(1)

    conn = get_conn()
    ensure_regime_table(conn)

    log.info(f"Regime engine starting for {SYMBOL}...")
    log.info("Loading OHLCV data for initial training...")

    # Initial training
    df_1h = fetch_ohlcv_for_regime(conn, SYMBOL, TRAINING_WINDOW_HOURS)
    if df_1h.empty or len(df_1h) < MIN_TRAINING_HOURS:
        log.error(
            f"Not enough data for initial training. "
            f"Got {len(df_1h)} hours, need {MIN_TRAINING_HOURS}. "
            f"Run the data collector first."
        )
        sys.exit(1)

    realized_vol = fetch_realized_vol(conn, SYMBOL)
    features = build_hmm_features(df_1h, realized_vol)
    close = df_1h["close"].astype(float)
    returns_series = np.log(close / close.shift(1)).dropna()

    classifier = RegimeClassifier()
    classifier.train(features, returns_series)

    # Try loading saved HMM if training failed
    if not classifier._hmm_trained:
        log.warning("HMM training failed, trying to load saved model...")
        try:
            classifier.load()
        except Exception:
            log.error("No saved model available. Exiting.")
            sys.exit(1)

    # Save after initial training
    classifier.save()
    log.info("Models trained and saved. Starting live inference loop...")

    RETRAIN_INTERVAL = 3600  # retrain every hour
    last_retrain = time.time()

    try:
        while True:
            cycle_start = time.time()

            # Retrain periodically on fresh data
            if time.time() - last_retrain > RETRAIN_INTERVAL:
                log.info("Retraining regime models on latest data...")
                df_fresh = fetch_ohlcv_for_regime(conn, SYMBOL, TRAINING_WINDOW_HOURS)
                if len(df_fresh) >= MIN_TRAINING_HOURS:
                    rv_fresh = fetch_realized_vol(conn, SYMBOL)
                    feat_fresh = build_hmm_features(df_fresh, rv_fresh)
                    ret_fresh = np.log(df_fresh["close"].astype(float) / df_fresh["close"].astype(float).shift(1)).dropna()
                    try:
                        classifier.train(feat_fresh, ret_fresh)
                        classifier.save()
                        last_retrain = time.time()
                        log.info("Regime models retrained successfully")
                    except Exception as e:
                        log.error(f"Retrain failed: {e}")

            run_once(conn, classifier)

            elapsed = time.time() - cycle_start
            sleep_time = max(0, INTERVAL_SECONDS - elapsed)
            log.info(f"Regime cycle: {elapsed:.1f}s, sleeping {sleep_time:.1f}s")
            time.sleep(sleep_time)

    except KeyboardInterrupt:
        log.info("Regime engine stopped")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
