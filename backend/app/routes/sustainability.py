"""
/api/sustainability — environmental footprint metrics.

Endpoints:
  GET /api/sustainability           — full footprint report for a user
  GET /api/sustainability/items     — per-item eco scores (full catalog)
  GET /api/sustainability/my-items  — eco scores for user's purchased items + top picks
  GET /api/sustainability/swaps     — CO₂ swap suggestions
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.utils.store import model_store
from app.utils.auth import get_current_user_id
from app.utils.helpers import ITEMS

router = APIRouter()

# Category-level eco defaults for BigBasket items not in the footprint catalog
_CAT_ECO = {
    "Vegetables": {"eco_score": 8.0, "co2_per_unit_g": 200,  "plastic_packaging": False, "is_biodegradable": True},
    "Fruits":     {"eco_score": 7.5, "co2_per_unit_g": 300,  "plastic_packaging": False, "is_biodegradable": True},
    "Grains":     {"eco_score": 6.5, "co2_per_unit_g": 500,  "plastic_packaging": False, "is_biodegradable": True},
    "Dairy":      {"eco_score": 5.5, "co2_per_unit_g": 800,  "plastic_packaging": True,  "is_biodegradable": False},
    "Protein":    {"eco_score": 4.0, "co2_per_unit_g": 2000, "plastic_packaging": True,  "is_biodegradable": False},
    "Beverages":  {"eco_score": 4.5, "co2_per_unit_g": 600,  "plastic_packaging": True,  "is_biodegradable": False},
}


def _norm(s: str) -> str:
    return s.lower().strip()


def _match_footprint(item_name: str, fp_norm: dict):
    """Try to find an eco-footprint entry for item_name via exact or keyword match."""
    n = _norm(item_name)
    if n in fp_norm:
        return fp_norm[n][1], False  # (eco_data, is_estimated)
    # Keyword match: any significant word (>3 chars) from the item name found in a footprint key
    words = [w for w in n.split() if len(w) > 3]
    for fp_key, (_, fp_val) in fp_norm.items():
        if any(w in fp_key for w in words):
            return fp_val, False
    return None, True


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


@router.get("/sustainability/my-items")
def get_my_item_eco_scores(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Return eco scores for items the user has actually purchased.
    Also returns top sustainable picks from the same categories that the user
    hasn't bought yet.
    """
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    from app.database.db import PurchaseRecord

    records = (
        db.query(PurchaseRecord.item, PurchaseRecord.category)
        .filter(PurchaseRecord.user_id == user_id)
        .distinct()
        .all()
    )

    footprint = model_store["sustainability"].get("item_footprint", {})
    fp_norm = {_norm(k): (k, v) for k, v in footprint.items()}

    user_categories = {r.category for r in records}
    purchased_norm  = {_norm(r.item) for r in records}

    my_items = []
    for r in records:
        eco_data, is_est = _match_footprint(r.item, fp_norm)
        if eco_data:
            my_items.append({
                "item":             r.item,
                "category":         r.category,
                "eco_score":        eco_data["eco_score"],
                "co2_per_unit_g":   eco_data["co2_per_unit_g"],
                "plastic_packaging": eco_data["plastic_packaging"],
                "is_biodegradable": not eco_data.get("non_biodegradable", not eco_data.get("is_biodegradable", True)),
                "is_estimated":     is_est,
            })
        else:
            d = _CAT_ECO.get(r.category, {"eco_score": 5.0, "co2_per_unit_g": 500, "plastic_packaging": False, "is_biodegradable": True})
            my_items.append({
                "item":             r.item,
                "category":         r.category,
                "eco_score":        d["eco_score"],
                "co2_per_unit_g":   d["co2_per_unit_g"],
                "plastic_packaging": d["plastic_packaging"],
                "is_biodegradable": d["is_biodegradable"],
                "is_estimated":     True,
            })

    my_items.sort(key=lambda x: x["eco_score"], reverse=True)

    # Top sustainable picks from user's categories that they haven't bought yet
    top_picks = []
    for fp_key_orig, eco_data in sorted(footprint.items(), key=lambda x: -x[1]["eco_score"]):
        props = ITEMS.get(fp_key_orig, {})
        if props.get("category") in user_categories and _norm(fp_key_orig) not in purchased_norm:
            top_picks.append({
                "item":             fp_key_orig,
                "category":         props.get("category", ""),
                "eco_score":        eco_data["eco_score"],
                "co2_per_unit_g":   eco_data["co2_per_unit_g"],
                "plastic_packaging": eco_data["plastic_packaging"],
                "is_biodegradable": not eco_data.get("non_biodegradable", True),
                "is_estimated":     False,
            })
        if len(top_picks) >= 10:
            break

    return {"my_items": my_items, "top_picks": top_picks}


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
