"""
Volatility features:
  - ATR (14-period Average True Range)
  - Realized Volatility (24h, annualized)
  - Parkinson Volatility (24h, annualized)
"""

import numpy as np
import pandas as pd


def compute_atr(df: pd.DataFrame, period: int = 14) -> float | None:
    """
    Average True Range over `period` candles.
    df must have columns: high, low, close (sorted oldest→newest).
    """
    if len(df) < period + 1:
        return None
    high = df["high"].astype(float)
    low = df["low"].astype(float)
    close = df["close"].astype(float)

    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)

    atr = tr.ewm(span=period, adjust=False).mean().iloc[-1]
    return float(atr) if not np.isnan(atr) else None


def compute_realized_vol(df: pd.DataFrame, periods_per_year: int = 525600) -> float | None:
    """
    Realized volatility from 1m close returns, annualized.
    Uses last 1440 candles (24h of 1m data).
    """
    if len(df) < 30:
        return None
    close = df["close"].astype(float)
    log_returns = np.log(close / close.shift(1)).dropna()
    if len(log_returns) < 10:
        return None
    vol = float(log_returns.std() * np.sqrt(periods_per_year))
    return vol if not np.isnan(vol) else None


def compute_parkinson_vol(df: pd.DataFrame, periods_per_year: int = 365) -> float | None:
    """
    Parkinson volatility estimator using high-low range.
    More efficient than close-to-close for intraday data.
    Uses last 24 candles (1h data).
    """
    if len(df) < 10:
        return None
    high = df["high"].astype(float)
    low = df["low"].astype(float)

    log_hl = np.log(high / low) ** 2
    factor = 1.0 / (4.0 * np.log(2))
    daily_var = factor * log_hl.mean()
    vol = float(np.sqrt(daily_var * periods_per_year))
    return vol if not np.isnan(vol) else None
