"""
Phase 3 — Regime Classifier (Unified Interface)

Combines HMM + Markov Switching into a single clean output:

Output:
    {
        "timestamp": datetime,
        "symbol": str,

        # HMM probabilities
        "hmm_bull":     0.75,
        "hmm_bear":     0.05,
        "hmm_sideways": 0.15,
        "hmm_panic":    0.05,

        # Dominant HMM state
        "hmm_state": "Bull",

        # Markov Switching
        "ms_regime": 0,
        "ms_prob_0": 0.82,
        "ms_prob_1": 0.18,
        "ms_is_high_vol": False,

        # Agreement flag
        "models_agree": True,

        # Final combined state (used downstream)
        "regime": "Bull",
        "regime_confidence": 0.75,
    }

Usage:
    from quant_bot.regime.regime_classifier import RegimeClassifier
    clf = RegimeClassifier()
    clf.train(df_features, returns_series)
    result = clf.classify(df_features, returns_series)
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import pandas as pd

from .hmm_model import HMMRegimeDetector
from .markov_switching import MarkovSwitchingValidator

log = logging.getLogger(__name__)

# Confidence boost when both models agree
AGREEMENT_CONFIDENCE_BOOST = 0.05


class RegimeClassifier:
    """
    Unified regime classification combining HMM + Markov Switching.
    """

    def __init__(self):
        self.hmm = HMMRegimeDetector()
        self.ms = MarkovSwitchingValidator()
        self._hmm_trained = False
        self._ms_trained = False

    def train(self, df_features: pd.DataFrame, returns_series: pd.Series) -> None:
        """
        Train both models.

        Args:
            df_features: DataFrame with columns [returns, volatility, volume_change]
                         (use prepare_features() to build this from raw DB data)
            returns_series: pd.Series of 1h log returns for MS model
        """
        log.info("Training regime detection models...")

        try:
            self.hmm.fit(df_features)
            self._hmm_trained = True
            log.info("HMM trained successfully")
        except Exception as e:
            log.error(f"HMM training failed: {e}")

        try:
            self.ms.fit(returns_series)
            self._ms_trained = True
            log.info("Markov Switching trained successfully")
        except Exception as e:
            log.error(f"Markov Switching training failed: {e}")

    def classify(
        self,
        df_features: pd.DataFrame,
        returns_series: pd.Series,
        symbol: str = "BTC/USDT",
    ) -> dict:
        """
        Classify current market regime.

        Returns a unified dict with all regime signals.
        """
        now = datetime.now(timezone.utc)

        result: dict = {
            "timestamp": now,
            "symbol": symbol,
            "hmm_bull": 0.25,
            "hmm_bear": 0.25,
            "hmm_sideways": 0.25,
            "hmm_panic": 0.25,
            "hmm_state": "Sideways",
            "ms_regime": -1,
            "ms_prob_0": 0.5,
            "ms_prob_1": 0.5,
            "ms_is_high_vol": False,
            "models_agree": None,
            "regime": "Sideways",
            "regime_confidence": 0.0,
        }

        # --- HMM ---
        if self._hmm_trained:
            try:
                hmm_probs = self.hmm.predict_latest(df_features)
                result["hmm_bull"] = hmm_probs["Bull"]
                result["hmm_bear"] = hmm_probs["Bear"]
                result["hmm_sideways"] = hmm_probs["Sideways"]
                result["hmm_panic"] = hmm_probs["Panic"]

                dominant = max(hmm_probs, key=hmm_probs.get)
                result["hmm_state"] = dominant
                result["regime_confidence"] = hmm_probs[dominant]
            except Exception as e:
                log.error(f"HMM prediction failed: {e}")

        # --- Markov Switching ---
        if self._ms_trained:
            try:
                hmm_probs_for_ms = {
                    "Bull": result["hmm_bull"],
                    "Bear": result["hmm_bear"],
                    "Sideways": result["hmm_sideways"],
                    "Panic": result["hmm_panic"],
                }
                ms_result = self.ms.predict_latest(returns_series, hmm_probs_for_ms)
                result["ms_regime"] = ms_result["regime"]
                result["ms_prob_0"] = ms_result["prob_regime_0"]
                result["ms_prob_1"] = ms_result["prob_regime_1"]
                result["ms_is_high_vol"] = ms_result["is_high_vol"]
                result["models_agree"] = ms_result["agreement_with_hmm"]
            except Exception as e:
                log.error(f"MS prediction failed: {e}")

        # --- Combined final regime ---
        # Use HMM as primary, MS as confirmation signal
        regime = result["hmm_state"]
        confidence = result["regime_confidence"]

        if result["models_agree"] is True:
            # Both agree → boost confidence slightly
            confidence = min(1.0, confidence + AGREEMENT_CONFIDENCE_BOOST)
        elif result["models_agree"] is False:
            # Disagreement → reduce confidence
            confidence = max(0.0, confidence - 0.10)

        result["regime"] = regime
        result["regime_confidence"] = round(confidence, 4)

        log.info(
            f"Regime: {regime} | confidence={confidence:.3f} | "
            f"HMM={result['hmm_state']} | "
            f"agree={result['models_agree']}"
        )
        return result

    def save(self):
        """Save both models to disk."""
        if self._hmm_trained:
            self.hmm.save()

    def load(self) -> "RegimeClassifier":
        """Load both models from disk."""
        try:
            self.hmm.load()
            self._hmm_trained = True
        except Exception as e:
            log.warning(f"Could not load HMM model: {e}")
        return self
