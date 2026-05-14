import logging

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.services.user_stats import get_user_item_stats
from app.utils.auth import get_current_user_id
from app.utils.helpers import FESTIVAL_MONTHS, ITEMS, MONSOON_MONTHS, SUMMER_MONTHS
from app.utils.store import model_store

logger = logging.getLogger(__name__)

router = APIRouter()

# Feature order must match feature_engineering.py exactly
DEMAND_FEATURES = [
    "avg_quantity_last3", "days_since_last", "purchase_frequency",
    "seasonal_factor", "household_size", "consumption_rate",
    "price", "category_encoded", "expiry_risk_proxy", "is_festival_month",
    "price_variation_index", "is_summer_month", "is_monsoon_month",
]

WASTE_FEATURES = [
    # base (10)
    "expiry_days", "shelf_life", "expiry_risk", "consumption_rate",
    "quantity", "price", "household_size_proxy", "nutrition_score",
    "is_perishable", "category_encoded",
    # engineered (10)
    "consumption_to_expiry_ratio", "quantity_per_household", "price_per_unit",
    "perishability_score", "waste_risk_interaction", "category_risk_avg",
    "rolling_waste_rate", "normalized_quantity", "seasonal_waste_factor",
    "price_sensitivity_score",
    # Indian context (4)
    "is_summer_month", "is_monsoon_month", "monsoon_perishable_flag", "price_variation_index",
]

_CATEGORY_ENCODE = {
    "Beverages": 0, "Dairy": 1, "Fruits": 2,
    "Grains": 3, "Protein": 4, "Vegetables": 5,
}


def _current_season_flags() -> tuple[int, int]:
    """Return (is_summer, is_monsoon) for current month."""
    from datetime import datetime
    m = datetime.now().month
    return int(m in SUMMER_MONTHS), int(m in MONSOON_MONTHS)


def _demand_row(stats: dict) -> np.ndarray:
    cat = _CATEGORY_ENCODE.get(stats.get("category", "Grains"), 3)
    return np.array([[
        stats.get("avg_quantity_last3",    1.0),
        stats.get("days_since_last",       7.0),
        stats.get("purchase_frequency",    1.0),
        stats.get("seasonal_factor",       1.0),
        stats.get("household_size",        3.0),
        stats.get("consumption_rate",      0.8),
        stats.get("price",                50.0),
        cat,
        stats.get("expiry_risk_proxy",     0.1),
        stats.get("is_festival_month",     0.0),
        stats.get("price_variation_index", 0.2),
        stats.get("is_summer_month",       0.0),
        stats.get("is_monsoon_month",      0.0),
    ]], dtype=float)


def _waste_row(item: str, stats: dict, quantity: float) -> np.ndarray:
    shelf  = stats.get("shelf_life", 14)
    expiry_days = max(1, int(shelf * 0.7))
    expiry_risk = round(1.0 - expiry_days / max(shelf, 1), 3)
    cat    = _CATEGORY_ENCODE.get(stats.get("category", "Grains"), 3)
    qty    = quantity if quantity else stats.get("avg_quantity_last3", 1.0)
    price  = stats.get("price", 50.0)
    cr     = stats.get("consumption_rate", 0.8)
    is_p   = stats.get("is_perishable", 0)
    pvi    = stats.get("price_variation_index", 0.2)
    is_sum = stats.get("is_summer_month", 0)
    is_mon = stats.get("is_monsoon_month", 0)

    hh_proxy = min(6.0, max(1.0, qty / max(cr, 0.1)))

    # Engineered
    c2e    = min(10.0, cr / max(expiry_days, 1))
    qph    = min(20.0, qty / max(hh_proxy, 1))
    ppu    = min(1000.0, price / max(qty, 0.1))
    peris  = round(1.0 / max(shelf, 1), 4)
    wri    = expiry_risk * (1.0 - min(1.0, cr))

    fs = model_store["waste"].get("feature_stats", {})
    cat_risk = fs.get("category_risk", {}).get(stats.get("category", "Grains"), 0.3)
    item_wr  = fs.get("item_waste_rate", {}).get(item, 0.3)

    q_mean = fs.get("quantity_mean", 1.5)
    q_std  = fs.get("quantity_std", 1.0) or 1.0
    norm_q = max(-3.0, min(3.0, (qty - q_mean) / q_std))

    sw_factor = is_p * (1.0 + 0.2 * float(shelf < 7))
    pss       = price * is_p

    monsoon_p = is_mon * is_p

    return np.array([[
        expiry_days, shelf, expiry_risk, cr, qty, price,
        hh_proxy, stats.get("nutrition_score", 6.0), is_p, cat,
        c2e, qph, ppu, peris, wri, cat_risk, item_wr, norm_q, sw_factor, pss,
        is_sum, is_mon, monsoon_p, pvi,
    ]], dtype=float)


