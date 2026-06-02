"""
Phase 2 Feature Engine — main runner.

Reads from ohlcv, orderbook tables, computes all features, stores to feature_store.

Run:
    python -m quant_bot.feature_engine.engine
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone

import pandas as pd
import psycopg2
import psycopg2.extras

from .volatility import compute_atr, compute_realized_vol, compute_parkinson_vol
from .market_structure import compute_volume_profile
from .trend import compute_returns, compute_momentum, compute_ema_slope
from .microstructure import compute_orderbook_features, compute_cvd
from .entropy import compute_shannon_entropy, compute_permutation_entropy

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("feature_engine")

DATABASE_URL = os.getenv("DATABASE_URL", "")
SYMBOL = "BTC/USDT"
INTERVAL_SECONDS = 60


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def fetch_ohlcv(conn, symbol: str, timeframe: str, limit: int) -> pd.DataFrame:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT timestamp, open, high, low, close, volume
            FROM ohlcv
            WHERE symbol = %s AND timeframe = %s
            ORDER BY timestamp ASC
            LIMIT %s
            """,
            (symbol, timeframe, limit),
        )
        rows = cur.fetchall()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def fetch_orderbook(conn, symbol: str, limit: int = 20) -> list[dict]:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT bids, asks, bid_ask_ratio
            FROM orderbook
            WHERE symbol = %s
            ORDER BY timestamp DESC
            LIMIT %s
            """,
            (symbol, limit),
        )
        return [dict(r) for r in cur.fetchall()]


def upsert_features(conn, row: dict):
    sql = """
        INSERT INTO feature_store (
            symbol, timestamp,
            atr14, realized_vol_24h, parkinson_vol_24h,
            returns_1h, returns_24h, momentum_14, ema_slope_20,
            poc, vah, val,
            orderbook_imbalance, bid_ask_ratio, cvd,
            shannon_entropy, permutation_entropy
        )
        VALUES (
            %(symbol)s, %(timestamp)s,
            %(atr14)s, %(realized_vol_24h)s, %(parkinson_vol_24h)s,
            %(returns_1h)s, %(returns_24h)s, %(momentum_14)s, %(ema_slope_20)s,
            %(poc)s, %(vah)s, %(val)s,
            %(orderbook_imbalance)s, %(bid_ask_ratio)s, %(cvd)s,
            %(shannon_entropy)s, %(permutation_entropy)s
        )
        ON CONFLICT (symbol, timestamp) DO UPDATE SET
            atr14 = EXCLUDED.atr14,
            realized_vol_24h = EXCLUDED.realized_vol_24h,
            parkinson_vol_24h = EXCLUDED.parkinson_vol_24h,
            returns_1h = EXCLUDED.returns_1h,
            returns_24h = EXCLUDED.returns_24h,
            momentum_14 = EXCLUDED.momentum_14,
            ema_slope_20 = EXCLUDED.ema_slope_20,
            poc = EXCLUDED.poc,
            vah = EXCLUDED.vah,
            val = EXCLUDED.val,
            orderbook_imbalance = EXCLUDED.orderbook_imbalance,
            bid_ask_ratio = EXCLUDED.bid_ask_ratio,
            cvd = EXCLUDED.cvd,
            shannon_entropy = EXCLUDED.shannon_entropy,
            permutation_entropy = EXCLUDED.permutation_entropy
    """
    with conn.cursor() as cur:
        cur.execute(sql, row)
    conn.commit()


def compute_all_features(conn, symbol: str) -> dict:
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)

    df_1h = fetch_ohlcv(conn, symbol, "1h", 100)
    df_1m = fetch_ohlcv(conn, symbol, "1m", 1440)
    ob_rows = fetch_orderbook(conn, symbol, 20)

    features: dict = {
        "symbol": symbol,
        "timestamp": now,
        "atr14": None,
        "realized_vol_24h": None,
        "parkinson_vol_24h": None,
        "returns_1h": None,
        "returns_24h": None,
        "momentum_14": None,
        "ema_slope_20": None,
        "poc": None,
        "vah": None,
        "val": None,
        "orderbook_imbalance": None,
        "bid_ask_ratio": None,
        "cvd": None,
        "shannon_entropy": None,
        "permutation_entropy": None,
    }

    # --- Volatility ---
    if not df_1h.empty:
        features["atr14"] = compute_atr(df_1h)
        features["parkinson_vol_24h"] = compute_parkinson_vol(df_1h.tail(24))

    if not df_1m.empty:
        features["realized_vol_24h"] = compute_realized_vol(df_1m.tail(1440))

    # --- Trend ---
    if not df_1h.empty:
        returns = compute_returns(df_1h)
        features["returns_1h"] = returns["returns_1h"]
        features["returns_24h"] = returns["returns_24h"]
        features["momentum_14"] = compute_momentum(df_1h)
        features["ema_slope_20"] = compute_ema_slope(df_1h)

    # --- Market Structure ---
    if not df_1h.empty and len(df_1h) >= 24:
        vp = compute_volume_profile(df_1h.tail(48))
        features["poc"] = vp["poc"]
        features["vah"] = vp["vah"]
        features["val"] = vp["val"]

    # --- Microstructure ---
    ob_features = compute_orderbook_features(ob_rows)
    features["orderbook_imbalance"] = ob_features["orderbook_imbalance"]
    features["bid_ask_ratio"] = ob_features["bid_ask_ratio"]

    if not df_1m.empty:
        ohlcv_dicts = df_1m.tail(60).to_dict("records")
        features["cvd"] = compute_cvd(ohlcv_dicts)

    # --- Entropy ---
    if not df_1h.empty:
        features["shannon_entropy"] = compute_shannon_entropy(df_1h)
        features["permutation_entropy"] = compute_permutation_entropy(df_1h)

    return features


def run_once(conn, symbol: str):
    log.info(f"Computing features for {symbol}...")
    features = compute_all_features(conn, symbol)

    # Convert floats to strings for decimal columns
    def clean(v):
        if v is None:
            return None
        if isinstance(v, float):
            return str(v)
        return v

    row = {k: clean(v) if k not in ("symbol", "timestamp") else v for k, v in features.items()}
    upsert_features(conn, row)

    log.info(
        f"Features stored: atr14={features['atr14']:.4f if features['atr14'] else 'N/A'} "
        f"realizedVol={features['realized_vol_24h']:.4f if features['realized_vol_24h'] else 'N/A'} "
        f"entropy={features['shannon_entropy']:.4f if features['shannon_entropy'] else 'N/A'} "
        f"cvd={features['cvd']:.2f if features['cvd'] else 'N/A'}"
    )


def main():
    if not DATABASE_URL:
        log.error("DATABASE_URL environment variable is not set")
        sys.exit(1)

    conn = get_conn()
    log.info(f"Feature engine started. Computing every {INTERVAL_SECONDS}s for {SYMBOL}")

    try:
        while True:
            import time
            start = time.time()
            try:
                run_once(conn, SYMBOL)
            except Exception as e:
                log.error(f"Feature computation error: {e}", exc_info=True)

            elapsed = time.time() - start
            sleep_time = max(0, INTERVAL_SECONDS - elapsed)
            log.info(f"Cycle took {elapsed:.1f}s, sleeping {sleep_time:.1f}s")
            time.sleep(sleep_time)
    except KeyboardInterrupt:
        log.info("Feature engine stopped")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
