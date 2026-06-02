"""
Phase 3 — Hidden Markov Model Regime Detector

4 States:
  0 = Bull    (trending up, moderate volatility)
  1 = Bear    (trending down, moderate volatility)
  2 = Sideways (low directional movement, low volatility)
  3 = Panic   (extreme volatility, high volume, large moves)

Inputs:
  - returns        (1h log returns)
  - volatility     (realized vol from 1m data, annualized)
  - volume_change  (normalized volume change %)

Output:
  state_probabilities: dict with Bull/Bear/Sideways/Panic probabilities

Usage:
    from quant_bot.regime.hmm_model import HMMRegimeDetector
    detector = HMMRegimeDetector()
    detector.fit(df_features)
    probs = detector.predict_proba(df_features)
"""

import logging
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from hmmlearn.hmm import GaussianHMM

log = logging.getLogger(__name__)

# Model persistence path
MODEL_PATH = Path(__file__).parent / "hmm_model.pkl"

# State labels — assigned AFTER fitting by inspecting means
STATE_NAMES = ["Bull", "Bear", "Sideways", "Panic"]
N_STATES = 4


def _build_feature_matrix(df: pd.DataFrame) -> np.ndarray:
    """
    Build the (T, 3) observation matrix from feature DataFrame.

    Expected columns: returns, volatility, volume_change
    Returns NaN-cleaned matrix.
    """
    required = ["returns", "volatility", "volume_change"]
    for col in required:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}")

    X = df[required].copy()
    X = X.replace([np.inf, -np.inf], np.nan)
    X = X.fillna(method="ffill").fillna(0.0)
    return X.values.astype(np.float64)


def _assign_state_labels(model: GaussianHMM) -> dict[int, str]:
    """
    After fitting, assign meaningful labels to HMM states by inspecting
    the learned means:
      - Highest return mean    → Bull
      - Lowest return mean     → Bear
      - Highest volatility mean → Panic
      - Remaining              → Sideways

    Returns: {state_idx: label}
    """
    means = model.means_  # shape (n_states, n_features)
    # Feature order: returns(0), volatility(1), volume_change(2)
    return_means = means[:, 0]
    vol_means = means[:, 1]

    # Panic = highest volatility
    panic_idx = int(np.argmax(vol_means))

    # From remaining states
    remaining = [i for i in range(N_STATES) if i != panic_idx]
    bull_idx = int(remaining[np.argmax(return_means[remaining])])
    bear_idx = int(remaining[np.argmin(return_means[remaining])])
    sideways_candidates = [i for i in remaining if i not in (bull_idx, bear_idx)]
    sideways_idx = sideways_candidates[0] if sideways_candidates else bear_idx

    mapping = {
        bull_idx: "Bull",
        bear_idx: "Bear",
        sideways_idx: "Sideways",
        panic_idx: "Panic",
    }
    return mapping


class HMMRegimeDetector:
    """
    Gaussian HMM-based regime detector.

    Workflow:
      1. detector.fit(df)          — train on feature DataFrame
      2. detector.predict_proba(df) — get state probabilities for each row
      3. detector.save() / detector.load() — model persistence
    """

    def __init__(
        self,
        n_states: int = N_STATES,
        n_iter: int = 200,
        covariance_type: str = "full",
        random_state: int = 42,
    ):
        self.n_states = n_states
        self.n_iter = n_iter
        self.covariance_type = covariance_type
        self.random_state = random_state
        self.model: Optional[GaussianHMM] = None
        self.state_label_map: dict[int, str] = {}

    def fit(self, df: pd.DataFrame) -> "HMMRegimeDetector":
        """
        Train the HMM on historical features.
        df must have columns: returns, volatility, volume_change
        Minimum 200 rows recommended for stable convergence.
        """
        if len(df) < 50:
            raise ValueError(f"Need at least 50 rows to train HMM, got {len(df)}")

        X = _build_feature_matrix(df)
        log.info(f"Training HMM with {len(X)} observations, {self.n_states} states...")

        self.model = GaussianHMM(
            n_components=self.n_states,
            covariance_type=self.covariance_type,
            n_iter=self.n_iter,
            random_state=self.random_state,
            verbose=False,
        )
        self.model.fit(X)

        self.state_label_map = _assign_state_labels(self.model)
        log.info(f"HMM trained. State mapping: {self.state_label_map}")
        log.info(f"HMM converged: {self.model.monitor_.converged}")

        return self

    def predict_proba(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute posterior state probabilities for each row in df.

        Returns DataFrame with columns: Bull, Bear, Sideways, Panic
        Each row sums to 1.0.
        """
        if self.model is None:
            raise RuntimeError("Model not trained. Call fit() first.")

        X = _build_feature_matrix(df)
        # posteriors shape: (T, n_states)
        _, posteriors = self.model.decode(X, algorithm="viterbi")
        state_probs = self.model.predict_proba(X)

        result = pd.DataFrame(index=df.index)
        for state_idx, label in self.state_label_map.items():
            result[label] = state_probs[:, state_idx]

        # Ensure all 4 columns exist (in case mapping is incomplete)
        for col in STATE_NAMES:
            if col not in result.columns:
                result[col] = 0.0

        return result[STATE_NAMES]

    def predict_latest(self, df: pd.DataFrame) -> dict[str, float]:
        """
        Predict state probabilities for the LATEST row only.

        Returns: {"Bull": 0.75, "Bear": 0.05, "Sideways": 0.15, "Panic": 0.05}
        """
        probs_df = self.predict_proba(df)
        latest = probs_df.iloc[-1]
        return {label: float(latest[label]) for label in STATE_NAMES}

    def save(self, path: Path = MODEL_PATH):
        """Persist trained model to disk."""
        if self.model is None:
            raise RuntimeError("No model to save.")
        with open(path, "wb") as f:
            pickle.dump({
                "model": self.model,
                "state_label_map": self.state_label_map,
            }, f)
        log.info(f"HMM model saved to {path}")

    def load(self, path: Path = MODEL_PATH) -> "HMMRegimeDetector":
        """Load a previously saved model from disk."""
        with open(path, "rb") as f:
            data = pickle.load(f)
        self.model = data["model"]
        self.state_label_map = data["state_label_map"]
        log.info(f"HMM model loaded from {path}")
        return self