@router.get("/predict-demand")
def predict_demand(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    scaler       = model_store["demand"]["scaler"]
    xgb_model    = model_store["demand"]["xgboost"]
    linear_model = model_store["demand"]["linear"]
    item_stats   = get_user_item_stats(user_id, db, model_store["item_stats"])

    # Use test R² as the base for confidence — honest about model quality
    test_r2 = model_store["demand"]["metrics"]["xgboost"].get("r2", 0.7)
    base_confidence = max(0.0, min(1.0, test_r2))

    results = []
    for item, stats in item_stats.items():
        row    = _demand_row(stats)
        row_sc = scaler.transform(row)
        xgb_p  = float(xgb_model.predict(row_sc)[0])
        lin_p  = float(linear_model.predict(row_sc)[0])

        hist_avg  = stats.get("avg_quantity_last3", 1.0)
        deviation = abs(xgb_p - hist_avg) / max(hist_avg, 0.1)
        confidence = round(max(0.05, base_confidence - min(0.25, deviation * 0.15)), 2)
        days_next  = int(max(1, 30 / max(stats.get("purchase_frequency", 1.0), 0.1)))

        # Human-readable urgency message
        if days_next <= 2:
            urgency = f"Buy today — stock runs out in {days_next} day(s)!"
        elif days_next <= 5:
            urgency = f"Buy in {days_next} days."
        else:
            urgency = f"Next purchase in ~{days_next} days."

        results.append({
            "item":                       item,
            "category":                   stats.get("category", ""),
            "brand":                      ITEMS.get(item, {}).get("brand", ""),
            "predicted_quantity_xgboost": round(xgb_p, 2),
            "predicted_quantity_linear":  round(lin_p, 2),
            "historical_avg":             round(hist_avg, 2),
            "confidence":                 round(confidence, 2),
            "recommended_quantity":       round(xgb_p, 2),
            "unit_price_inr":             stats.get("price", 50.0),
            "estimated_cost_inr":         round(xgb_p * stats.get("price", 50.0), 2),
            "days_until_next":            days_next,
            "seasonal_factor":            stats.get("seasonal_factor", 1.0),
            "is_festival_month":          stats.get("is_festival_month", 0),
            "urgency_message":            urgency,
        })

    results.sort(key=lambda x: x["days_until_next"])
    return {
        "predictions":  results,
        "model_used":   "XGBoost (primary)",
        "total_items":  len(results),
        "currency":     "INR",
    }


@router.get("/predict-waste")
def predict_waste(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    scaler         = model_store["waste"]["scaler"]
    tabnet_model   = model_store["waste"]["tabnet"]
    logistic_model = model_store["waste"]["logistic"]
    item_stats     = get_user_item_stats(user_id, db, model_store["item_stats"])

    results = []
    for item, stats in item_stats.items():
        qty    = stats.get("avg_quantity_last3", 1.0)
        row    = _waste_row(item, stats, qty)
        row_sc = scaler.transform(row)

        tabnet_prob  = float(tabnet_model.predict_proba(row_sc)[0])
        logistic_prob = float(logistic_model.predict_proba(row_sc)[0])

        risk_level  = "High" if tabnet_prob > 0.6 else ("Medium" if tabnet_prob > 0.35 else "Low")
        shelf       = stats.get("shelf_life", 14)
        days_left   = max(1, int(shelf * 0.7 * (1 - tabnet_prob * 0.5)))

        # Indian-specific waste advice
        is_summer  = stats.get("is_summer_month", 0)
        is_monsoon = stats.get("is_monsoon_month", 0)
        season_note = ""
        if is_summer and stats.get("is_perishable", 0):
            season_note = " Summer heat accelerates spoilage — refrigerate immediately."
        elif is_monsoon and stats.get("is_perishable", 0):
            season_note = " Monsoon humidity increases risk — check daily."

        recs = {
            "High":   f"Use {item} within {days_left} days — high spoilage risk!{season_note}",
            "Medium": f"Plan meals with {item} this week to avoid waste.{season_note}",
            "Low":    f"{item} has low waste risk. Normal usage is fine.",
        }

        results.append({
            "item":                      item,
            "category":                  stats.get("category", ""),
            "brand":                     ITEMS.get(item, {}).get("brand", ""),
            "waste_probability_tabnet":  round(tabnet_prob, 3),
            "waste_probability_logistic": round(logistic_prob, 3),
            "risk_level":                risk_level,
            "days_until_expiry":         days_left,
            "shelf_life_days":           shelf,
            "recommendation":            recs[risk_level],
            "is_perishable":             stats.get("is_perishable", 0),
        })

    results.sort(key=lambda x: x["waste_probability_tabnet"], reverse=True)
    return {
        "waste_alerts":    results,
        "high_risk_count": sum(1 for r in results if r["risk_level"] == "High"),
        "medium_risk_count": sum(1 for r in results if r["risk_level"] == "Medium"),
    }
