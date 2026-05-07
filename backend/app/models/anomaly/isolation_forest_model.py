"""
Overspending detection using Isolation Forest.

Trains on per-user monthly spending profiles. At inference, it scores a
given user's current month against their own historical baseline and flags
anomalous (overspent) months.

Features per user-month (5):
  - monthly_total_spend      : total ₹ spent this month
  - spend_vs_rolling_avg     : ratio vs 3-month rolling mean
  - n_unique_items           : variety of items bought
  - avg_price_paid           : average per-item spend
  - festival_month_flag      : 1 if current month is festival month
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from app.utils.helpers import FESTIVAL_MONTHS


class OverspendingDetector:
    FEATURE_COLS = [
        "monthly_spend",
        "spend_vs_avg",
        "n_unique_items",
        "avg_price_paid",
        "is_festival_month",
    ]

    def __init__(self):
        self.model = IsolationForest(
            n_estimators=150,
            contamination=0.1,   # ~10% of months expected as anomalous
            max_samples="auto",
            random_state=42,
        )
        self.scaler = StandardScaler()
        self.is_trained = False
        self._global_monthly_mean = 500.0
        self._global_monthly_std  = 200.0

    # ------------------------------------------------------------------
    # Feature building
    # ------------------------------------------------------------------

    @staticmethod
    def build_features(purchases: pd.DataFrame) -> pd.DataFrame:
        """Aggregate purchases → one row per (user_id, year, month)."""
        if purchases.empty:
            return pd.DataFrame(columns=OverspendingDetector.FEATURE_COLS)

        if "purchase_date" in purchases.columns:
            purchases = purchases.copy()
            purchases["purchase_date"] = pd.to_datetime(purchases["purchase_date"], errors="coerce")
            purchases["month"] = purchases["purchase_date"].dt.month
            purchases["year"]  = purchases["purchase_date"].dt.year

        monthly = (
            purchases.groupby(["user_id", "year", "month"])
            .agg(
                monthly_spend     = ("price", lambda x: (x * purchases.loc[x.index, "quantity"]).sum() if "quantity" in purchases.columns else x.sum()),
                n_unique_items    = ("item", "nunique"),
                avg_price_paid    = ("price", "mean"),
            )
            .reset_index()
        )
        monthly["is_festival_month"] = monthly["month"].isin(FESTIVAL_MONTHS).astype(float)

        # 3-month rolling mean per user (shift to avoid look-ahead)
        monthly = monthly.sort_values(["user_id", "year", "month"])
        monthly["spend_rolling_mean"] = (
            monthly.groupby("user_id")["monthly_spend"]
            .transform(lambda x: x.shift(1).rolling(3, min_periods=1).mean())
        )
        monthly["spend_rolling_mean"] = monthly["spend_rolling_mean"].fillna(
            monthly["monthly_spend"].mean()
        )
        monthly["spend_vs_avg"] = (
            monthly["monthly_spend"] / monthly["spend_rolling_mean"].clip(1)
        ).clip(0, 5)

        return monthly

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, purchases: pd.DataFrame) -> dict:
        monthly = self.build_features(purchases)
        if monthly.empty or len(monthly) < 10:
            self.is_trained = False
            return {"status": "skipped", "reason": "insufficient data"}

        X = monthly[self.FEATURE_COLS].fillna(0).values.astype(float)
        X_sc = self.scaler.fit_transform(X)
        self.model.fit(X_sc)
        self.is_trained = True

        self._global_monthly_mean = float(monthly["monthly_spend"].mean())
        self._global_monthly_std  = float(monthly["monthly_spend"].std()) or 200.0

        n_anomalies = int((self.model.predict(X_sc) == -1).sum())
        return {
            "status": "trained",
            "n_months": len(monthly),
            "anomaly_rate": round(n_anomalies / len(monthly), 3),
            "mean_monthly_spend": round(self._global_monthly_mean, 2),
        }

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def predict(self, purchases: pd.DataFrame, user_id: int, current_month: int, current_year: int) -> dict:
        """
        Returns overspending verdict for a specific user's current month.
        Falls back gracefully if no history exists.
        """
        if not self.is_trained:
            return self._no_data_response()

        monthly = self.build_features(purchases)
        user_history = monthly[monthly["user_id"] == user_id]

        # Current month row
        curr = user_history[
            (user_history["month"] == current_month) &
            (user_history["year"]  == current_year)
        ]

        if curr.empty:
            # No data for current month — use a neutral feature row
            return self._no_data_response()

        row = curr[self.FEATURE_COLS].fillna(0).values.astype(float)
        row_sc = self.scaler.transform(row)
        label = int(self.model.predict(row_sc)[0])
        score = float(self.model.score_samples(row_sc)[0])

        monthly_spend = float(curr["monthly_spend"].iloc[0])
        rolling_avg   = float(curr["spend_rolling_mean"].iloc[0])
        overspent_by  = max(0.0, round(monthly_spend - rolling_avg, 2))

        # Category breakdown from current month raw purchases
        cat_spend: dict = {}
        if not purchases.empty:
            curr_purchases = purchases[
                (purchases.get("user_id", pd.Series()) == user_id)
            ]
            if "purchase_date" in curr_purchases.columns:
                curr_purchases = curr_purchases.copy()
                curr_purchases["purchase_date"] = pd.to_datetime(curr_purchases["purchase_date"], errors="coerce")
                curr_purchases = curr_purchases[
                    (curr_purchases["purchase_date"].dt.month == current_month) &
                    (curr_purchases["purchase_date"].dt.year  == current_year)
                ]
            if not curr_purchases.empty and "category" in curr_purchases.columns:
                spend_col = curr_purchases["price"] * curr_purchases.get("quantity", 1)
                cat_spend = (
                    curr_purchases.groupby("category")
                    .apply(lambda g: round(float((g["price"] * g.get("quantity", pd.Series(1, index=g.index))).sum()), 2))
                    .to_dict()
                )

        return {
            "is_overspending":      label == -1,
            "anomaly_score":        round(score, 4),
            "monthly_spend":        round(monthly_spend, 2),
            "rolling_avg_3m":       round(rolling_avg, 2),
            "overspent_by":         overspent_by,
            "n_unique_items":       int(curr["n_unique_items"].iloc[0]),
            "category_breakdown":   cat_spend,
            "message": (
                f"You overspent ₹{int(overspent_by)} vs your 3-month average."
                if label == -1
                else f"Spending is within normal range (₹{int(monthly_spend)} this month)."
            ),
        }

    @staticmethod
    def _no_data_response() -> dict:
        return {
            "is_overspending": False,
            "anomaly_score": 0.0,
            "monthly_spend": 0.0,
            "rolling_avg_3m": 0.0,
            "overspent_by": 0.0,
            "n_unique_items": 0,
            "category_breakdown": {},
            "message": "Not enough purchase history to detect overspending.",
        }
