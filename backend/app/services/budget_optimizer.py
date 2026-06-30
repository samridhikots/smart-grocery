"""
Budget optimizer using a greedy fractional-knapsack approach.
Maximizes total priority_score * nutrition_score within a budget constraint.
"""
from typing import List, Dict, Optional
import math

from app.utils.helpers import ITEMS
from app.utils.store import model_store


def optimize_user_budget(
    user_id: int,
    budget: float,
    db,
    household_size: int = 3,
    preferred_categories: Optional[List[str]] = None,
) -> Dict:
    """
    Budget optimizer based on the user's actual purchase history and predicted demand.

    Sorts items by urgency (days until next needed, perishability) so the most
    important groceries are covered first when the budget is tight.  Returns
    both included items and a deferred list so the frontend can show exactly what
    was cut and why.
    """
    from app.services.user_stats import get_user_item_stats
    from app.database.db import PurchaseRecord

    records = db.query(PurchaseRecord).filter(PurchaseRecord.user_id == user_id).all()
    if not records:
        result = optimize_budget(budget, household_size, preferred_categories)
        result.setdefault("currency", "INR")
        result["total_needed"] = round(result["total_cost"] + result["savings"], 2)
        result["budget_gap"] = 0.0
        result["is_over_budget"] = False
        result["deferred_items"] = []
        result["total_items_needed"] = result["items_count"]
        for item in result["items"]:
            item.setdefault("days_until_next", 7)
            item.setdefault("urgency_label", "This week")
            item.setdefault("is_perishable", False)
            item.setdefault("status", "included")
        return result

    item_stats = get_user_item_stats(user_id, db, model_store.get("item_stats", {}))
    metadata = _load_metadata_lookup()
    scale = household_size / 3.0

    candidates = []
    for item, stats in item_stats.items():
        if preferred_categories and stats.get("category") not in preferred_categories:
            continue

        meta = metadata.get(item, {})
        qty = round(stats.get("avg_quantity_last3", 1.0) * scale * stats.get("seasonal_factor", 1.0), 2)
        qty = max(0.1, qty)
        unit_price = max(stats.get("price", 50.0), 1.0)
        total_cost = round(qty * unit_price, 2)

        freq = stats.get("purchase_frequency", 1.0)
        days_until_next = int(max(1, round(30.0 / max(freq, 0.1))))
        perishable = bool(stats.get("is_perishable", 0))
        priority = float(meta.get("priority_score", stats.get("priority_score", 5)))
        nutrition = float(meta.get("nutrition_score", 5.0))

        if days_until_next <= 2:
            urgency_label = "Buy today"
        elif days_until_next <= 7:
            urgency_label = "This week"
        else:
            urgency_label = "Later"

        # Sort key: urgency first, then perishability bonus
        urgency_score = max(0.0, (30 - days_until_next) / 30.0)
        sort_key = (days_until_next, -(urgency_score + (0.3 if perishable else 0.0)))

        candidates.append({
            "item": item,
            "category": stats.get("category", ""),
            "quantity": qty,
            "unit_price": unit_price,
            "total_cost": total_cost,
            "days_until_next": days_until_next,
            "urgency_label": urgency_label,
            "priority_score": priority,
            "nutrition_score": round(nutrition, 2),
            "is_perishable": perishable,
            "_sort_key": sort_key,
        })

    candidates.sort(key=lambda x: x["_sort_key"])
    total_needed = round(sum(c["total_cost"] for c in candidates), 2)

    selected: List[Dict] = []
    deferred: List[Dict] = []
    remaining = float(budget)

    for item in candidates:
        clean = {k: v for k, v in item.items() if not k.startswith("_")}
        if remaining >= item["total_cost"]:
            selected.append({**clean, "status": "included"})
            remaining -= item["total_cost"]
        elif remaining >= item["unit_price"] * 0.5:
            affordable_qty = round(remaining / item["unit_price"], 2)
            cost = round(affordable_qty * item["unit_price"], 2)
            selected.append({
                **clean,
                "quantity": affordable_qty,
                "total_cost": cost,
                "status": "partial",
                "note": f"Partial — {affordable_qty} of {item['quantity']} recommended",
            })
            remaining -= cost
        else:
            deferred.append({**clean, "status": "deferred"})

    total_spent = round(budget - remaining, 2)
    is_over_budget = total_needed > budget
    budget_gap = round(max(0.0, total_needed - budget), 2)

    max_pp = sum(c["priority_score"] for c in candidates) or 1.0
    got_pp = sum(
        c["priority_score"] * (1.0 if c.get("status") == "included" else 0.5)
        for c in selected
    )
    optimization_score = round(min(1.0, got_pp / max_pp), 3)

    return {
        "total_cost": total_spent,
        "total_needed": total_needed,
        "budget": budget,
        "savings": round(remaining, 2),
        "budget_gap": budget_gap,
        "is_over_budget": is_over_budget,
        "optimization_score": optimization_score,
        "items_count": len(selected),
        "total_items_needed": len(candidates),
        "items": selected,
        "deferred_items": deferred,
        "currency": "INR",
    }


