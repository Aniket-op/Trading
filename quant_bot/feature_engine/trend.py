"""
Trend features:
  - Returns (1h, 24h)
  - Momentum (14-period)
  - EMA Slope (20-period)
"""

import numpy as np
import pandas as pd


def compute_returns(df: pd.DataFrame) -> dict[str, float | None]:
    """
    Returns over 1h and 24h using 1h OHLCV data.
    df must have column: close (sorted oldest→newest).
    """
    close = df["close"].astype(float)
    result: dict[str, float | None] = {"returns_1h": None, "returns_24h": None}

    if len(close) >= 2:
        result["returns_1h"] = float((close.iloc[-1] / close.iloc[-2] - 1))

    if len(close) >= 25:
        result["returns_24h"] = float((close.iloc[-1] / close.iloc[-25] - 1))

    return result


def compute_momentum(df: pd.DataFrame, period: int = 14) -> float | None:
    """
    Rate-of-change momentum: (close_now - close_n_periods_ago) / close_n_periods_ago.
    df must have column: close (sorted oldest→newest).
    """
    close = df["close"].astype(float)
    if len(close) < period + 1:
        return None
    mom = float((close.iloc[-1] - close.iloc[-(period + 1)]) / close.iloc[-(period + 1)])
    return mom if not np.isnan(mom) else None


def compute_ema_slope(df: pd.DataFrame, period: int = 20) -> float | None:
    """
    EMA slope: normalized rate of change of the EMA.
    Positive = uptrend, Negative = downtrend.
    df must have column: close (sorted oldest→newest).
    """
    close = df["close"].astype(float)
    if len(close) < period + 2:
        return None

    ema = close.ewm(span=period, adjust=False).mean()
    if len(ema) < 2 or ema.iloc[-2] == 0:
        return None

    slope = float((ema.iloc[-1] - ema.iloc[-2]) / ema.iloc[-2])
    return slope if not np.isnan(slope) else None
