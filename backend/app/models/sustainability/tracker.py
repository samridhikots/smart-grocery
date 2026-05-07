"""
Sustainability & environmental footprint tracker.

No ML needed here — assigns plastic/non-biodegradable flags to each item
based on packaging type, then aggregates across purchase history to give
users actionable environmental insights.

Eco-score: 0 (worst) → 10 (best)
"""
from typing import Optional
import pandas as pd

from app.utils.helpers import ITEMS


# Non-biodegradable packaging categories (multi-use plastics, foil pouches, etc.)
# True = item generates non-biodegradable waste when purchased
NON_BIO_ITEMS = {
    # Dairy (plastic pouches / tetra paks)
    "Milk", "Curd", "Paneer", "Butter", "Ghee",
    # Packaged grains / staples (plastic bags)
    "Atta", "Rice", "Toor Dal", "Chana Dal", "Sugar", "Moong Dal",
    # Protein (plastic wrap)
    "Chicken", "Fish",
    # Beverages (foil / plastic packaging)
    "Tea", "Coffee", "Mustard Oil",
}

# Items sold loose / in paper / no packaging
ECO_FRIENDLY_ITEMS = {
    "Tomato", "Potato", "Onion", "Carrot", "Spinach",
    "Cauliflower", "Lady Finger", "Brinjal",
    "Banana", "Apple", "Mango", "Orange", "Grapes",
    "Eggs",   # cardboard tray
}

# Eco-scores per item (0–10, higher = more sustainable)
# Loose produce scores high; heavily packaged processed goods score low
ECO_SCORES = {
    "Tomato": 9, "Potato": 9, "Onion": 9, "Carrot": 9,
    "Spinach": 9, "Cauliflower": 9, "Lady Finger": 8, "Brinjal": 8,
    "Banana": 9, "Apple": 8, "Mango": 8, "Orange": 8, "Grapes": 7,
    "Eggs": 7,
    "Milk": 5, "Curd": 5, "Paneer": 5, "Butter": 4, "Ghee": 4,
    "Atta": 6, "Rice": 6, "Toor Dal": 5, "Chana Dal": 5, "Sugar": 5, "Moong Dal": 5,
    "Chicken": 4, "Fish": 4,
    "Tea": 4, "Coffee": 3, "Mustard Oil": 5,
}

# Approximate CO₂ footprint estimate in grams per kg / per unit
# Source: rough lifecycle estimates; good enough for relative comparison
CO2_PER_UNIT = {
    "Chicken": 6200, "Fish": 3900, "Eggs": 400,
    "Milk": 1200, "Butter": 5500, "Ghee": 4500, "Paneer": 2800, "Curd": 1200,
    "Rice": 2700, "Atta": 900, "Sugar": 600,
    "Toor Dal": 900, "Chana Dal": 900, "Moong Dal": 900,
    "Tomato": 150, "Potato": 120, "Onion": 100, "Carrot": 130,
    "Spinach": 90, "Cauliflower": 150, "Lady Finger": 110, "Brinjal": 120,
    "Banana": 80, "Apple": 200, "Mango": 160, "Orange": 150, "Grapes": 180,
    "Tea": 3000, "Coffee": 7000, "Mustard Oil": 1800,
}


