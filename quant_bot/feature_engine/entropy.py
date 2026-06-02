"""
Entropy features:
  - Shannon Entropy (of return distribution)
  - Permutation Entropy (of price order patterns)
"""

import math
import numpy as np
import pandas as pd
from itertools import permutations


def compute_shannon_entropy(df: pd.DataFrame, bins: int = 10) -> float | None:
    """
    Shannon entropy of the log-return distribution.
    High entropy = random/chaotic market.
    Low entropy = structured/trending market.
    df must have column: close (sorted oldest→newest).
    """
    close = df["close"].astype(float)
    if len(close) < 20:
        return None

    log_returns = np.log(close / close.shift(1)).dropna()
    if len(log_returns) < 10:
        return None

    counts, _ = np.histogram(log_returns, bins=bins)
    total = counts.sum()
    if total == 0:
        return None

    probs = counts[counts > 0] / total
    entropy = float(-np.sum(probs * np.log2(probs)))
    max_entropy = math.log2(bins)

    # Normalize to [0, 1]
    normalized = entropy / max_entropy if max_entropy > 0 else None
    return normalized if normalized is not None and not math.isnan(normalized) else None


def compute_permutation_entropy(
    df: pd.DataFrame,
    order: int = 3,
    delay: int = 1,
) -> float | None:
    """
    Permutation entropy of the price series.
    Measures complexity of ordinal patterns in the time series.
    order=3 means we look at patterns of 3 consecutive values.
    Normalized to [0, 1]: 0 = fully ordered, 1 = maximum complexity.

    df must have column: close (sorted oldest→newest).
    """
    close = df["close"].astype(float).values
    n = len(close)
    min_len = order * delay + 1
    if n < min_len:
        return None

    # Generate all possible permutations of order `order`
    all_perms = list(permutations(range(order)))
    perm_to_idx = {p: i for i, p in enumerate(all_perms)}
    counts = np.zeros(len(all_perms))

    for i in range(n - (order - 1) * delay):
        pattern = close[i:i + order * delay:delay]
        ranked = tuple(np.argsort(np.argsort(pattern)))
        idx = perm_to_idx.get(ranked)
        if idx is not None:
            counts[idx] += 1

    total = counts.sum()
    if total == 0:
        return None

    probs = counts[counts > 0] / total
    entropy = float(-np.sum(probs * np.log2(probs)))
    max_entropy = math.log2(math.factorial(order))

    normalized = entropy / max_entropy if max_entropy > 0 else None
    return normalized if normalized is not None and not math.isnan(normalized) else None
