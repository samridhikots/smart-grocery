"""
Data pipeline entry point.

Priority:
  1. If all 7 Kaggle CSVs are present in data/kaggle/ → ingest + normalize
  2. Otherwise → use enhanced India-specific synthetic generator

Either way, the output is the same set of 6 CSVs consumed by loader.py.
This design means every downstream component (feature engineering, models)
is unchanged; only the data source swaps.

Kaggle dataset filenames expected in data/kaggle/:
  - bigbasket_products.csv          (master product catalog)
  - blinkit.csv                     (price + availability)
  - groceries.csv                   (market basket transactions)
  - grocery_inventory_sales.csv     (stock + sales + expiry)
  - smart_waste_inventory.csv       (spoilage probability + waste labels)
  - fruit_veg_prices.csv            (Indian mandi prices)
  - perishable_goods.csv            (shelf life + storage)
"""
import os
import logging
import pandas as pd
import numpy as np

from app.utils.helpers import (
    ITEMS, DATA_DIR, KAGGLE_DIR, PROCESSED_DIR,
    FESTIVAL_MONTHS, MONSOON_MONTHS, SUMMER_MONTHS, ensure_data_dir,
)
from app.data_pipeline.normalizer import normalize_product_name, normalize_category

logger = logging.getLogger(__name__)

REQUIRED_KAGGLE_FILES = [
    "bigbasket_products.csv",
    "blinkit.csv",
    "groceries.csv",
    "grocery_inventory_sales.csv",
    "smart_waste_inventory.csv",
    "fruit_veg_prices.csv",
    "perishable_goods.csv",
]


def kaggle_data_available() -> bool:
    return all(
        os.path.exists(os.path.join(KAGGLE_DIR, f))
        for f in REQUIRED_KAGGLE_FILES
    )


# ---------------------------------------------------------------------------
# Kaggle ingestion pipeline
# ---------------------------------------------------------------------------

