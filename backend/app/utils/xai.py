"""
Lightweight explainability helpers for demand and waste predictions.
Returns top-5 contributing factors per item in plain English.
"""
from typing import List, Dict, Any


_DEMAND_LABELS: Dict[str, tuple] = {
    "avg_quantity_last3":    ("Recent avg purchase qty", "kg/trip"),
    "days_since_last":       ("Days since last purchase", "days"),
    "purchase_frequency":    ("Purchase frequency", "/month"),
    "seasonal_factor":       ("Seasonal demand", "×"),
    "household_size":        ("Household size", "members"),
    "consumption_rate":      ("Consumption rate", "kg/day"),
    "price":                 ("Current price", "₹"),
    "expiry_risk_proxy":     ("Expiry proximity risk", "score"),
    "is_festival_month":     ("Festival month boost", ""),
    "price_variation_index": ("Price variation index", ""),
    "is_summer_month":       ("Summer season active", ""),
    "is_monsoon_month":      ("Monsoon season active", ""),
}

_DEMAND_NORM_RANGES: Dict[str, tuple] = {
    "avg_quantity_last3":    (0.1, 5.0),
    "days_since_last":       (1.0, 60.0),
    "purchase_frequency":    (0.1, 10.0),
    "seasonal_factor":       (0.5, 2.5),
    "household_size":        (1.0, 8.0),
    "consumption_rate":      (0.1, 5.0),
    "price":                 (20.0, 600.0),
    "expiry_risk_proxy":     (0.0, 1.0),
    "price_variation_index": (-0.5, 1.0),
}

_DEMAND_FEATURE_ORDER = list(_DEMAND_LABELS.keys())


def explain_demand(stats: Dict[str, Any], importances: Dict[str, float]) -> List[Dict]:
    """Return top-5 demand factors with contribution scores and plain-English labels."""
    factors = []
    for feat in _DEMAND_FEATURE_ORDER:
        imp = importances.get(feat, 0.0)
        if imp < 0.005:
            continue
        val = stats.get(feat, 0.0)
        label, unit = _DEMAND_LABELS.get(feat, (feat, ""))

        if feat in ("is_festival_month", "is_summer_month", "is_monsoon_month"):
            if not val:
                continue
            contribution = round(imp, 4)
            val_str = "Yes"
            direction = "up"
        else:
            lo, hi = _DEMAND_NORM_RANGES.get(feat, (0.0, 1.0))
            span = hi - lo or 1e-6
            norm = max(0.0, min(1.0, (float(val) - lo) / span))
            contribution = round(imp * norm, 4)
            val_str = f"{float(val):.1f}{(' ' + unit) if unit else ''}"
            direction = "up" if contribution > 0.04 else "neutral"

        factors.append({
            "feature":      feat,
            "label":        label,
            "value":        val_str.strip(),
            "contribution": contribution,
            "direction":    direction,
        })

    factors.sort(key=lambda x: x["contribution"], reverse=True)
    return factors[:5]


def explain_waste(stats: Dict[str, Any], waste_prob: float) -> List[Dict]:
    """Return rule-based waste risk factors from feature values."""
    factors = []
    shelf   = float(stats.get("shelf_life", 14))
    cr      = float(stats.get("consumption_rate", 0.8))
    qty     = float(stats.get("avg_quantity_last3", 1.0))
    is_p    = int(stats.get("is_perishable", 0))
    is_sum  = int(stats.get("is_summer_month", 0))
    is_mon  = int(stats.get("is_monsoon_month", 0))

    if shelf < 5:
        factors.append({"feature": "shelf_life", "label": "Very short shelf life",
                        "value": f"{int(shelf)} days", "contribution": 0.30, "direction": "up"})
    elif shelf < 10:
        factors.append({"feature": "shelf_life", "label": "Short shelf life",
                        "value": f"{int(shelf)} days", "contribution": 0.20, "direction": "up"})

    if cr < 0.4 and is_p:
        factors.append({"feature": "consumption_rate", "label": "Low usage rate (risk of not finishing)",
                        "value": f"{cr:.2f} kg/day", "contribution": 0.25, "direction": "up"})

    if qty > 3 and shelf < 10:
        factors.append({"feature": "quantity", "label": "Large qty vs. short shelf life",
                        "value": f"{qty:.1f} kg", "contribution": 0.22, "direction": "up"})

    if is_sum and is_p:
        factors.append({"feature": "is_summer_month", "label": "Summer heat accelerates spoilage",
                        "value": "Active (Apr–Jun)", "contribution": 0.18, "direction": "up"})

    if is_mon and is_p:
        factors.append({"feature": "is_monsoon_month", "label": "Monsoon humidity increases risk",
                        "value": "Active (Jun–Sep)", "contribution": 0.15, "direction": "up"})

    if cr > 0.7 and shelf >= 10:
        factors.append({"feature": "consumption_rate", "label": "High usage rate reduces waste",
                        "value": f"{cr:.2f} kg/day", "contribution": 0.12, "direction": "down"})

    if not factors:
        factors.append({"feature": "general", "label": "Within normal usage pattern",
                        "value": f"{waste_prob:.0%} risk score", "contribution": round(waste_prob, 3),
                        "direction": "neutral"})

    factors.sort(key=lambda x: x["contribution"], reverse=True)
    return factors[:5]
