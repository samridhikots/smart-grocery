"""
Enhanced India-specific synthetic dataset generator.

Used as fallback when Kaggle datasets are not present in data/kaggle/.
Generates realistic Indian household purchase patterns including:
  - Festival demand spikes (Diwali, Holi, Raksha Bandhan)
  - Monsoon-driven perishable waste increase
  - Summer heat effect on dairy/vegetable shelf life
  - Indian household buying behaviour (frequent small purchases)
  - Brand-level price variation (Amul, Aashirvaad, Tata, etc.)
  - Mandi price index for price_variation_index feature
"""
import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random

from app.utils.helpers import (
    ITEMS, DATA_DIR, ensure_data_dir,
    get_seasonal_factor, FESTIVAL_MONTHS,
    MONSOON_MONTHS, SUMMER_MONTHS,
)

np.random.seed(42)
random.seed(42)

N_USERS       = 250
START_DATE    = datetime(2022, 1, 1)
END_DATE      = datetime(2025, 1, 1)   # 3-year span

PURCHASE_CAP  = 200_000
WASTE_ROWS    = 120_000

# Indian household size distribution (skewed towards 3-5 members)
HH_SIZE_WEIGHTS = {1: 0.08, 2: 0.15, 3: 0.30, 4: 0.28, 5: 0.12, 6: 0.07}

# Purchase frequency per month (Indian buying behaviour: frequent small trips)
# Higher for perishables (daily/every-2-days), lower for staples (monthly)
FREQ_BY_SHELF = {
    (1, 5):    (8, 15),   # very perishable: 8–15 times/month (every 2-4 days)
    (6, 14):   (4, 8),    # perishable: 4–8 times/month (every 4-7 days)
    (15, 90):  (1, 3),    # semi-perishable: 1–3 times/month
    (91, 999): (0.5, 1.5),# non-perishable: every 2-6 weeks
}

# Price variation by brand (multiplier over avg_price)
BRAND_PRICE_FACTOR = {
    "Amul": 1.0, "Aashirvaad": 1.05, "India Gate": 1.10, "Tata": 1.02,
    "Tata Tea": 1.0, "Nescafe": 1.15, "Fortune": 0.98, "Alphonso": 1.20,
    "Nagpur": 1.0, "Himachal": 1.08, "Local": 0.92,
}


def _random_date(start: datetime, end: datetime) -> datetime:
    delta = end - start
    return start + timedelta(days=random.randint(0, delta.days))


def _household_size() -> int:
    sizes, weights = zip(*HH_SIZE_WEIGHTS.items())
    return int(random.choices(sizes, weights=weights)[0])


def _purchase_frequency(shelf_life: int) -> float:
    for (lo, hi), (flo, fhi) in FREQ_BY_SHELF.items():
        if lo <= shelf_life <= hi:
            return np.random.uniform(flo, fhi)
    return np.random.uniform(1, 3)


def _monsoon_spoilage_boost(month: int, shelf_life: int) -> float:
    """Monsoon months increase spoilage probability for perishables."""
    if month in MONSOON_MONTHS and shelf_life <= 14:
        return np.random.uniform(0.15, 0.35)
    if month in SUMMER_MONTHS and shelf_life <= 7:
        return np.random.uniform(0.10, 0.25)
    return 0.0


def _mandi_price_index(item: str, month: int, base_price: float) -> float:
    """
    Simulate mandi-level wholesale price variation.
    Mandi price is typically 15–30% below retail.
    Increases in off-season (scarcity) and drops in peak season.
    """
    seasonal = get_seasonal_factor(item, month)
    # Mandi price inversely tracks retail seasonal demand (high demand → high retail, mandi stable)
    mandi_factor = 0.70 + 0.10 * (1.0 / max(seasonal, 0.5))
    noise = np.random.uniform(0.92, 1.08)
    return round(base_price * mandi_factor * noise, 2)


# ---------------------------------------------------------------------------
# Dataset 1: Grocery purchases — demand prediction
# ---------------------------------------------------------------------------

