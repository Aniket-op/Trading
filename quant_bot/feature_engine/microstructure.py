"""
Microstructure features:
  - Orderbook Imbalance
  - Bid/Ask Ratio
  - CVD (Cumulative Volume Delta)
"""

import json
import numpy as np
import pandas as pd


def compute_orderbook_features(orderbook_rows: list[dict]) -> dict[str, float | None]:
    """
    Compute orderbook imbalance and bid/ask ratio from the latest snapshot.
    orderbook_rows: list of dicts with keys: bids (JSON), asks (JSON), bid_ask_ratio
    """
    result: dict[str, float | None] = {
        "orderbook_imbalance": None,
        "bid_ask_ratio": None,
    }

    if not orderbook_rows:
        return result

    latest = orderbook_rows[-1]

    try:
        bids = json.loads(latest["bids"]) if isinstance(latest["bids"], str) else latest["bids"]
        asks = json.loads(latest["asks"]) if isinstance(latest["asks"], str) else latest["asks"]
    except (json.JSONDecodeError, KeyError):
        return result

    bid_vol = sum(float(b[1]) for b in bids)
    ask_vol = sum(float(a[1]) for a in asks)
    total_vol = bid_vol + ask_vol

    if total_vol > 0:
        result["orderbook_imbalance"] = float((bid_vol - ask_vol) / total_vol)

    if ask_vol > 0:
        result["bid_ask_ratio"] = float(bid_vol / ask_vol)

    return result


def compute_cvd(ohlcv_rows: list[dict]) -> float | None:
    """
    Cumulative Volume Delta — proxy using close vs open direction.
    Positive = net buying pressure, Negative = net selling pressure.
    ohlcv_rows: list of dicts with keys: open, close, volume (sorted oldest→newest).
    """
    if not ohlcv_rows:
        return None

    cvd = 0.0
    for row in ohlcv_rows:
        o = float(row["open"])
        c = float(row["close"])
        v = float(row["volume"])
        # Bullish candle: +volume, Bearish candle: -volume
        if c >= o:
            cvd += v
        else:
            cvd -= v

    return float(cvd) if not np.isnan(cvd) else None
