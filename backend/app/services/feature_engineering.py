"""
Feature engineering for demand and waste prediction models.

Demand features (13):
  avg_quantity_last3, days_since_last, purchase_frequency,
  seasonal_factor, household_size, consumption_rate, price,
  category_encoded, expiry_risk_proxy, is_festival_month,
  price_variation_index, is_summer_month, is_monsoon_month

Waste features (24):
  Base (10): expiry_days, shelf_life, expiry_risk, consumption_rate,
             quantity, price, household_size_proxy, nutrition_score,
             is_perishable, category_encoded
  Engineered (10): consumption_to_expiry_ratio, quantity_per_household,
                   price_per_unit, perishability_score, waste_risk_interaction,
                   category_risk_avg, rolling_waste_rate, normalized_quantity,
                   seasonal_waste_factor, price_sensitivity_score
  Indian context (4): is_summer_month, is_monsoon_month,
                      monsoon_perishable_flag, price_variation_index
"""
import numpy as np
import pandas as pd
from typing import Tuple

from app.datasets.loader import load_all
from app.utils.helpers import FESTIVAL_MONTHS, MONSOON_MONTHS, SUMMER_MONTHS


# ---------------------------------------------------------------------------
# Demand features (13)
# ---------------------------------------------------------------------------

def build_demand_features() -> Tuple[pd.DataFrame, pd.Series]:
    data = load_all()
    purchases = data["purchases"].copy()
    metadata  = data["metadata"]
    household = data["household"]
    seasonal  = data["seasonal"]

    purchases = purchases.sort_values(["user_id", "item", "purchase_date"]).reset_index(drop=True)

    # Rolling avg quantity (last 3 purchases, shift to avoid leakage)
    purchases["avg_quantity_last3"] = (
        purchases.groupby(["user_id", "item"])["quantity"]
        .transform(lambda s: s.shift(1).rolling(3, min_periods=1).mean())
    )

    # Days since last purchase
    purchases["prev_date"] = purchases.groupby(["user_id", "item"])["purchase_date"].shift(1)
    purchases["days_since_last"] = (
        (purchases["purchase_date"] - purchases["prev_date"])
        .dt.days.fillna(14).clip(1, 90)
    )

    # Purchase frequency (times/month) per user-item
    freq = (
        purchases.groupby(["user_id", "item"])
        .agg(n_purchases=("quantity", "count"))
        .reset_index()
    )
    date_span_days = (purchases["purchase_date"].max() - purchases["purchase_date"].min()).days
    total_months = max(1.0, date_span_days / 30.0)
    freq["purchase_frequency"] = freq["n_purchases"] / total_months
    purchases = purchases.merge(freq[["user_id", "item", "purchase_frequency"]], on=["user_id", "item"], how="left")

    # ===================== SEASONAL + FESTIVAL FEATURES (FIXED) =====================
    purchases["month"] = purchases["purchase_date"].dt.month

    if seasonal is not None and isinstance(seasonal, pd.DataFrame):
        seasonal_cols = seasonal.columns.tolist()

        if "month" in seasonal_cols:
            if "is_festival" in seasonal_cols:
                seasonal_flags = seasonal[["month", "is_festival"]].rename(
                    columns={"is_festival": "is_festival_month"}
                )
                purchases = purchases.merge(seasonal_flags, on="month", how="left")

            elif "festival" in seasonal_cols:
                seasonal_flags = seasonal[["month", "festival"]].rename(
                    columns={"festival": "is_festival_month"}
                )
                purchases = purchases.merge(seasonal_flags, on="month", how="left")

            else:
                print("[WARNING] No festival column in seasonal dataset → using fallback")
                festival_months = [1, 3, 8, 10, 11, 12]
                purchases["is_festival_month"] = purchases["month"].isin(festival_months).astype(int)
        else:
            print("[WARNING] 'month' column missing in seasonal dataset → fallback used")
            festival_months = [1, 3, 8, 10, 11, 12]
            purchases["is_festival_month"] = purchases["month"].isin(festival_months).astype(int)
    else:
        print("[WARNING] Seasonal dataset missing → using fallback festival logic")
        festival_months = [1, 3, 8, 10, 11, 12]
        purchases["is_festival_month"] = purchases["month"].isin(festival_months).astype(int)

    # Guarantee column exists
    if "is_festival_month" not in purchases.columns:
        purchases["is_festival_month"] = 0

    purchases["is_festival_month"] = purchases["is_festival_month"].fillna(0).astype(int)

    # Indian season flags (derived from month)
    if "is_summer_month" not in purchases.columns:
        purchases["is_summer_month"] = purchases["month"].isin(SUMMER_MONTHS).astype(int)
    if "is_monsoon_month" not in purchases.columns:
        purchases["is_monsoon_month"] = purchases["month"].isin(MONSOON_MONTHS).astype(int)

    # Consumption rate from household dataset
    hh_avg = (
        household.groupby(["household_size", "item"])["item_usage_rate"]
        .mean().reset_index()
        .rename(columns={"item_usage_rate": "consumption_rate"})
    )
    purchases = purchases.merge(hh_avg, on=["household_size", "item"], how="left")
    purchases["consumption_rate"] = purchases["consumption_rate"].fillna(purchases["quantity"] * 0.8)

    # Shelf life → expiry risk proxy
    purchases = purchases.merge(metadata[["item", "shelf_life"]], on="item", how="left")
    purchases["expiry_risk_proxy"] = (1.0 / purchases["shelf_life"].clip(1, 365)).round(4)

    # Category encoding
    cat_map = {c: i for i, c in enumerate(sorted(purchases["category"].unique()))}
    purchases["category_encoded"] = purchases["category"].map(cat_map)

    # Price variation index
    if "mandi_price" in purchases.columns:
        purchases["price_variation_index"] = (
            (purchases["price"] - purchases["mandi_price"])
            / purchases["mandi_price"].clip(1)
        ).clip(-0.5, 3.0).fillna(0.0)
    else:
        rng = np.random.default_rng(42)
        purchases["price_variation_index"] = rng.normal(0.2, 0.1, len(purchases)).clip(-0.5, 3.0)

    # Fill numeric NaNs
    numeric_cols = purchases.select_dtypes(include="number").columns
    purchases[numeric_cols] = purchases[numeric_cols].fillna(0)

    # Target: next purchase quantity
    purchases["next_quantity"] = purchases.groupby(["user_id", "item"])["quantity"].shift(-1)
    purchases = purchases.dropna(subset=["next_quantity"])
    purchases["next_quantity"] = purchases["next_quantity"].clip(0.1, 20)

    feature_cols = [
        "avg_quantity_last3",
        "days_since_last",
        "purchase_frequency",
        "seasonal_factor",
        "household_size",
        "consumption_rate",
        "price",
        "category_encoded",
        "expiry_risk_proxy",
        "is_festival_month",
        "price_variation_index",
        "is_summer_month",
        "is_monsoon_month",
    ]

    # Seasonal factor safety
    if "seasonal_factor" not in purchases.columns:
        purchases["seasonal_factor"] = 1.0

    # FINAL FEATURE SAFETY (prevents crashes forever)
    for col in feature_cols:
        if col not in purchases.columns:
            print(f"[WARNING] Missing feature: {col} → filling with 0")
            purchases[col] = 0

    X = purchases[feature_cols].astype(float)
    y = purchases["next_quantity"].astype(float)

    return X, y