def generate_grocery_purchases() -> pd.DataFrame:
    records = []
    item_list = list(ITEMS.keys())

    for user_id in range(1, N_USERS + 1):
        household_size = _household_size()
        # Indian households buy 15–25 distinct items regularly
        n_items = random.randint(15, min(25, len(item_list)))
        bought_items = random.sample(item_list, n_items)

        for item in bought_items:
            props = ITEMS[item]
            freq_per_month = _purchase_frequency(props["shelf_life"])
            current_date = START_DATE + timedelta(days=random.randint(0, 20))
            brand_factor = BRAND_PRICE_FACTOR.get(props["brand"], 1.0)

            while current_date < END_DATE:
                # Interval between purchases in days
                days_between = max(1, int(30 / freq_per_month * np.random.uniform(0.7, 1.4)))
                month = current_date.month
                seasonal = get_seasonal_factor(item, month)

                # Festival month boost: +20–40% quantity for staples
                festival_boost = 1.0
                if month in FESTIVAL_MONTHS:
                    if props["category"] in ("Dairy", "Grains", "Beverages"):
                        festival_boost = np.random.uniform(1.2, 1.4)
                    else:
                        festival_boost = np.random.uniform(1.0, 1.2)

                base_qty = props["avg_qty"] * (household_size / 3.5) * seasonal * festival_boost
                qty = max(0.1, round(base_qty * np.random.uniform(0.75, 1.30), 2))
                # Clip to realistic Indian purchase sizes (e.g. Atta max 25 kg, Milk max 6 L)
                qty = min(qty, props["avg_qty"] * 5)

                price = round(props["avg_price"] * brand_factor * np.random.uniform(0.90, 1.10), 2)
                mandi_price = _mandi_price_index(item, month, props["avg_price"])

                records.append({
                    "user_id":         user_id,
                    "item":            item,
                    "category":        props["category"],
                    "quantity":        qty,
                    "price":           price,
                    "mandi_price":     mandi_price,
                    "purchase_date":   current_date.strftime("%Y-%m-%d"),
                    "household_size":  household_size,
                    "seasonal_factor": round(seasonal, 3),
                    "brand":           props["brand"],
                    "is_festival_month": int(month in FESTIVAL_MONTHS),
                    "is_monsoon_month":  int(month in MONSOON_MONTHS),
                    "is_summer_month":   int(month in SUMMER_MONTHS),
                })
                current_date += timedelta(days=days_between)

        if len(records) >= PURCHASE_CAP:
            break

    df = pd.DataFrame(records)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    return df.head(PURCHASE_CAP)


# ---------------------------------------------------------------------------
# Dataset 2: Food waste — waste prediction
# ---------------------------------------------------------------------------

def generate_food_waste() -> pd.DataFrame:
    records = []
    item_list = list(ITEMS.keys())
    rng = np.random.default_rng(42)

    items_arr   = rng.choice(item_list, size=WASTE_ROWS)
    months_arr  = rng.integers(1, 13, size=WASTE_ROWS)

    for i in range(WASTE_ROWS):
        item   = items_arr[i]
        month  = int(months_arr[i])
        props  = ITEMS[item]
        shelf_life = props["shelf_life"]

        expiry_days     = max(1, int(shelf_life * rng.uniform(0.25, 1.0)))
        consumption_rate = round(float(rng.beta(5, 2)) * props["usage_rate"], 3)
        expiry_risk      = round(1.0 - (expiry_days / shelf_life), 3)

        spoilage_boost = _monsoon_spoilage_boost(month, shelf_life)
        waste_prob = max(0.0, min(1.0,
            0.55 * expiry_risk
            + 0.35 * (1.0 - consumption_rate)
            + spoilage_boost
        ))
        wasted = int(rng.random() < waste_prob)

        quantity = round(props["avg_qty"] * rng.uniform(0.4, 2.0), 2)
        price    = round(props["avg_price"] * rng.uniform(0.88, 1.12), 2)
        mandi_p  = _mandi_price_index(item, month, props["avg_price"])

        records.append({
            "item":              item,
            "category":          props["category"],
            "expiry_days":       expiry_days,
            "shelf_life":        shelf_life,
            "consumption_rate":  consumption_rate,
            "expiry_risk":       expiry_risk,
            "quantity":          quantity,
            "price":             price,
            "mandi_price":       mandi_p,
            "wasted":            wasted,
            "month":             month,
            "is_monsoon_month":  int(month in MONSOON_MONTHS),
            "is_summer_month":   int(month in SUMMER_MONTHS),
            "spoilage_boost":    round(spoilage_boost, 3),
        })

    return pd.DataFrame(records)


# ---------------------------------------------------------------------------
# Dataset 3: Retail transaction patterns
# ---------------------------------------------------------------------------

def generate_retail_transactions() -> pd.DataFrame:
    records = []
    item_list = list(ITEMS.keys())

    for user_id in range(1, N_USERS + 1):
        n_items = random.randint(12, 22)
        bought  = random.sample(item_list, n_items)
        for item in bought:
            props = ITEMS[item]
            freq  = round(_purchase_frequency(props["shelf_life"]) * np.random.uniform(0.8, 1.2), 2)
            time_between = max(1, int(30 / max(freq, 0.5) * np.random.uniform(0.7, 1.3)))
            avg_spend = props["avg_price"] * props["avg_qty"] * np.random.uniform(0.88, 1.12)

            records.append({
                "user_id":             user_id,
                "item":                item,
                "category":            props["category"],
                "frequency":           freq,
                "time_between_purchases": time_between,
                "avg_spend_per_visit": round(avg_spend, 2),
                "total_transactions":  random.randint(10, 120),
                "brand":               props["brand"],
            })

    return pd.DataFrame(records)


# ---------------------------------------------------------------------------
# Dataset 4: Product metadata
# ---------------------------------------------------------------------------

