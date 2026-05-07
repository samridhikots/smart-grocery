"""
Product name normalization for Kaggle dataset integration.

Maps raw product names from any of the 7 Kaggle datasets to the canonical
`normalized_product` key used throughout the system. BigBasket is the
source-of-truth catalog; all other datasets are mapped to it.
"""
import re
from typing import Optional

# Explicit alias map for common Indian grocery naming variants
INDIAN_GROCERY_ALIASES: dict[str, str] = {
    # Milk variants
    "whole milk": "milk",
    "full cream milk": "milk",
    "toned milk": "milk",
    "double toned milk": "milk",
    "amul milk": "milk",
    "mother dairy milk": "milk",
    # Wheat flour / Atta
    "atta flour": "atta",
    "wheat flour": "atta",
    "chakki fresh atta": "atta",
    "whole wheat flour": "atta",
    "maida": "refined flour",
    "refined flour": "refined flour",
    # Rice
    "basmati rice": "rice",
    "basmati": "rice",
    "sona masoori rice": "rice",
    "ponni rice": "rice",
    "brown rice": "rice",
    # Dal / Lentils
    "toor dal": "toor dal",
    "arhar dal": "toor dal",
    "pigeon peas": "toor dal",
    "chana dal": "chana dal",
    "bengal gram dal": "chana dal",
    "moong dal": "moong dal",
    "green gram dal": "moong dal",
    "yellow moong dal": "moong dal",
    "urad dal": "urad dal",
    "black gram dal": "urad dal",
    "masoor dal": "masoor dal",
    "red lentils": "masoor dal",
    "lentils": "toor dal",
    # Vegetables
    "tomatoes": "tomato",
    "onions": "onion",
    "potatoes": "potato",
    "carrots": "carrot",
    "lady finger": "lady finger",
    "okra": "lady finger",
    "bhindi": "lady finger",
    "baingan": "brinjal",
    "eggplant": "brinjal",
    "gobhi": "cauliflower",
    "palak": "spinach",
    # Fruits
    "bananas": "banana",
    "apples": "apple",
    "mangoes": "mango",
    "alphonso mango": "mango",
    "kesar mango": "mango",
    "nagpur orange": "orange",
    "oranges": "orange",
    # Dairy
    "dahi": "curd",
    "yogurt": "curd",
    "yoghurt": "curd",
    "white butter": "butter",
    "salted butter": "butter",
    "paneer": "paneer",
    "cottage cheese": "paneer",
    "desi ghee": "ghee",
    "pure ghee": "ghee",
    # Oils
    "mustard oil": "mustard oil",
    "sarson ka tel": "mustard oil",
    "sunflower oil": "mustard oil",   # map to same category for simplicity
    "refined sunflower oil": "mustard oil",
    "cooking oil": "mustard oil",
    # Protein
    "chicken breast": "chicken",
    "broiler chicken": "chicken",
    "rohu fish": "fish",
    "catla fish": "fish",
    "pomfret": "fish",
    "eggs": "eggs",
    "hen eggs": "eggs",
    # Beverages
    "chai": "tea",
    "green tea": "tea",
    "black tea": "tea",
    "tata tea": "tea",
    "red label": "tea",
    "nescafe": "coffee",
    "bru coffee": "coffee",
    # Sugar / spices
    "white sugar": "sugar",
    "refined sugar": "sugar",
    "crystal sugar": "sugar",
}

# Categories expected in the canonical system
CANONICAL_CATEGORIES = {
    "Vegetables", "Fruits", "Dairy", "Grains", "Protein", "Beverages",
}


def _clean_raw_name(raw: str) -> str:
    """Strip units, pack sizes, and brand suffixes before matching."""
    s = raw.lower().strip()
    # Remove quantity patterns: 500ml, 1kg, 250g, 5L, etc.
    s = re.sub(r"\b\d+(\.\d+)?\s*(ml|g|kg|gm|l|ltr|litre|litres|liter|pack|pcs|pc|nos)\b", "", s)
    # Remove parenthetical notes: (loose), (fresh), (organic)
    s = re.sub(r"\([^)]*\)", "", s)
    # Remove common marketing words
    s = re.sub(r"\b(fresh|organic|natural|pure|premium|best|special|combo|offer|pack of \d+)\b", "", s)
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_product_name(raw_name: str, catalog: Optional[list[str]] = None) -> str:
    """
    Normalize a raw product name to the canonical key used in ITEMS.

    Strategy:
      1. Direct alias lookup (covers ~85% of cases)
      2. Fuzzy match against provided catalog (requires rapidfuzz, optional)
      3. Fallback: return cleaned raw name

    Args:
        raw_name:  Raw product name from any dataset
        catalog:   Optional list of canonical names to fuzzy-match against
    """
    cleaned = _clean_raw_name(raw_name)

    # 1. Direct alias
    if cleaned in INDIAN_GROCERY_ALIASES:
        return INDIAN_GROCERY_ALIASES[cleaned]

    # 2. Partial alias scan (catches "fresh tomatoes" → "tomato")
    for alias, canonical in INDIAN_GROCERY_ALIASES.items():
        if alias in cleaned:
            return canonical

    # 3. Fuzzy match if catalog provided and rapidfuzz available
    if catalog:
        try:
            from rapidfuzz import process, fuzz
            match, score, _ = process.extractOne(cleaned, catalog, scorer=fuzz.token_sort_ratio)
            if score >= 72:
                return match
        except ImportError:
            pass

    return cleaned


def normalize_category(raw_category: str) -> str:
    """Map raw category names to one of the 6 canonical categories."""
    mapping = {
        "vegetable": "Vegetables",
        "vegetables": "Vegetables",
        "sabzi": "Vegetables",
        "fruit": "Fruits",
        "fruits": "Fruits",
        "fresh fruits": "Fruits",
        "dairy": "Dairy",
        "milk products": "Dairy",
        "dairy products": "Dairy",
        "grain": "Grains",
        "grains": "Grains",
        "staples": "Grains",
        "cereals": "Grains",
        "pulses": "Grains",
        "dal": "Grains",
        "protein": "Protein",
        "meat": "Protein",
        "poultry": "Protein",
        "eggs": "Protein",
        "seafood": "Protein",
        "beverage": "Beverages",
        "beverages": "Beverages",
        "drinks": "Beverages",
        "oil": "Beverages",
        "cooking oil": "Beverages",
    }
    return mapping.get(raw_category.lower().strip(), "Grains")