def optimize_budget(
    budget: float,
    household_size: int = 3,
    preferred_categories: Optional[List[str]] = None,
) -> Dict:
    """
    Select the optimal grocery list given a budget.

    Strategy:
      1. Collect predicted quantities and prices for all items.
      2. Compute value = (priority_score * nutrition_score) / price  (value density).
      3. Greedily add items in descending value-density order until budget exhausted.
      4. If a full unit does not fit, add fractional amount.

    Returns a structured shopping plan.
    """
    item_stats = model_store.get("item_stats", {})
    metadata = _load_metadata_lookup()

    candidates = []
    for item, stats in item_stats.items():
        if item not in ITEMS:
            continue
        meta = metadata.get(item, {})
        props = ITEMS[item]

        if preferred_categories and props["category"] not in preferred_categories:
            continue

        # Scale quantity by household size
        scale = household_size / 3.0
        qty = round(stats["avg_quantity_last3"] * scale * stats["seasonal_factor"], 2)
        qty = max(0.1, qty)
        unit_price = stats["price"]
        total_cost = round(qty * unit_price, 2)

        priority = meta.get("priority_score", props["priority"])
        nutrition = meta.get("nutrition_score", 5.0)
        value_density = (priority * nutrition) / max(unit_price, 0.01)

        candidates.append({
            "item": item,
            "category": props["category"],
            "quantity": qty,
            "unit_price": unit_price,
            "total_cost": total_cost,
            "priority_score": priority,
            "nutrition_score": round(nutrition, 2),
            "value_density": round(value_density, 4),
        })

    # Sort by value density descending
    candidates.sort(key=lambda x: x["value_density"], reverse=True)

    selected = []
    remaining_budget = budget
    total_priority = 0.0

    for item in candidates:
        if remaining_budget <= 0:
            break

        max_affordable_qty = remaining_budget / item["unit_price"]
        if max_affordable_qty >= item["quantity"]:
            # Take full recommended quantity
            take_qty = item["quantity"]
        else:
            # Take fractional amount (minimum 0.1)
            take_qty = round(max_affordable_qty, 2)
            if take_qty < 0.1:
                continue

        cost = round(take_qty * item["unit_price"], 2)
        remaining_budget = round(remaining_budget - cost, 2)
        total_priority += item["priority_score"] * (take_qty / item["quantity"])

        selected.append({
            "item": item["item"],
            "category": item["category"],
            "quantity": take_qty,
            "unit_price": item["unit_price"],
            "total_cost": cost,
            "priority_score": item["priority_score"],
            "nutrition_score": item["nutrition_score"],
        })

    total_spent = round(budget - remaining_budget, 2)
    max_possible_priority = sum(
        c["priority_score"] for c in candidates[:len(selected)]
    ) if selected else 1.0
    optimization_score = round(
        min(1.0, total_priority / max(max_possible_priority, 1.0)), 3
    )

    return {
        "total_cost": total_spent,
        "budget": budget,
        "savings": round(remaining_budget, 2),
        "optimization_score": optimization_score,
        "items_count": len(selected),
        "items": sorted(selected, key=lambda x: x["category"]),
    }


def generate_weekly_plan(household_size: int = 3) -> Dict:
    """Generate a day-by-day shopping plan for the week."""
    days = ["Monday", "Wednesday", "Saturday"]
    all_items = list(model_store.get("item_stats", {}).keys())

    # Categorise items
    perishables = [i for i in all_items if i in ITEMS and ITEMS[i]["shelf_life"] <= 7]
    semi_perishables = [i for i in all_items if i in ITEMS and 7 < ITEMS[i]["shelf_life"] <= 30]
    non_perishables = [i for i in all_items if i in ITEMS and ITEMS[i]["shelf_life"] > 30]

    plan = {
        "Monday": perishables[:8],
        "Wednesday": perishables[8:] + semi_perishables[:5],
        "Saturday": semi_perishables[5:] + non_perishables[:8],
    }

    week_plan = []
    for day, items in plan.items():
        day_items = []
        for item in items:
            if item in ITEMS:
                props = ITEMS[item]
                stats = model_store["item_stats"].get(item, {})
                qty = round(stats.get("avg_quantity_last3", props["avg_qty"]) * (household_size / 3.0), 2)
                day_items.append({
                    "item": item,
                    "category": props["category"],
                    "quantity": qty,
                    "estimated_price": round(props["avg_price"] * qty, 2),
                })
        week_plan.append({"day": day, "items": day_items})

    total_est = sum(item["estimated_price"] for day in week_plan for item in day["items"])
    return {
        "week_plan": week_plan,
        "estimated_weekly_cost": round(total_est, 2),
        "household_size": household_size,
        "shopping_days": days,
    }


def _load_metadata_lookup() -> dict:
    """Return metadata as a dict keyed by item name."""
    try:
        from app.datasets.loader import load_product_metadata
        df = load_product_metadata()
        return {row["item"]: row.to_dict() for _, row in df.iterrows()}
    except Exception:
        return {}