def generate_product_metadata() -> pd.DataFrame:
    rng = np.random.default_rng(42)
    records = []
    for item, props in ITEMS.items():
        nutrition = {
            "Vegetables": rng.uniform(7, 10),
            "Fruits":     rng.uniform(6, 9),
            "Dairy":      rng.uniform(5, 8),
            "Grains":     rng.uniform(4, 8),
            "Protein":    rng.uniform(7, 10),
            "Beverages":  rng.uniform(2, 6),
        }.get(props["category"], 5.0)

        records.append({
            "item":            item,
            "category":        props["category"],
            "shelf_life":      props["shelf_life"],
            "priority_score":  props["priority"],
            "avg_price":       props["avg_price"],
            "nutrition_score": round(float(nutrition), 2),
            "is_perishable":   int(props["shelf_life"] <= 14),
            "brand":           props["brand"],
            "plastic_packaging": int(props.get("plastic_packaging", False)),
        })

    return pd.DataFrame(records)


# ---------------------------------------------------------------------------
# Dataset 5: Household consumption
# ---------------------------------------------------------------------------

def generate_household_consumption() -> pd.DataFrame:
    records = []
    item_list = list(ITEMS.keys())

    for household_size in range(1, 7):
        for item in item_list:
            for month in range(1, 13):
                seasonal = get_seasonal_factor(item, month)
                base_rate = ITEMS[item]["avg_qty"] * household_size / 4.0
                usage_rate = round(base_rate * seasonal * np.random.uniform(0.85, 1.15), 3)
                records.append({
                    "household_size":   household_size,
                    "item":             item,
                    "category":         ITEMS[item]["category"],
                    "item_usage_rate":  usage_rate,
                    "seasonal_factor":  round(seasonal, 3),
                    "month":            month,
                    "is_festival_month": int(month in FESTIVAL_MONTHS),
                    "is_monsoon_month":  int(month in MONSOON_MONTHS),
                    "is_summer_month":   int(month in SUMMER_MONTHS),
                })

    return pd.DataFrame(records)


# ---------------------------------------------------------------------------
# Dataset 6: Seasonal data
# ---------------------------------------------------------------------------

def generate_seasonal_data() -> pd.DataFrame:
    # India-specific weather patterns (approx avg temperature effect)
    temp_c = {1: 15, 2: 18, 3: 24, 4: 32, 5: 38, 6: 36,
              7: 32, 8: 31, 9: 30, 10: 28, 11: 22, 12: 16}
    month_names = {
        1:"January", 2:"February", 3:"March", 4:"April", 5:"May", 6:"June",
        7:"July", 8:"August", 9:"September", 10:"October", 11:"November", 12:"December",
    }
    records = []
    for month in range(1, 13):
        fest    = int(month in FESTIVAL_MONTHS)
        monsoon = int(month in MONSOON_MONTHS)
        summer  = int(month in SUMMER_MONTHS)
        temp    = temp_c[month]
        # Demand multiplier: festivals drive up demand; heat drives perishable spoilage
        demand_mult = 1.0 + (0.30 * fest) + (0.05 * monsoon) + (0.05 * summer)
        records.append({
            "month":              month,
            "month_name":         month_names[month],
            "is_festival":        fest,
            "is_monsoon":         monsoon,
            "is_summer":          summer,
            "avg_temperature_c":  temp,
            "demand_multiplier":  round(demand_mult, 3),
        })
    return pd.DataFrame(records)


# ---------------------------------------------------------------------------
# Main entry
# ---------------------------------------------------------------------------

def _catalog_changed() -> bool:
    """Returns True if existing CSV uses different items than current ITEMS dict."""
    path = os.path.join(DATA_DIR, "grocery_purchases.csv")
    if not os.path.exists(path):
        return False
    try:
        existing_items = set(pd.read_csv(path, usecols=["item"])["item"].unique())
        return not existing_items.issubset(set(ITEMS.keys()))
    except Exception:
        return True


def generate_all_datasets(force: bool = False) -> None:
    """Generate and save all 6 datasets. Auto-regenerates if item catalog changed."""
    ensure_data_dir()

    if _catalog_changed():
        print("[datasets] Item catalog updated — forcing dataset regeneration...")
        force = True

    files = {
        "grocery_purchases.csv":   generate_grocery_purchases,
        "food_waste.csv":          generate_food_waste,
        "retail_transactions.csv": generate_retail_transactions,
        "product_metadata.csv":    generate_product_metadata,
        "household_consumption.csv": generate_household_consumption,
        "seasonal_data.csv":       generate_seasonal_data,
    }

    for filename, fn in files.items():
        path = os.path.join(DATA_DIR, filename)
        if not os.path.exists(path) or force:
            df = fn()
            df.to_csv(path, index=False)
            print(f"[datasets] Generated {filename}: {len(df):,} rows")
        else:
            print(f"[datasets] Found {filename}, skipping")
