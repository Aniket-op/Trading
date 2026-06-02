"""
Phase 3 — Markov Switching Model (Validation Layer)

Uses statsmodels MarkovRegression to validate HMM outputs.
Runs as a 2-state model (Regime A / Regime B) then maps to HMM agreement.

Purpose:
  - Provide a statistically independent second opinion on regime
  - Flag when HMM and Markov Switching strongly disagree

Usage:
    from quant_bot.regime.markov_switching import MarkovSwitchingValidator
    ms = MarkovSwitchingValidator()
    ms.fit(returns_series)
    result = ms.predict_latest(returns_series)
    # {"regime": 0, "prob_regime_0": 0.82, "prob_regime_1": 0.18, "agreement_with_hmm": True}
"""

import logging
from typing import Optional

import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.tsa.regime_switching.markov_regression import MarkovRegression

log = logging.getLogger(__name__)


def _map_ms_to_hmm_agreement(
    ms_high_vol_regime: int,
    ms_probs: np.ndarray,
    hmm_probs: dict[str, float],
) -> bool:
    """
    Check if MS and HMM broadly agree on market state.

    MS regime with higher variance → maps to Bear/Panic in HMM
    MS regime with lower variance → maps to Bull/Sideways in HMM

    Returns True if both agree on risk-on vs risk-off.
    """
    # High vol regime in MS → risk-off (Bear or Panic in HMM)
    hmm_risk_off = hmm_probs.get("Bear", 0.0) + hmm_probs.get("Panic", 0.0)
    hmm_risk_on = hmm_probs.get("Bull", 0.0) + hmm_probs.get("Sideways", 0.0)

    ms_in_high_vol = ms_probs[ms_high_vol_regime] > 0.5
    hmm_risk_off_dominant = hmm_risk_off > hmm_risk_on

    return ms_in_high_vol == hmm_risk_off_dominant


class MarkovSwitchingValidator:
    """
    2-state Markov Switching Regression for regime validation.

    State 0 and State 1 are data-driven — we identify which is
    high-volatility by comparing learned variance estimates.
    """

    def __init__(self, k_regimes: int = 2, order: int = 4):
        self.k_regimes = k_regimes
        self.order = order       # AR order for autocorrelation in returns
        self.model: Optional[MarkovRegression] = None
        self.result = None
        self.high_vol_regime: int = 1  # will be determined in fit()

    def fit(self, returns: pd.Series) -> "MarkovSwitchingValidator":
        """
        Fit Markov Switching model to a returns series.
        returns: pd.Series of log returns (1h recommended), minimum 200 rows.
        """
        clean = returns.replace([np.inf, -np.inf], np.nan).dropna()
        if len(clean) < 100:
            raise ValueError(f"Need at least 100 returns, got {len(clean)}")

        log.info(f"Fitting Markov Switching model on {len(clean)} observations...")

        try:
            self.model = MarkovRegression(
                clean,
                k_regimes=self.k_regimes,
                trend="c",
                switching_variance=True,
            )
            self.result = self.model.fit(disp=False, maxiter=200)

            # Identify high-volatility regime by comparing variance params
            # result.params contains [const_0, const_1, ..., sigma2_0, sigma2_1]
            variances = self.result.params[-self.k_regimes:]
            self.high_vol_regime = int(np.argmax(variances))

            log.info(
                f"MS model fitted. High-vol regime: {self.high_vol_regime}. "
                f"AIC: {self.result.aic:.2f}"
            )
        except Exception as e:
            log.error(f"Markov Switching fitting failed: {e}")
            self.result = None

        return self

    def predict_latest(
        self,
        returns: pd.Series,
        hmm_probs: Optional[dict[str, float]] = None,
    ) -> dict:
        """
        Get regime probabilities for the latest observation.

        Args:
            returns: Full returns series (same as used in fit, can have new rows)
            hmm_probs: Optional HMM state probs for agreement check

        Returns:
            {
                "regime": int,             # current dominant regime (0 or 1)
                "prob_regime_0": float,
                "prob_regime_1": float,
                "high_vol_regime": int,    # which regime index = high volatility
                "is_high_vol": bool,       # True if in high volatility regime
                "agreement_with_hmm": bool | None
            }
        """
        if self.result is None:
            return {
                "regime": -1,
                "prob_regime_0": 0.5,
                "prob_regime_1": 0.5,
                "high_vol_regime": self.high_vol_regime,
                "is_high_vol": False,
                "agreement_with_hmm": None,
            }

        # Smoothed probabilities from the fitted result
        smoothed = self.result.smoothed_marginal_probabilities
        # shape: (T, k_regimes)
        latest_probs = smoothed.iloc[-1].values

        dominant_regime = int(np.argmax(latest_probs))
        is_high_vol = (dominant_regime == self.high_vol_regime)

        agreement = None
        if hmm_probs is not None:
            agreement = _map_ms_to_hmm_agreement(
                self.high_vol_regime,
                latest_probs,
                hmm_probs,
            )

        return {
            "regime": dominant_regime,
            "prob_regime_0": float(latest_probs[0]),
            "prob_regime_1": float(latest_probs[1]) if self.k_regimes > 1 else 0.0,
            "high_vol_regime": self.high_vol_regime,
            "is_high_vol": is_high_vol,
            "agreement_with_hmm": agreement,
        }

    def get_smoothed_probabilities(self) -> Optional[pd.DataFrame]:
        """Return full time series of smoothed state probabilities."""
        if self.result is None:
            return None
        return self.result.smoothed_marginal_probabilities