def _load_bigbasket(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    # Expected columns: product, category, sub_category, brand, sale_price, market_price
    col_map = {c.lower().strip(): c for c in df.columns}
    rename = {}
    for variant, target in [("product", "original_name"), ("sale_price", "avg_price_bigbasket"),
                              ("category", "bb_category"), ("brand", "brand")]:
        if variant in col_map:
            rename[col_map[variant]] = target
    df = df.rename(columns=rename)
    canonical = list(ITEMS.keys())
    df["normalized_product"] = df["original_name"].apply(
        lambda x: normalize_product_name(str(x), canonical)
    )
    return df


def _enrich_blinkit(master: pd.DataFrame, path: str) -> pd.DataFrame:
    try:
        blinkit = pd.read_csv(path)
        canonical = list(ITEMS.keys())
        name_col = next((c for c in blinkit.columns if "product" in c.lower() or "name" in c.lower()), None)
        price_col = next((c for c in blinkit.columns if "price" in c.lower()), None)
        if name_col and price_col:
            blinkit["normalized_product"] = blinkit[name_col].apply(
                lambda x: normalize_product_name(str(x), canonical)
            )
            prices = blinkit.groupby("normalized_product")[price_col].mean().reset_index()
            prices.columns = ["normalized_product", "avg_price_blinkit"]
            master = master.merge(prices, on="normalized_product", how="left")
    except Exception as e:
        logger.warning(f"Blinkit enrichment skipped: {e}")
        master["avg_price_blinkit"] = np.nan
    return master


def _enrich_waste(master: pd.DataFrame, path: str) -> pd.DataFrame:
    try:
        waste = pd.read_csv(path)
        canonical = list(ITEMS.keys())
        name_col = next((c for c in waste.columns if "item" in c.lower() or "product" in c.lower() or "name" in c.lower()), None)
        shelf_col = next((c for c in waste.columns if "shelf" in c.lower()), None)
        spoil_col = next((c for c in waste.columns if "spoil" in c.lower() or "waste" in c.lower() or "prob" in c.lower()), None)
        if name_col:
            waste["normalized_product"] = waste[name_col].apply(
                lambda x: normalize_product_name(str(x), canonical)
            )
            agg = {}
            if shelf_col:
                agg["shelf_life_days"] = (shelf_col, "mean")
            if spoil_col:
                agg["spoilage_probability"] = (spoil_col, "mean")
            if agg:
                result = waste.groupby("normalized_product").agg(**agg).reset_index()
                master = master.merge(result, on="normalized_product", how="left")
    except Exception as e:
        logger.warning(f"Waste enrichment skipped: {e}")
    if "shelf_life_days" not in master.columns:
        master["shelf_life_days"] = np.nan
    if "spoilage_probability" not in master.columns:
        master["spoilage_probability"] = np.nan
    return master


def _enrich_mandi(master: pd.DataFrame, path: str) -> pd.DataFrame:
    try:
        mandi = pd.read_csv(path)
        canonical = list(ITEMS.keys())
        name_col = next((c for c in mandi.columns if "commodity" in c.lower() or "item" in c.lower() or "product" in c.lower()), None)
        price_col = next((c for c in mandi.columns if "modal" in c.lower() or "price" in c.lower()), None)
        if name_col and price_col:
            mandi["normalized_product"] = mandi[name_col].apply(
                lambda x: normalize_product_name(str(x), canonical)
            )
            mandi_agg = mandi.groupby("normalized_product")[price_col].mean().reset_index()
            mandi_agg.columns = ["normalized_product", "mandi_price"]
            master = master.merge(mandi_agg, on="normalized_product", how="left")
    except Exception as e:
        logger.warning(f"Mandi price enrichment skipped: {e}")
    if "mandi_price" not in master.columns:
        master["mandi_price"] = np.nan
    return master


def _build_master_catalog() -> pd.DataFrame:
    bb_path = os.path.join(KAGGLE_DIR, "bigbasket_products.csv")
    master = _load_bigbasket(bb_path)
    master = _enrich_blinkit(master, os.path.join(KAGGLE_DIR, "blinkit.csv"))
    master = _enrich_waste(master, os.path.join(KAGGLE_DIR, "smart_waste_inventory.csv"))
    master = _enrich_waste(master, os.path.join(KAGGLE_DIR, "perishable_goods.csv"))
    master = _enrich_mandi(master, os.path.join(KAGGLE_DIR, "fruit_veg_prices.csv"))

    # Fill shelf_life from ITEMS where dataset doesn't have it
    def _fill_shelf(row):
        if pd.notna(row.get("shelf_life_days")):
            return row["shelf_life_days"]
        return ITEMS.get(row["normalized_product"], {}).get("shelf_life", 14)

    master["shelf_life_days"] = master.apply(_fill_shelf, axis=1)
    master["spoilage_probability"] = master["spoilage_probability"].fillna(0.3)
    master["is_perishable"] = (master["shelf_life_days"] <= 14).astype(int)

    return master


def _build_transactions_from_kaggle(master: pd.DataFrame) -> pd.DataFrame:
    """Build unified transaction table from Kaggle groceries + inventory datasets."""
    canonical = list(ITEMS.keys())

    # --- Groceries market basket dataset ---
    groceries_path = os.path.join(KAGGLE_DIR, "groceries.csv")
    groceries = pd.read_csv(groceries_path)
    # Expected: Member_number, Date, itemDescription
    member_col = next((c for c in groceries.columns if "member" in c.lower() or "user" in c.lower()), groceries.columns[0])
    date_col   = next((c for c in groceries.columns if "date" in c.lower()), None)
    item_col   = next((c for c in groceries.columns if "item" in c.lower() or "product" in c.lower() or "description" in c.lower()), groceries.columns[-1])

    groceries = groceries.rename(columns={member_col: "user_id", item_col: "item_raw"})
    groceries["normalized_product"] = groceries["item_raw"].apply(
        lambda x: normalize_product_name(str(x), canonical)
    )

    if date_col:
        groceries["purchase_date"] = pd.to_datetime(groceries[date_col], dayfirst=True, errors="coerce")
    else:
        # No date — generate synthetic dates spanning 2 years
        rng = np.random.default_rng(42)
        n = len(groceries)
        days_offset = rng.integers(0, 730, size=n)
        base = pd.Timestamp("2023-01-01")
        groceries["purchase_date"] = [base + pd.Timedelta(days=int(d)) for d in days_offset]

    groceries["purchase_date"] = groceries["purchase_date"].fillna(pd.Timestamp("2023-06-01"))
    groceries["month"] = groceries["purchase_date"].dt.month
    groceries["year"]  = groceries["purchase_date"].dt.year
    groceries["is_festival_month"] = groceries["month"].isin(FESTIVAL_MONTHS).astype(int)
    groceries["is_monsoon_month"]  = groceries["month"].isin(MONSOON_MONTHS).astype(int)
    groceries["is_summer_month"]   = groceries["month"].isin(SUMMER_MONTHS).astype(int)
    groceries["quantity"] = 1.0   # market basket → binary presence
    groceries["household_size"] = 3

    # --- Inventory dataset for quantity + price enrichment ---
    try:
        inv = pd.read_csv(os.path.join(KAGGLE_DIR, "grocery_inventory_sales.csv"))
        name_col  = next((c for c in inv.columns if "product" in c.lower() or "item" in c.lower() or "name" in c.lower()), None)
        qty_col   = next((c for c in inv.columns if "qty" in c.lower() or "quantity" in c.lower() or "sold" in c.lower()), None)
        price_col = next((c for c in inv.columns if "price" in c.lower() or "sale" in c.lower()), None)
        if name_col:
            inv["normalized_product"] = inv[name_col].apply(
                lambda x: normalize_product_name(str(x), canonical)
            )
            agg = {}
            if qty_col:
                agg["quantity"] = (qty_col, "mean")
            if price_col:
                agg["price_paid"] = (price_col, "mean")
            if agg:
                inv_agg = inv.groupby("normalized_product").agg(**agg).reset_index()
                groceries = groceries.merge(inv_agg, on="normalized_product", how="left", suffixes=("", "_inv"))
                if "quantity_inv" in groceries.columns:
                    groceries["quantity"] = groceries["quantity_inv"].fillna(1.0)
                    groceries.drop(columns=["quantity_inv"], inplace=True)
                if "price_paid" not in groceries.columns:
                    groceries["price_paid"] = np.nan
    except Exception as e:
        logger.warning(f"Inventory enrichment skipped: {e}")
        groceries["price_paid"] = np.nan

    # Enrich from master catalog
    groceries = groceries.merge(
        master[["normalized_product", "shelf_life_days", "spoilage_probability",
                "is_perishable", "avg_price_bigbasket"]].drop_duplicates("normalized_product"),
        on="normalized_product", how="left"
    )
    # Fill price fallback chain: inventory → bigbasket → ITEMS default
    def _price(row):
        if pd.notna(row.get("price_paid")) and row["price_paid"] > 0:
            return row["price_paid"]
        if pd.notna(row.get("avg_price_bigbasket")) and row["avg_price_bigbasket"] > 0:
            return row["avg_price_bigbasket"]
        return ITEMS.get(row["normalized_product"], {}).get("avg_price", 50)

    groceries["price"] = groceries.apply(_price, axis=1)
    groceries["shelf_life_days"] = groceries["shelf_life_days"].fillna(14)
    groceries["expiry_date"] = groceries["purchase_date"] + pd.to_timedelta(
        groceries["shelf_life_days"].clip(1, 365).astype(int), unit="D"
    )
    groceries["wasted"] = (groceries["spoilage_probability"].fillna(0.3) > 0.5).astype(int)
    groceries["item"] = groceries["normalized_product"]
    groceries["category"] = groceries["item"].map(
        lambda x: ITEMS.get(x, {}).get("category", "Grains")
    )
    groceries["seasonal_factor"] = groceries.apply(
        lambda r: _seasonal(r["item"], r["month"]), axis=1
    )

    return groceries


def _seasonal(item: str, month: int) -> float:
    from app.utils.helpers import get_seasonal_factor
    return get_seasonal_factor(item, int(month))


def run_kaggle_pipeline() -> None:
    """Full Kaggle ingestion → writes processed CSVs consumed by loader.py."""
    logger.info("[pipeline] Kaggle datasets detected — running ingestion pipeline...")
    master = _build_master_catalog()
    master.to_csv(os.path.join(PROCESSED_DIR, "master_catalog.csv"), index=False)

    txn = _build_transactions_from_kaggle(master)

    # Write in the schema loader.py expects
    _write_processed_datasets(txn, master)
    logger.info("[pipeline] Kaggle ingestion complete.")


def _write_processed_datasets(txn: pd.DataFrame, master: pd.DataFrame) -> None:
    """Persist processed Kaggle data as the 6 CSVs loader.py reads."""
    from app.utils.helpers import get_seasonal_factor
    import random

    rng = np.random.default_rng(42)

    # 1. grocery_purchases.csv
    purchases = txn[["user_id", "item", "category", "quantity", "price",
                      "purchase_date", "household_size", "seasonal_factor"]].copy()
    purchases["purchase_date"] = purchases["purchase_date"].dt.strftime("%Y-%m-%d")
    purchases.to_csv(os.path.join(DATA_DIR, "grocery_purchases.csv"), index=False)

    # 2. food_waste.csv
    waste_df = txn[txn["normalized_product"].isin(ITEMS)][
        ["item", "category", "shelf_life_days", "spoilage_probability",
         "quantity", "price", "wasted"]
    ].copy()
    waste_df = waste_df.rename(columns={"shelf_life_days": "shelf_life"})
    waste_df["expiry_days"] = (waste_df["shelf_life"] * rng.uniform(0.3, 1.0, len(waste_df))).clip(1).astype(int)
    waste_df["expiry_risk"]  = (1.0 - waste_df["expiry_days"] / waste_df["shelf_life"].clip(1)).clip(0, 1).round(3)
    waste_df["consumption_rate"] = (rng.beta(5, 2, len(waste_df)) * 0.9).round(3)
    waste_df.to_csv(os.path.join(DATA_DIR, "food_waste.csv"), index=False)

    # 3. retail_transactions.csv  (aggregated per user-item)
    rt = txn.groupby(["user_id", "item", "category"]).agg(
        frequency=("quantity", "count"),
        avg_spend_per_visit=("price", "mean"),
        total_transactions=("quantity", "count"),
    ).reset_index()
    rt["time_between_purchases"] = (30 / rt["frequency"].clip(0.5)).astype(int)
    rt.to_csv(os.path.join(DATA_DIR, "retail_transactions.csv"), index=False)

    # 4. product_metadata.csv
    meta_rows = []
    for item, props in ITEMS.items():
        cat_key = props["category"]
        nutrition = {
            "Vegetables": rng.uniform(7, 10),
            "Fruits": rng.uniform(6, 9),
            "Dairy": rng.uniform(5, 8),
            "Grains": rng.uniform(4, 8),
            "Protein": rng.uniform(6, 9),
            "Beverages": rng.uniform(2, 7),
        }.get(cat_key, 5.0)
        meta_rows.append({
            "item": item,
            "category": cat_key,
            "shelf_life": props["shelf_life"],
            "priority_score": props["priority"],
            "avg_price": props["avg_price"],
            "nutrition_score": round(float(nutrition), 2),
            "is_perishable": int(props["shelf_life"] <= 14),
        })
    pd.DataFrame(meta_rows).to_csv(os.path.join(DATA_DIR, "product_metadata.csv"), index=False)

    # 5. household_consumption.csv
    hh_rows = []
    for hs in range(1, 7):
        for item in ITEMS:
            for month in range(1, 13):
                sf = get_seasonal_factor(item, month)
                base = ITEMS[item]["avg_qty"] * hs / 4.0
                usage = round(base * sf * float(rng.uniform(0.85, 1.15)), 3)
                hh_rows.append({
                    "household_size": hs, "item": item,
                    "category": ITEMS[item]["category"],
                    "item_usage_rate": usage,
                    "seasonal_factor": round(sf, 3),
                    "month": month,
                    "is_festival_month": int(month in FESTIVAL_MONTHS),
                })
    pd.DataFrame(hh_rows).to_csv(os.path.join(DATA_DIR, "household_consumption.csv"), index=False)

    # 6. seasonal_data.csv
    month_names = {1:"January",2:"February",3:"March",4:"April",5:"May",6:"June",
                   7:"July",8:"August",9:"September",10:"October",11:"November",12:"December"}
    weather = {1:0.8,2:0.9,3:1.0,4:1.2,5:1.3,6:1.2,7:1.1,8:1.1,9:1.0,10:1.0,11:0.9,12:0.8}
    seas_rows = []
    for m in range(1, 13):
        fest = int(m in FESTIVAL_MONTHS)
        w = weather[m]
        mult = 1.0 + (0.3 * fest) + (0.1 * (w - 1.0))
        seas_rows.append({
            "month": m, "month_name": month_names[m],
            "is_festival": fest, "weather_factor": round(w, 2),
            "demand_multiplier": round(mult, 3),
            "avg_temperature_c": round(15 + 15 * np.sin((m - 3) * np.pi / 6), 1),
        })
    pd.DataFrame(seas_rows).to_csv(os.path.join(DATA_DIR, "seasonal_data.csv"), index=False)
