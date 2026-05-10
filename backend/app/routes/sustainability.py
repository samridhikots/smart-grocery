"""
/api/sustainability — environmental footprint metrics.

Endpoints:
  GET /api/sustainability         — full footprint report for a user
  GET /api/sustainability/items   — per-item eco scores and packaging info
  GET /api/sustainability/swaps   — CO₂ swap suggestions
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.utils.store import model_store
from app.utils.auth import get_current_user_id
from app.utils.helpers import ITEMS

router = APIRouter()


@router.get("/sustainability")
def get_sustainability(
    months:  int = Query(default=1, ge=1, le=12),
    user_id: int = Depends(get_current_user_id),
):
    """
    Returns sustainability/environmental metrics for the user's purchase history.
    Response is flat to match the frontend SustainabilityResult type.
    """
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    sustainability = model_store.get("sustainability", {})
    tracker = sustainability.get("tracker")

    if not tracker or not sustainability.get("is_ready"):
        raise HTTPException(status_code=503, detail="Sustainability tracker not ready")

    try:
        from app.datasets.loader import load_grocery_purchases
        purchases = load_grocery_purchases()
    except Exception:
        raise HTTPException(status_code=500, detail="Could not load purchase data")

    footprint = tracker.compute_footprint(purchases, user_id=user_id, months=months)

    # Return flat response matching frontend SustainabilityResult type
    return {
        "user_id":                user_id,
        "months":                 months,
        "plastic_packaging_pct":  footprint.get("plastic_packaging_pct", 0.0),
        "non_biodegradable_pct":  footprint.get("non_biodegradable_pct", 0.0),
        "avg_eco_score":          footprint.get("avg_eco_score", 5.0),
        "total_co2_kg_estimate":  footprint.get("total_co2_kg_estimate", 0.0),
        "swap_suggestions":       footprint.get("swap_suggestions", []),
        "high_impact_items":      footprint.get("high_impact_items", {}),
        "summary_message":        footprint.get("summary_message", ""),
        "total_items_purchased":  footprint.get("total_items_purchased", 0),
    }


@router.get("/sustainability/items")
def get_item_eco_scores():
    """
    Return eco scores and packaging metadata for all catalog items.
    Returns a flat array matching the frontend SustainabilityItem[] type.
    """
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    footprint = model_store["sustainability"].get("item_footprint", {})
    result = []
    for item, meta in footprint.items():
        props = ITEMS.get(item, {})
        result.append({
            "item":               item,
            "category":           props.get("category", ""),
            "eco_score":          meta["eco_score"],
            "co2_per_unit_g":     meta["co2_per_unit_g"],
            "plastic_packaging":  meta["plastic_packaging"],
            "is_biodegradable":   not meta["non_biodegradable"],
        })

    result.sort(key=lambda x: x["eco_score"], reverse=True)
    return result  # flat array


@router.get("/sustainability/swaps")
def get_swap_suggestions(user_id: int = Depends(get_current_user_id)):
    """Return personalised CO₂-reduction swap suggestions."""
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    tracker = model_store["sustainability"].get("tracker")
    if not tracker:
        raise HTTPException(status_code=503, detail="Sustainability tracker not ready")

    try:
        from app.datasets.loader import load_grocery_purchases
        purchases = load_grocery_purchases()
        footprint = tracker.compute_footprint(purchases, user_id=user_id, months=3)
        return {
            "user_id": user_id,
            "swaps":   footprint.get("swap_suggestions", []),
            "message": footprint.get("summary_message", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
