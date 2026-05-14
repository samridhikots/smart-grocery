"""
/api/insights — aggregates predictions from ALL models into prioritised,
human-readable insights for Indian household users.

/api/recommendations — FP-Growth item recommendations for a given basket.
/api/overspending    — Isolation Forest overspending detection.
"""
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.datasets.loader import load_grocery_purchases
from app.services.user_stats import get_user_item_stats
from app.utils.auth import get_current_user_id
from app.utils.store import model_store

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# /api/insights
# ---------------------------------------------------------------------------

@router.get("/insights")
def get_insights(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Returns a prioritised list of actionable insights for the user:
      - Shortage alerts (demand model)
      - Spoilage warnings (waste model)
      - Overspending alerts (Isolation Forest)
      - Shopping recommendations (FP-Growth)
      - Sustainability tips
    """
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    insights = []
    now = datetime.now()

    # --- 1. Demand: shortage alerts ---
    item_stats = get_user_item_stats(user_id, db, model_store["item_stats"])
    scaler     = model_store["demand"]["scaler"]
    xgb_model  = model_store["demand"]["xgboost"]

    from app.routes.prediction import _demand_row, _waste_row
    from app.utils.helpers import ITEMS

    for item, stats in item_stats.items():
        row    = _demand_row(stats)
        row_sc = scaler.transform(row)
        qty    = float(xgb_model.predict(row_sc)[0])
        days   = int(max(1, 30 / max(stats.get("purchase_frequency", 1.0), 0.1)))

        if days <= 2:
            insights.append({
                "type":     "shortage",
                "severity": "critical",
                "item":     item,
                "category": stats.get("category", ""),
                "icon":     "🛒",
                "title":    f"{item} running out soon",
                "message":  f"You'll need {item} in {days} day(s). Buy {round(qty, 1)} "
                            f"{'kg' if item not in ('Milk', 'Eggs') else ('L' if item == 'Milk' else 'pcs')} "
                            f"(₹{round(qty * stats.get('price', 50), 0):.0f}).",
                "action":   "add_to_cart",
                "priority": 1,
            })
        elif days <= 5:
            insights.append({
                "type":     "shortage",
                "severity": "high",
                "item":     item,
                "category": stats.get("category", ""),
                "icon":     "⚠️",
                "title":    f"Restock {item} soon",
                "message":  f"Buy {item} in the next {days} days. Recommended: {round(qty, 1)} units.",
                "action":   "plan_purchase",
                "priority": 2,
            })

    # --- 2. Waste: spoilage alerts ---
    w_scaler = model_store["waste"]["scaler"]
    tabnet   = model_store["waste"]["tabnet"]

    for item, stats in item_stats.items():
        qty    = stats.get("avg_quantity_last3", 1.0)
        row    = _waste_row(item, stats, qty)
        row_sc = w_scaler.transform(row)
        prob   = float(tabnet.predict_proba(row_sc)[0])
        shelf  = stats.get("shelf_life", 14)
        days_left = max(1, int(shelf * 0.7 * (1 - prob * 0.5)))

        if prob > 0.65:
            insights.append({
                "type":     "waste_alert",
                "severity": "critical",
                "item":     item,
                "category": stats.get("category", ""),
                "icon":     "🗑️",
                "title":    f"{item} may spoil soon",
                "message":  f"{item} has a {int(prob*100)}% chance of spoiling. "
                            f"Use it within {days_left} day(s) or refrigerate immediately.",
                "action":   "consume_now",
                "priority": 1,
            })
        elif prob > 0.40:
            insights.append({
                "type":     "waste_alert",
                "severity": "medium",
                "item":     item,
                "category": stats.get("category", ""),
                "icon":     "⏰",
                "title":    f"Use {item} this week",
                "message":  f"{item} has moderate spoilage risk ({int(prob*100)}%). "
                            f"Plan meals with it in the next {days_left} days.",
                "action":   "plan_meal",
                "priority": 3,
            })

    # --- 3. Overspending ---
    anomaly_model = model_store["anomaly"].get("model")
    if anomaly_model and anomaly_model.is_trained:
        try:
            purchases = load_grocery_purchases()
            result = anomaly_model.predict(
                purchases, user_id=user_id,
                current_month=now.month, current_year=now.year,
            )
            if result["is_overspending"] and result["overspent_by"] > 50:
                insights.append({
                    "type":     "budget_alert",
                    "severity": "high",
                    "item":     None,
                    "category": None,
                    "icon":     "💸",
                    "title":    "Overspending detected",
                    "message":  f"You overspent ₹{int(result['overspent_by'])} this month "
                                f"vs your 3-month average of ₹{int(result['rolling_avg_3m'])}.",
                    "action":   "review_budget",
                    "priority": 2,
                    "data":     result,
                })
        except Exception as exc:
            logger.warning("[insights] overspending check failed for user %d: %s", user_id, exc)

    # --- 4. Recommendations ---
    recommender = model_store["recommendation"].get("model")
    if recommender and recommender.is_trained:
        # Recommend based on high-frequency items in user's typical basket
        top_items = sorted(item_stats.keys(), key=lambda x: -item_stats[x].get("purchase_frequency", 0))[:6]
        recs = recommender.recommend(top_items, top_n=3)
        for rec in recs:
            insights.append({
                "type":     "recommendation",
                "severity": "info",
                "item":     rec["item"],
                "category": ITEMS.get(rec["item"], {}).get("category", ""),
                "icon":     "💡",
                "title":    f"Consider adding {rec['item']}",
                "message":  f"Households like yours buy {rec['item']} with {int(rec['confidence']*100)}% confidence "
                            f"alongside your regular items.",
                "action":   "add_suggestion",
                "priority": 5,
            })

    # --- 5. Sustainability tip ---
    sustainability = model_store["sustainability"]
    if sustainability.get("is_ready"):
        tracker = sustainability.get("tracker")
        if tracker:
            try:
                purchases = load_grocery_purchases()
                footprint = tracker.compute_footprint(purchases, user_id=user_id, months=1)
                if footprint["plastic_packaging_pct"] > 40:
                    insights.append({
                        "type":     "sustainability",
                        "severity": "low",
                        "item":     None,
                        "category": None,
                        "icon":     "🌿",
                        "title":    "High plastic packaging",
                        "message":  f"{footprint['plastic_packaging_pct']}% of your purchases use plastic packaging. "
                                    f"Try buying loose vegetables and unpackaged grains.",
                        "action":   "eco_tips",
                        "priority": 6,
                    })
            except Exception as exc:
                logger.warning("[insights] sustainability check failed for user %d: %s", user_id, exc)

    # Sort by priority (1 = most urgent)
    insights.sort(key=lambda x: (x["priority"], x["severity"] != "critical"))

    return {
        "user_id":      user_id,
        "generated_at": now.isoformat(),
        "total":        len(insights),
        "insights":     insights,
    }


# ---------------------------------------------------------------------------
# /api/recommendations
# ---------------------------------------------------------------------------

class BasketRequest(BaseModel):
    basket: List[str]
    top_n: int = 5


@router.post("/recommendations")
def get_recommendations(req: BasketRequest):
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    recommender = model_store["recommendation"].get("model")
    if not recommender:
        raise HTTPException(status_code=503, detail="Recommendation model not ready")

    recs = recommender.recommend(req.basket, top_n=req.top_n)
    top_rules = recommender.top_rules(n=10) if recommender.is_trained else []

    return {
        "basket":          req.basket,
        "recommendations": recs,
        "top_rules":       top_rules,
    }


# ---------------------------------------------------------------------------
# /api/overspending
# ---------------------------------------------------------------------------

@router.get("/overspending")
def get_overspending(
    month: Optional[int] = Query(default=None),
    year:  Optional[int] = Query(default=None),
    user_id: int = Depends(get_current_user_id),
):
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    anomaly_model = model_store["anomaly"].get("model")
    if not anomaly_model or not anomaly_model.is_trained:
        raise HTTPException(status_code=503, detail="Anomaly model not trained")

    now = datetime.now()
    target_month = month or now.month
    target_year  = year  or now.year

    try:
        purchases = load_grocery_purchases()
    except Exception:
        raise HTTPException(status_code=500, detail="Could not load purchase data")

    result = anomaly_model.predict(purchases, user_id=user_id,
                                   current_month=target_month, current_year=target_year)

    # Build history with anomaly flags for sparkline
    monthly = anomaly_model.build_features(purchases)
    user_history = monthly[monthly["user_id"] == user_id].sort_values(["year", "month"])
    history = []
    if not user_history.empty and anomaly_model.is_trained:
        try:
            rows_sc = anomaly_model.scaler.transform(
                user_history[anomaly_model.FEATURE_COLS].fillna(0).values.astype(float)
            )
            labels = anomaly_model.model.predict(rows_sc)
            for (_, r), label in zip(user_history.tail(12).iterrows(), labels[-12:]):
                history.append({
                    "month":      f"{int(r['year'])}-{int(r['month']):02d}",
                    "spend":      round(float(r["monthly_spend"]), 2),
                    "is_anomaly": bool(label == -1),
                })
        except Exception:
            for _, r in user_history.tail(12).iterrows():
                history.append({
                    "month":      f"{int(r['year'])}-{int(r['month']):02d}",
                    "spend":      round(float(r["monthly_spend"]), 2),
                    "is_anomaly": False,
                })

    is_anomaly     = bool(result.get("is_overspending", False))
    monthly_spend  = float(result.get("monthly_spend", 0.0))
    avg_3month     = float(result.get("rolling_avg_3m", 0.0))
    overspend_amt  = float(result.get("overspent_by", 0.0))
    verdict        = "overspending" if is_anomaly else "normal"

    return {
        "user_id":         user_id,
        "month":           target_month,
        "year":            target_year,
        "verdict":         verdict,
        "is_anomaly":      is_anomaly,
        "monthly_spend":   monthly_spend,
        "avg_3month":      avg_3month,
        "overspend_amount": overspend_amt,
        "message":         result.get("message", ""),
        "history":         history,
    }
