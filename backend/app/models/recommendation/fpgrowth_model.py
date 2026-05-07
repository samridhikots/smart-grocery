"""
Grocery recommendation using FP-Growth (frequent pattern mining).

Trains on market basket transactions where each basket = one user's
purchases on a single day. Mines association rules with high lift/confidence
to recommend items users typically buy together.

Gracefully degrades: if mlxtend is not installed, returns empty rules.
"""
import logging
import pandas as pd
import numpy as np
from typing import Optional

logger = logging.getLogger(__name__)


class GroceryRecommender:
    def __init__(self, min_support: float = 0.005, min_confidence: float = 0.20):
        self.min_support    = min_support
        self.min_confidence = min_confidence
        self.rules: Optional[pd.DataFrame] = None
        self.is_trained = False
        self._mlxtend_available = False

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, purchases: pd.DataFrame) -> dict:
        """
        Build association rules from purchase baskets.

        A basket is defined as all items bought by the same user on the same day.
        """
        try:
            from mlxtend.frequent_patterns import fpgrowth, association_rules
            from mlxtend.preprocessing import TransactionEncoder
            self._mlxtend_available = True
        except ImportError:
            logger.warning("[recommender] mlxtend not installed — FP-Growth skipped. Run: pip install mlxtend")
            self.is_trained = False
            return {"status": "skipped", "reason": "mlxtend not installed"}

        if purchases.empty:
            self.is_trained = False
            return {"status": "skipped", "reason": "empty dataset"}

        purchases = purchases.copy()
        if "purchase_date" in purchases.columns:
            purchases["purchase_date"] = pd.to_datetime(purchases["purchase_date"], errors="coerce")
            purchases["basket_date"] = purchases["purchase_date"].dt.date
        else:
            purchases["basket_date"] = "2023-01-01"

        # Build baskets: list of items per (user_id, date)
        basket_key = ["user_id", "basket_date"] if "user_id" in purchases.columns else ["basket_date"]
        baskets_series = (
            purchases.groupby(basket_key)["item"]
            .apply(lambda items: list(set(items.dropna().astype(str))))
        )
        baskets_list = [b for b in baskets_series if len(b) >= 2]

        if len(baskets_list) < 50:
            self.is_trained = False
            return {"status": "skipped", "reason": f"too few baskets ({len(baskets_list)})"}

        try:
            from mlxtend.preprocessing import TransactionEncoder
            te = TransactionEncoder()
            te_array = te.fit(baskets_list).transform(baskets_list)
            basket_df = pd.DataFrame(te_array, columns=te.columns_)

            freq_items = fpgrowth(basket_df, min_support=self.min_support, use_colnames=True)
            if freq_items.empty:
                self.is_trained = False
                return {"status": "skipped", "reason": "no frequent itemsets at given support threshold"}

            rules = association_rules(freq_items, metric="confidence", min_threshold=self.min_confidence)
            rules["lift"] = rules["lift"].round(3)
            rules = rules.sort_values("lift", ascending=False)
            self.rules = rules
            self.is_trained = True

            return {
                "status": "trained",
                "n_baskets": len(baskets_list),
                "n_frequent_itemsets": len(freq_items),
                "n_rules": len(rules),
                "top_rule": self._rule_summary(rules.iloc[0]) if not rules.empty else None,
            }
        except Exception as e:
            logger.error(f"[recommender] FP-Growth failed: {e}")
            self.is_trained = False
            return {"status": "error", "reason": str(e)}

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def recommend(self, current_basket: list[str], top_n: int = 5) -> list[dict]:
        """
        Given items currently in the user's basket, return top_n items
        they are likely to also need.
        """
        if not self.is_trained or self.rules is None or self.rules.empty:
            return self._fallback_recommendations(current_basket, top_n)

        basket_set = frozenset(current_basket)
        # Find rules whose antecedents are a subset of current basket
        matching = self.rules[
            self.rules["antecedents"].apply(lambda a: bool(a) and a.issubset(basket_set))
        ]
        if matching.empty:
            return self._fallback_recommendations(current_basket, top_n)

        # Explode consequents, remove items already in basket
        rows = []
        for _, rule in matching.iterrows():
            for item in rule["consequents"]:
                if item not in basket_set:
                    rows.append({
                        "item": item,
                        "confidence": round(float(rule["confidence"]), 2),
                        "lift": round(float(rule["lift"]), 2),
                        "support": round(float(rule["support"]), 4),
                    })

        if not rows:
            return self._fallback_recommendations(current_basket, top_n)

        # De-duplicate: keep highest lift per item
        seen: dict[str, dict] = {}
        for row in rows:
            if row["item"] not in seen or row["lift"] > seen[row["item"]]["lift"]:
                seen[row["item"]] = row

        sorted_recs = sorted(seen.values(), key=lambda x: x["lift"], reverse=True)
        return sorted_recs[:top_n]

    def top_rules(self, n: int = 10) -> list[dict]:
        """Return top n rules by lift for display in the frontend."""
        if not self.is_trained or self.rules is None:
            return []
        top = self.rules.head(n)
        result = []
        for _, row in top.iterrows():
            result.append({
                "antecedents": list(row["antecedents"]),
                "consequents": list(row["consequents"]),
                "support":     round(float(row["support"]), 4),
                "confidence":  round(float(row["confidence"]), 2),
                "lift":        round(float(row["lift"]), 2),
            })
        return result

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _fallback_recommendations(self, basket: list[str], n: int) -> list[dict]:
        """
        Co-purchase heuristic when FP-Growth hasn't trained or has no matching rules.
        Based on known Indian grocery co-purchase patterns.
        """
        KNOWN_PAIRS = {
            "Atta":      ["Toor Dal", "Rice", "Sugar", "Mustard Oil"],
            "Rice":      ["Toor Dal", "Moong Dal", "Onion", "Tomato"],
            "Milk":      ["Tea", "Sugar", "Curd", "Butter"],
            "Toor Dal":  ["Rice", "Tomato", "Onion", "Mustard Oil"],
            "Tomato":    ["Onion", "Potato", "Atta", "Toor Dal"],
            "Onion":     ["Tomato", "Potato", "Mustard Oil", "Atta"],
            "Potato":    ["Onion", "Tomato", "Mustard Oil"],
            "Chicken":   ["Onion", "Tomato", "Mustard Oil", "Rice"],
            "Eggs":      ["Milk", "Butter", "Bread"],
            "Tea":       ["Sugar", "Milk", "Coffee"],
        }
        suggestions: dict[str, float] = {}
        for item in basket:
            for rec in KNOWN_PAIRS.get(item, []):
                if rec not in basket:
                    suggestions[rec] = suggestions.get(rec, 0) + 1

        return [
            {"item": k, "confidence": round(min(0.99, v * 0.25), 2), "lift": 1.5, "support": 0.01}
            for k, v in sorted(suggestions.items(), key=lambda x: -x[1])
        ][:n]

    @staticmethod
    def _rule_summary(row) -> dict:
        return {
            "if":         list(row["antecedents"]),
            "then":       list(row["consequents"]),
            "confidence": round(float(row["confidence"]), 2),
            "lift":       round(float(row["lift"]), 2),
        }
