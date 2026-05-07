import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
KAGGLE_DIR = os.path.join(DATA_DIR, "kaggle")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")

# Indian grocery catalog — prices in Indian Rupees (₹)
# avg_price = per-unit price (per kg / per litre / per pack)
# avg_qty   = typical purchase quantity per trip
# plastic_packaging = True if item typically sold in plastic
ITEMS = {
    # --- Vegetables (8) ---
    "Tomato":      {"category": "Vegetables", "shelf_life": 7,   "avg_price": 40,  "avg_qty": 1.0,  "priority": 9,  "usage_rate": 0.92, "brand": "Local",       "plastic_packaging": False},
    "Potato":      {"category": "Vegetables", "shelf_life": 30,  "avg_price": 30,  "avg_qty": 2.0,  "priority": 9,  "usage_rate": 0.95, "brand": "Local",       "plastic_packaging": False},
    "Onion":       {"category": "Vegetables", "shelf_life": 30,  "avg_price": 35,  "avg_qty": 2.0,  "priority": 10, "usage_rate": 0.97, "brand": "Local",       "plastic_packaging": False},
    "Carrot":      {"category": "Vegetables", "shelf_life": 14,  "avg_price": 50,  "avg_qty": 0.5,  "priority": 7,  "usage_rate": 0.80, "brand": "Local",       "plastic_packaging": False},
    "Spinach":     {"category": "Vegetables", "shelf_life": 4,   "avg_price": 30,  "avg_qty": 0.5,  "priority": 8,  "usage_rate": 0.78, "brand": "Local",       "plastic_packaging": False},
    "Cauliflower": {"category": "Vegetables", "shelf_life": 7,   "avg_price": 40,  "avg_qty": 1.0,  "priority": 7,  "usage_rate": 0.82, "brand": "Local",       "plastic_packaging": False},
    "Lady Finger": {"category": "Vegetables", "shelf_life": 5,   "avg_price": 60,  "avg_qty": 0.5,  "priority": 6,  "usage_rate": 0.70, "brand": "Local",       "plastic_packaging": False},
    "Brinjal":     {"category": "Vegetables", "shelf_life": 7,   "avg_price": 40,  "avg_qty": 0.5,  "priority": 6,  "usage_rate": 0.72, "brand": "Local",       "plastic_packaging": False},
    # --- Fruits (5) ---
    "Banana":      {"category": "Fruits",     "shelf_life": 5,   "avg_price": 50,  "avg_qty": 1.0,  "priority": 8,  "usage_rate": 0.90, "brand": "Local",       "plastic_packaging": False},
    "Apple":       {"category": "Fruits",     "shelf_life": 14,  "avg_price": 200, "avg_qty": 0.5,  "priority": 7,  "usage_rate": 0.85, "brand": "Himachal",    "plastic_packaging": False},
    "Mango":       {"category": "Fruits",     "shelf_life": 5,   "avg_price": 120, "avg_qty": 1.0,  "priority": 7,  "usage_rate": 0.88, "brand": "Alphonso",    "plastic_packaging": False},
    "Orange":      {"category": "Fruits",     "shelf_life": 14,  "avg_price": 80,  "avg_qty": 0.5,  "priority": 6,  "usage_rate": 0.80, "brand": "Nagpur",      "plastic_packaging": False},
    "Grapes":      {"category": "Fruits",     "shelf_life": 7,   "avg_price": 100, "avg_qty": 0.5,  "priority": 6,  "usage_rate": 0.78, "brand": "Local",       "plastic_packaging": False},
    # --- Dairy (5) ---
    "Milk":        {"category": "Dairy",      "shelf_life": 3,   "avg_price": 65,  "avg_qty": 2.0,  "priority": 10, "usage_rate": 0.98, "brand": "Amul",        "plastic_packaging": True},
    "Curd":        {"category": "Dairy",      "shelf_life": 5,   "avg_price": 45,  "avg_qty": 0.5,  "priority": 8,  "usage_rate": 0.92, "brand": "Amul",        "plastic_packaging": True},
    "Paneer":      {"category": "Dairy",      "shelf_life": 5,   "avg_price": 90,  "avg_qty": 0.25, "priority": 7,  "usage_rate": 0.85, "brand": "Amul",        "plastic_packaging": True},
    "Butter":      {"category": "Dairy",      "shelf_life": 30,  "avg_price": 55,  "avg_qty": 0.1,  "priority": 7,  "usage_rate": 0.88, "brand": "Amul",        "plastic_packaging": True},
    "Ghee":        {"category": "Dairy",      "shelf_life": 180, "avg_price": 560, "avg_qty": 0.05, "priority": 8,  "usage_rate": 0.90, "brand": "Amul",        "plastic_packaging": True},
    # --- Grains / Staples (5) ---
    "Atta":        {"category": "Grains",     "shelf_life": 90,  "avg_price": 55,  "avg_qty": 5.0,  "priority": 10, "usage_rate": 0.98, "brand": "Aashirvaad",  "plastic_packaging": True},
    "Rice":        {"category": "Grains",     "shelf_life": 365, "avg_price": 65,  "avg_qty": 5.0,  "priority": 10, "usage_rate": 0.98, "brand": "India Gate",  "plastic_packaging": True},
    "Toor Dal":    {"category": "Grains",     "shelf_life": 180, "avg_price": 140, "avg_qty": 1.0,  "priority": 9,  "usage_rate": 0.95, "brand": "Tata",        "plastic_packaging": True},
    "Chana Dal":   {"category": "Grains",     "shelf_life": 180, "avg_price": 120, "avg_qty": 0.5,  "priority": 8,  "usage_rate": 0.88, "brand": "Local",       "plastic_packaging": True},
    "Sugar":       {"category": "Grains",     "shelf_life": 730, "avg_price": 45,  "avg_qty": 1.0,  "priority": 9,  "usage_rate": 0.92, "brand": "Local",       "plastic_packaging": True},
    # --- Protein (4) ---
    "Eggs":        {"category": "Protein",    "shelf_life": 21,  "avg_price": 7,   "avg_qty": 12.0, "priority": 9,  "usage_rate": 0.95, "brand": "Local",       "plastic_packaging": False},
    "Chicken":     {"category": "Protein",    "shelf_life": 2,   "avg_price": 220, "avg_qty": 0.5,  "priority": 8,  "usage_rate": 0.95, "brand": "Local",       "plastic_packaging": True},
    "Fish":        {"category": "Protein",    "shelf_life": 2,   "avg_price": 280, "avg_qty": 0.5,  "priority": 7,  "usage_rate": 0.90, "brand": "Local",       "plastic_packaging": True},
    "Moong Dal":   {"category": "Protein",    "shelf_life": 180, "avg_price": 110, "avg_qty": 0.5,  "priority": 8,  "usage_rate": 0.88, "brand": "Local",       "plastic_packaging": True},
    # --- Beverages / Pantry (3) ---
    "Tea":         {"category": "Beverages",  "shelf_life": 365, "avg_price": 280, "avg_qty": 0.25, "priority": 8,  "usage_rate": 0.92, "brand": "Tata Tea",    "plastic_packaging": True},
    "Coffee":      {"category": "Beverages",  "shelf_life": 180, "avg_price": 420, "avg_qty": 0.1,  "priority": 6,  "usage_rate": 0.82, "brand": "Nescafe",     "plastic_packaging": True},
    "Mustard Oil": {"category": "Beverages",  "shelf_life": 180, "avg_price": 180, "avg_qty": 1.0,  "priority": 8,  "usage_rate": 0.92, "brand": "Fortune",     "plastic_packaging": True},
}