# ---------------------------------------------------------------------------
# Waste features (24)
# ---------------------------------------------------------------------------

def build_waste_features() -> Tuple[pd.DataFrame, pd.Series]:
    data = load_all()
    waste    = data["waste"].copy()
    metadata = data["metadata"]

    waste = waste.merge(
        metadata[["item", "nutrition_score", "is_perishable"]],
        on="item", how="left",
    )

    cat_map = {c: i for i, c in enumerate(sorted(waste["category"].unique()))}
    waste["category_encoded"] = waste["category"].map(cat_map)

    waste["household_size_proxy"] = (
        waste["quantity"] / waste["consumption_rate"].clip(0.05, 1)
    ).clip(1, 6).round(1)

    # --- Base engineered features ---
    waste["consumption_to_expiry_ratio"] = (
        waste["consumption_rate"] / waste["expiry_days"].clip(1, 365)
    ).clip(0, 10)

    waste["quantity_per_household"] = (
        waste["quantity"] / waste["household_size_proxy"].clip(1, 6)
    ).clip(0, 20)

    waste["price_per_unit"] = (
        waste["price"] / waste["quantity"].clip(0.1, 100)
    ).clip(0, 1000)

    waste["perishability_score"] = (1.0 / waste["shelf_life"].clip(1, 365)).round(4)

    waste["waste_risk_interaction"] = (
        waste["expiry_risk"] * (1.0 - waste["consumption_rate"].clip(0, 1))
    )

    waste["category_risk_avg"] = waste.groupby("category")["wasted"].transform("mean").round(4)
    waste["rolling_waste_rate"] = waste.groupby("item")["wasted"].transform("mean").round(4)

    q_mean = float(waste["quantity"].mean())
    q_std  = float(waste["quantity"].std()) or 1.0
    waste["normalized_quantity"] = ((waste["quantity"] - q_mean) / q_std).clip(-3, 3)

    waste["seasonal_waste_factor"] = (
        waste["is_perishable"] * (1.0 + 0.2 * (waste["shelf_life"] < 7).astype(float))
    )

    waste["price_sensitivity_score"] = waste["price"] * waste["is_perishable"]

    # --- Indian context features ---
    if "is_summer_month" not in waste.columns:
        waste["is_summer_month"] = waste["month"].isin(SUMMER_MONTHS).astype(int) if "month" in waste.columns else 0

    if "is_monsoon_month" not in waste.columns:
        waste["is_monsoon_month"] = waste["month"].isin(MONSOON_MONTHS).astype(int) if "month" in waste.columns else 0

    waste["monsoon_perishable_flag"] = waste["is_monsoon_month"] * waste["is_perishable"]

    if "mandi_price" in waste.columns:
        waste["price_variation_index"] = (
            (waste["price"] - waste["mandi_price"]) / waste["mandi_price"].clip(1)
        ).clip(-0.5, 3.0).fillna(0.0)
    else:
        rng = np.random.default_rng(42)
        waste["price_variation_index"] = rng.normal(0.2, 0.1, len(waste)).clip(-0.5, 3.0)

    # Fill numeric NaNs
    numeric_cols = waste.select_dtypes(include="number").columns
    waste[numeric_cols] = waste[numeric_cols].fillna(0)

    # ===================== WASTE LABEL SAFETY =====================
    if "wasted" not in waste.columns or waste["wasted"].nunique() < 2:
        print("[FIX] Rebuilding waste labels due to imbalance or missing column")

        waste["wasted"] = (
            (waste["quantity"] > waste["consumption_rate"] * 2) |
            (waste["expiry_risk"] > 0.5) |
            (waste["expiry_days"] < waste["shelf_life"] * 0.3)
        ).astype(int)

    if waste["wasted"].nunique() < 2:
        print("[CRITICAL] Still single class → injecting minority samples")

        idx = np.random.choice(len(waste), size=max(1, int(0.1 * len(waste))), replace=False)
        waste.loc[idx, "wasted"] = 1

    # ===================== FEATURE LIST (FIXED POSITION) =====================
    feature_cols = [
        "expiry_days",
        "shelf_life",
        "expiry_risk",
        "consumption_rate",
        "quantity",
        "price",
        "household_size_proxy",
        "nutrition_score",
        "is_perishable",
        "category_encoded",
        "consumption_to_expiry_ratio",
        "quantity_per_household",
        "price_per_unit",
        "perishability_score",
        "waste_risk_interaction",
        "category_risk_avg",
        "rolling_waste_rate",
        "normalized_quantity",
        "seasonal_waste_factor",
        "price_sensitivity_score",
        "is_summer_month",
        "is_monsoon_month",
        "monsoon_perishable_flag",
        "price_variation_index",
    ]

    # ===================== FINAL OUTPUT =====================
    X = waste[feature_cols].astype(float)
    y = waste["wasted"].astype(int)

    return X, y