class SustainabilityTracker:
    def __init__(self):
        self.item_footprint: dict = {}
        self.is_ready = False

    def build_item_footprint(self) -> dict:
        """Pre-compute per-item sustainability metadata."""
        result = {}
        for item, props in ITEMS.items():
            plastic = props.get("plastic_packaging", False)
            non_bio = item in NON_BIO_ITEMS
            eco     = ECO_SCORES.get(item, 5)
            co2     = CO2_PER_UNIT.get(item, 500)
            result[item] = {
                "plastic_packaging":   plastic,
                "non_biodegradable":   non_bio,
                "eco_score":           eco,
                "co2_per_unit_g":      co2,
                "category":            props["category"],
                "eco_tip":             _eco_tip(item, plastic, non_bio, eco),
            }
        self.item_footprint = result
        self.is_ready = True
        return result

    def compute_footprint(
        self,
        purchases: pd.DataFrame,
        user_id: Optional[int] = None,
        months: int = 1,
    ) -> dict:
        """
        Compute sustainability metrics for a user's purchase history.

        Args:
            purchases:  DataFrame with columns [user_id, item, quantity, price, purchase_date]
            user_id:    Filter to specific user (None = all users)
            months:     How many recent months to consider
        """
        if not self.is_ready:
            self.build_item_footprint()

        df = purchases.copy()
        if df.empty:
            return self._empty_response()

        if "purchase_date" in df.columns:
            df["purchase_date"] = pd.to_datetime(df["purchase_date"], errors="coerce")

        if user_id is not None and "user_id" in df.columns:
            df = df[df["user_id"] == user_id]

        if df.empty:
            return self._empty_response()

        # Recent months filter
        if "purchase_date" in df.columns and months > 0:
            cutoff = df["purchase_date"].max() - pd.DateOffset(months=months)
            df = df[df["purchase_date"] >= cutoff]

        total_items  = len(df)
        if total_items == 0:
            return self._empty_response()

        # Enrich with sustainability metadata
        df["plastic_packaging"] = df["item"].map(
            lambda x: self.item_footprint.get(x, {}).get("plastic_packaging", False)
        )
        df["non_biodegradable"] = df["item"].map(
            lambda x: self.item_footprint.get(x, {}).get("non_biodegradable", False)
        )
        df["eco_score"] = df["item"].map(
            lambda x: self.item_footprint.get(x, {}).get("eco_score", 5)
        )
        df["co2_g"] = df.apply(
            lambda r: self.item_footprint.get(r["item"], {}).get("co2_per_unit_g", 500)
                      * float(r.get("quantity", 1)),
            axis=1,
        )

        plastic_count   = int(df["plastic_packaging"].sum())
        non_bio_count   = int(df["non_biodegradable"].sum())
        total_co2_kg    = round(df["co2_g"].sum() / 1000, 2)
        avg_eco_score   = round(float(df["eco_score"].mean()), 1)
        plastic_pct     = round(100 * plastic_count / total_items, 1)
        non_bio_pct     = round(100 * non_bio_count / total_items, 1)

        # Top plastic categories
        plastic_items   = df[df["plastic_packaging"]]
        top_plastic_cat = {}
        if not plastic_items.empty and "category" in plastic_items.columns:
            top_plastic_cat = plastic_items["category"].value_counts().head(3).to_dict()

        # Eco tips: items with low eco score bought most
        low_eco = df[df["eco_score"] <= 4]["item"].value_counts().head(3).to_dict()

        # Swap suggestions (high CO₂ → better alternatives)
        swaps = _generate_swaps(df)

        return {
            "total_items_purchased":    total_items,
            "plastic_packaging_count":  plastic_count,
            "plastic_packaging_pct":    plastic_pct,
            "non_biodegradable_count":  non_bio_count,
            "non_biodegradable_pct":    non_bio_pct,
            "avg_eco_score":            avg_eco_score,
            "total_co2_kg_estimate":    total_co2_kg,
            "top_plastic_categories":   top_plastic_cat,
            "high_impact_items":        low_eco,
            "swap_suggestions":         swaps,
            "summary_message": _summary_message(plastic_pct, avg_eco_score, total_co2_kg),
        }

    @staticmethod
    def _empty_response() -> dict:
        return {
            "total_items_purchased": 0,
            "plastic_packaging_count": 0,
            "plastic_packaging_pct": 0.0,
            "non_biodegradable_count": 0,
            "non_biodegradable_pct": 0.0,
            "avg_eco_score": 5.0,
            "total_co2_kg_estimate": 0.0,
            "top_plastic_categories": {},
            "high_impact_items": {},
            "swap_suggestions": [],
            "summary_message": "No purchase data available.",
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _eco_tip(item: str, plastic: bool, non_bio: bool, eco: int) -> str:
    if item in ECO_FRIENDLY_ITEMS:
        return "Buy loose for zero packaging waste."
    if item == "Milk":
        return "Switch to glass-bottle milk delivery to cut plastic."
    if item in ("Atta", "Rice"):
        return "Buy in bulk paper sacks instead of plastic bags."
    if item in ("Chicken", "Fish"):
        return "High carbon footprint — reduce frequency or replace with dal/eggs."
    if plastic:
        return "Generates plastic waste — prefer unpackaged or paper-wrapped alternatives."
    return "Moderate footprint — no special action needed."


def _generate_swaps(df: pd.DataFrame) -> list[dict]:
    """Suggest lower-impact swaps for high-CO₂ items."""
    SWAPS = {
        "Chicken": {"swap_to": "Toor Dal",  "co2_saving_pct": 85, "reason": "Plant protein vs poultry"},
        "Fish":    {"swap_to": "Moong Dal", "co2_saving_pct": 77, "reason": "Plant protein vs seafood"},
        "Butter":  {"swap_to": "Ghee",      "co2_saving_pct": 20, "reason": "Ghee lasts longer — less waste"},
        "Coffee":  {"swap_to": "Tea",        "co2_saving_pct": 57, "reason": "Tea has 7× lower carbon than coffee"},
    }
    result = []
    if "item" in df.columns:
        bought = set(df["item"].unique())
        for item, swap in SWAPS.items():
            if item in bought:
                result.append({
                    "item":          item,
                    "swap_to":       swap["swap_to"],
                    "co2_saving_pct": swap["co2_saving_pct"],
                    "reason":        swap["reason"],
                })
    return result


def _summary_message(plastic_pct: float, eco_score: float, co2_kg: float) -> str:
    if plastic_pct > 50:
        return f"High plastic usage ({plastic_pct}%). Try buying loose vegetables and unpackaged grains."
    if eco_score < 5:
        return f"Low eco-score ({eco_score}/10). Consider more vegetables and less packaged meat."
    if co2_kg > 30:
        return f"Carbon footprint: ~{co2_kg} kg CO₂. Reducing chicken/coffee frequency helps most."
    return f"Eco-score {eco_score}/10 — decent choices! Small swaps can make it even better."