CATEGORIES = list(set(v["category"] for v in ITEMS.values()))

# Indian seasonal demand — price goes UP (scarcity) or DOWN (surplus) by season
SEASONAL_MULTIPLIERS = {
    # Mango: peaks May-Jul (summer harvest); scarce Nov-Mar
    "Mango":      {5: 1.8, 6: 2.0, 7: 1.9, 8: 1.4, 9: 1.0, 10: 0.7, 11: 0.6, 12: 0.5, 1: 0.5, 2: 0.6, 3: 0.7, 4: 1.2},
    # Grapes: peak Jan-Apr (Maharashtra harvest); scarce Jul-Sep
    "Grapes":     {1: 1.6, 2: 1.8, 3: 1.7, 4: 1.5, 5: 1.2, 6: 0.9, 7: 0.7, 8: 0.7, 9: 0.8, 10: 1.0, 11: 1.2, 12: 1.4},
    # Spinach: peak winter (Oct-Feb); very scarce in summer heat
    "Spinach":    {10: 1.5, 11: 1.7, 12: 1.8, 1: 1.8, 2: 1.6, 3: 1.3, 4: 1.0, 5: 0.7, 6: 0.6, 7: 0.6, 8: 0.7, 9: 0.9},
    # Cauliflower: peak winter Oct-Feb
    "Cauliflower":{10: 1.4, 11: 1.6, 12: 1.8, 1: 1.8, 2: 1.5, 3: 1.2, 4: 0.9, 5: 0.7, 6: 0.6, 7: 0.6, 8: 0.7, 9: 0.9},
    # Orange / Nagpur: peak winter Nov-Feb
    "Orange":     {11: 1.5, 12: 1.7, 1: 1.8, 2: 1.6, 3: 1.3, 4: 1.0, 5: 0.8, 6: 0.7, 7: 0.7, 8: 0.8, 9: 1.0, 10: 1.2},
    # Tomato: costly Oct-Dec (winter scarcity in many states)
    "Tomato":     {6: 0.8, 7: 0.9, 8: 1.0, 9: 1.0, 10: 1.4, 11: 1.5, 12: 1.6, 1: 1.4, 2: 1.2, 3: 1.0, 4: 0.9, 5: 0.8},
    # Milk: demand spikes in festival months; steady otherwise
    "Milk":       {10: 1.2, 11: 1.3, 12: 1.1, 3: 1.2, 8: 1.1},
}

# Indian festival months — demand spikes across most categories
FESTIVAL_MONTHS = [1, 3, 8, 10, 11]   # Jan(Makar Sankranti/New Year), Mar(Holi), Aug(Raksha Bandhan), Oct(Dussehra), Nov(Diwali)
MONSOON_MONTHS  = [6, 7, 8, 9]         # June–September
SUMMER_MONTHS   = [4, 5, 6]            # April–June (extreme heat accelerates spoilage)
WINTER_MONTHS   = [11, 12, 1, 2]       # November–February


def get_seasonal_factor(item: str, month: int) -> float:
    if item in SEASONAL_MULTIPLIERS:
        base = SEASONAL_MULTIPLIERS[item].get(month, 1.0)
    else:
        base = 1.0
    festival_boost = 0.25 if month in FESTIVAL_MONTHS else 0.0
    return round(base + festival_boost, 3)


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(KAGGLE_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)


def current_month() -> int:
    return datetime.now().month