# ---------------------------------------------------------------------------
# Per-item stats for inference
# ---------------------------------------------------------------------------

def compute_item_stats(purchases: pd.DataFrame, metadata: pd.DataFrame, seasonal: pd.DataFrame) -> dict:
    current_month = pd.Timestamp.now().month
    seasonal_row  = seasonal.loc[seasonal["month"] == current_month]
    seasonal_now  = seasonal_row.iloc[0] if not seasonal_row.empty else seasonal.iloc[0]

    item_stats = {}
    for item in purchases["item"].unique():
        item_df = purchases[purchases["item"] == item]
        meta    = metadata[metadata["item"] == item]

        if meta.empty:
            continue

        avg_qty   = float(item_df["quantity"].mean())
        avg_price = float(item_df["price"].mean())
        date_span = (purchases["purchase_date"].max() - purchases["purchase_date"].min()).days
        total_months = max(1.0, date_span / 30.0)
        freq = len(item_df) / total_months

        # Price variation index at current time
        if "mandi_price" in item_df.columns:
            avg_mandi = float(item_df["mandi_price"].mean())
            pvi = round((avg_price - avg_mandi) / max(avg_mandi, 1), 3)
        else:
            pvi = 0.20

        item_stats[item] = {
            "avg_quantity_last3":    round(avg_qty, 3),
            "days_since_last":       7.0,
            "purchase_frequency":    round(freq, 3),
            "seasonal_factor":       float(seasonal_now.get("demand_multiplier", 1.0)),
            "household_size":        3.0,
            "consumption_rate":      round(avg_qty * 0.8, 3),
            "price":                 round(avg_price, 2),
            "category":              item_df["category"].iloc[0],
            "shelf_life":            int(meta["shelf_life"].iloc[0]),
            "expiry_risk_proxy":     round(1.0 / max(1, int(meta["shelf_life"].iloc[0])), 4),
            "is_festival_month":     int(current_month in FESTIVAL_MONTHS),
            "is_summer_month":       int(current_month in SUMMER_MONTHS),
            "is_monsoon_month":      int(current_month in MONSOON_MONTHS),
            "price_variation_index": pvi,
            "priority_score":        int(meta["priority_score"].iloc[0]),
            "nutrition_score":       float(meta["nutrition_score"].iloc[0]),
            "is_perishable":         int(meta["is_perishable"].iloc[0]),
        }

    return item_stats
