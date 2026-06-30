"""
In-memory BigBasket product catalog with fast prefix/contains search.
Loaded lazily on first call; ~38k rows filtered to ~15k food products.
"""
import csv
import os
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

_KAGGLE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data", "kaggle",
)
_CSV_PATH = os.path.join(_KAGGLE_DIR, "bigbasket_products.csv")

# Sub-categories that map to Fruits (rest of "Fruits & Vegetables" → Vegetables)
_FRUIT_SUBS = {"Fresh Fruits", "Exotic Fruits & Veggies"}

# BigBasket category → our 6 categories (None = exclude)
_CAT_MAP: Dict[str, Optional[str]] = {
    "Fruits & Vegetables":    None,          # resolved per-row via sub_category
    "Foodgrains, Oil & Masala": "Grains",
    "Beverages":              "Beverages",
    "Dairy, Bread & Eggs":   "Dairy",
    "Bakery, Cakes & Dairy": "Dairy",
    "Eggs, Meat & Fish":     "Protein",
    "Snacks & Branded Foods": "Grains",
    "Gourmet & World Food":  "Grains",
    # excluded: Baby Care, Beauty & Hygiene, Cleaning & Household, Kitchen Garden & Pets
}


def _map_category(bb_cat: str, bb_sub: str) -> Optional[str]:
    if bb_cat == "Fruits & Vegetables":
        return "Fruits" if bb_sub in _FRUIT_SUBS else "Vegetables"
    return _CAT_MAP.get(bb_cat)


class BigBasketCatalog:
    def __init__(self) -> None:
        self._products: List[Dict] = []
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        self._loaded = True

        if not os.path.exists(_CSV_PATH):
            logger.warning("[bigbasket] CSV not found: %s", _CSV_PATH)
            return

        products: List[Dict] = []
        try:
            with open(_CSV_PATH, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    cat = _map_category(
                        row.get("category", "").strip(),
                        row.get("sub_category", "").strip(),
                    )
                    if cat is None:
                        continue
                    name = row.get("product", "").strip()
                    if not name:
                        continue
                    try:
                        sale   = float(row.get("sale_price") or 0)
                        market = float(row.get("market_price") or 0)
                    except ValueError:
                        sale, market = 0.0, 0.0
                    products.append({
                        "product":      name,
                        "brand":        row.get("brand", "").strip(),
                        "category":     cat,
                        "sub_category": row.get("sub_category", "").strip(),
                        "sale_price":   round(sale, 2),
                        "market_price": round(market, 2),
                        "type":         row.get("type", "").strip(),
                        "rating":       row.get("rating", "").strip(),
                        "_lower":       name.lower(),
                    })
        except Exception:
            logger.exception("[bigbasket] Failed to load CSV")
            return

        self._products = products
        logger.info("[bigbasket] Loaded %d food products from catalog", len(products))

    def search(self, query: str, limit: int = 20) -> List[Dict]:
        self._load()
        q = query.strip().lower()
        if len(q) < 2 or not self._products:
            return []

        q_tokens = q.split()
        exact: List[Dict] = []
        prefix: List[Dict] = []
        contains: List[Dict] = []

        for p in self._products:
            nl = p["_lower"]
            if nl == q:
                exact.append(p)
            elif nl.startswith(q):
                prefix.append(p)
            elif q in nl:
                contains.append(p)
            elif all(t in nl for t in q_tokens):
                contains.append(p)

        seen: set = set()
        out: List[Dict] = []
        for p in exact + prefix + contains:
            key = p["product"]
            if key not in seen:
                seen.add(key)
                out.append({k: v for k, v in p.items() if k != "_lower"})
            if len(out) >= limit:
                break

        return out


# Module-level singleton — shared across all requests
catalog = BigBasketCatalog()
