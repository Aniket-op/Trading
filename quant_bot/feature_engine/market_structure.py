"""
Market structure features:
  - Volume Profile (POC, VAH, VAL)
  
POC  = Point of Control (price level with highest traded volume)
VAH  = Value Area High (top of 70% volume zone)
VAL  = Value Area Low  (bottom of 70% volume zone)
"""

import numpy as np
import pandas as pd


def compute_volume_profile(
    df: pd.DataFrame,
    bins: int = 50,
    value_area_pct: float = 0.70,
) -> dict[str, float | None]:
    """
    Compute POC, VAH, VAL from OHLCV data.
    df must have columns: high, low, close, volume (sorted oldest→newest).
    Returns dict with keys: poc, vah, val.
    """
    result: dict[str, float | None] = {"poc": None, "vah": None, "val": None}
    if len(df) < 5:
        return result

    high = df["high"].astype(float)
    low = df["low"].astype(float)
    volume = df["volume"].astype(float)

    price_min = low.min()
    price_max = high.max()
    if price_max == price_min:
        return result

    bin_edges = np.linspace(price_min, price_max, bins + 1)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
    vol_profile = np.zeros(bins)

    for _, row in df.iterrows():
        r_low = float(row["low"])
        r_high = float(row["high"])
        r_vol = float(row["volume"])
        for i in range(bins):
            overlap = min(r_high, bin_edges[i + 1]) - max(r_low, bin_edges[i])
            if overlap > 0:
                weight = overlap / (r_high - r_low) if r_high != r_low else 1.0
                vol_profile[i] += r_vol * weight

    poc_idx = int(np.argmax(vol_profile))
    result["poc"] = float(bin_centers[poc_idx])

    total_vol = vol_profile.sum()
    target_vol = total_vol * value_area_pct

    # Expand outward from POC until we capture `value_area_pct` of volume
    lo_idx = hi_idx = poc_idx
    accumulated = vol_profile[poc_idx]

    while accumulated < target_vol:
        can_go_up = hi_idx + 1 < bins
        can_go_down = lo_idx - 1 >= 0
        if not can_go_up and not can_go_down:
            break
        up_vol = vol_profile[hi_idx + 1] if can_go_up else -1
        down_vol = vol_profile[lo_idx - 1] if can_go_down else -1
        if up_vol >= down_vol:
            hi_idx += 1
            accumulated += vol_profile[hi_idx]
        else:
            lo_idx -= 1
            accumulated += vol_profile[lo_idx]

    result["vah"] = float(bin_edges[hi_idx + 1])
    result["val"] = float(bin_edges[lo_idx])
    return result
