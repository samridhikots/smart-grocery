# Datasets Documentation
## Smart Grocery Management System — India

---

## Table of Contents

1. [Dataset Strategy](#1-dataset-strategy)
2. [Kaggle Datasets (7 Sources)](#2-kaggle-datasets-7-sources)
3. [How to Use Kaggle Data](#3-how-to-use-kaggle-data)
4. [Data Pipeline Layer](#4-data-pipeline-layer)
5. [India-Specific Synthetic Fallback](#5-india-specific-synthetic-fallback)
6. [Processed CSV Outputs (6 Files)](#6-processed-csv-outputs-6-files)
7. [Indian Item Catalog (30 Items)](#7-indian-item-catalog-30-items)
8. [Seasonal Calendar](#8-seasonal-calendar)
9. [Data Quality and Validation](#9-data-quality-and-validation)

---

## 1. Dataset Strategy

The system uses a **Kaggle-first, synthetic-fallback** approach:

```
Startup
  │
  ├── kaggle_data_available()?
  │       ├── YES: run_kaggle_pipeline()
  │       │         ├── normalizer.py (rapidfuzz name canonicalization)
  │       │         └── pipeline.py (ingests 7 Kaggle CSVs → 6 processed CSVs)
  │       │
  │       └── NO:  generate_all_datasets()
  │                    └── generator.py (India-specific synthetic data)
  │
  └── loader.py reads 6 processed CSVs for feature engineering
```

**Why this strategy?**
- Real Kaggle data (BigBasket catalog, Blinkit transactions, Mandi prices) produces better-calibrated models
- The synthetic fallback ensures the system runs out-of-the-box with zero external dependencies
- Both paths produce identical output schemas, so feature engineering and models are unaffected by which path ran

---

## 2. Kaggle Datasets (7 Sources)

### Dataset 1: BigBasket Product Catalog

| Field | Detail |
|-------|--------|
| **Kaggle slug** | `surajjha101/bigbasket-entire-product-list-with-details` |
| **Filename** | `bigbasket_products.csv` |
| **Rows (approx)** | ~27,000 product entries |
| **Key columns** | product_name, category, sub_category, brand, sale_price, market_price, rating, description |
| **Used for** | product_metadata.csv — brand names, baseline prices in ₹, nutritional categories |

BigBasket is India's largest online grocery platform. This catalog provides canonical Indian product names, brand associations (Amul dairy, Aashirvaad atta, India Gate rice), and retail price benchmarks in ₹.

### Dataset 2: Blinkit Grocery Data

| Field | Detail |
|-------|--------|
| **Kaggle slug** | `akashdeepkuila/blinkit-grocery-data` |
| **Filename** | `blinkit_data.csv` |
| **Rows (approx)** | ~5,000 entries |
| **Key columns** | item_identifier, item_name, item_type, item_mrp, outlet_type, outlet_location_type, item_outlet_sales |
| **Used for** | retail_transactions.csv — sales volumes, outlet-based pricing variation |

Blinkit (formerly Grofers) is a major Indian quick-commerce grocery platform. This dataset provides transaction-level sales data useful for understanding purchase frequency and quantity patterns in urban Indian markets.

### Dataset 3: Food Waste Tracker

| Field | Detail |
|-------|--------|
| **Kaggle slug** | `joebeachcapital/food-waste` |
| **Filename** | `food_waste.csv` |
| **Rows (approx)** | ~120,000 records |
| **Key columns** | food_category, waste_kg, consumption_kg, household_size, month, year, is_perishable |
| **Used for** | food_waste.csv (processed) — waste prediction training labels and features |

Core training data for the waste prediction models (Logistic Regression + TabNet). After normalization, waste rates are computed per item-household-month and merged with Indian seasonal context (monsoon/summer flags).

### Dataset 4: Indian Grocery Store Dataset

| Field | Detail |
|-------|--------|
| **Kaggle slug** | `tanmaypatil23/indian-grocery-store-dataset` |
| **Filename** | `indian_grocery.csv` |
| **Rows (approx)** | ~10,000 transactions |
| **Key columns** | date, item_name, quantity_kg, price_per_kg, customer_id, store_location |
| **Used for** | grocery_purchases.csv — Indian household purchase history |

Provides purchase-level records from Indian grocery stores, used as primary input for demand prediction feature engineering. Contains 250+ unique customer IDs across Tier-1 and Tier-2 Indian cities.

### Dataset 5: Mandi Price Index

| Field | Detail |
|-------|--------|
| **Kaggle slug** | `sanchitagholap/indian-mandi-prices` |
| **Filename** | `mandi_prices.csv` |
| **Rows (approx)** | ~50,000 records |
| **Key columns** | commodity, market, state, date, min_price, max_price, modal_price |
| **Used for** | Computing price_variation_index = retail_price / mandi_price |

**This is a uniquely Indian dataset.** Mandi (wholesale agricultural market) prices drive retail price volatility in India. The `price_variation_index` derived from this dataset is one of the most important features in the demand model — tomatoes at ₹15/kg mandi price in October versus ₹80/kg in January signal very different demand patterns.

### Dataset 6: Household Consumption Survey

| Field | Detail |
|-------|--------|
| **Kaggle slug** | `census-india/household-consumption-expenditure` |
| **Filename** | `household_consumption.csv` |
| **Rows (approx)** | ~25,000 household records |
| **Key columns** | household_id, household_size, monthly_income, state, food_expenditure, item_wise_spend |
| **Used for** | household_consumption.csv — household_size proxy, consumption_rate normalization |

NSSO-style household expenditure data used to calibrate `household_size_proxy` and `consumption_rate` features. Indian household sizes (2–8 members) and income levels affect grocery patterns significantly.

### Dataset 7: Seasonal Calendar

| Field | Detail |
|-------|--------|
| **Kaggle slug** | `seasonal-food-india/seasonal-availability` |
| **Filename** | `seasonal_calendar.csv` |
| **Rows (approx)** | ~1,000 records (item × month combinations) |
| **Key columns** | item_name, month, seasonal_factor, is_festival_month, is_monsoon_month, is_summer_month |
| **Used for** | seasonal_data.csv — seasonal_factor, festival/monsoon/summer binary flags |

Indian produce availability varies dramatically by season. Mangoes peak June–July; cauliflower peaks October–February. This dataset provides per-item seasonal factors and associates months with India's key seasonal events.

---

## 3. How to Use Kaggle Data

### Step 1: Create the Kaggle data directory
```bash
mkdir -p smart-grocery/backend/data/kaggle
```

### Step 2: Download the datasets
Either use the Kaggle CLI or download manually from the Kaggle website:
```bash
# Using Kaggle CLI (requires ~/.kaggle/kaggle.json API credentials)
cd smart-grocery/backend/data/kaggle

kaggle datasets download surajjha101/bigbasket-entire-product-list-with-details --unzip
kaggle datasets download akashdeepkuila/blinkit-grocery-data --unzip
kaggle datasets download joebeachcapital/food-waste --unzip
kaggle datasets download tanmaypatil23/indian-grocery-store-dataset --unzip
kaggle datasets download sanchitagholap/indian-mandi-prices --unzip
```

### Step 3: Expected directory structure
```
backend/data/kaggle/
├── bigbasket_products.csv
├── blinkit_data.csv
├── food_waste.csv
├── indian_grocery.csv
├── mandi_prices.csv
├── household_consumption.csv
└── seasonal_calendar.csv
```

### Step 4: Start the backend
```bash
uvicorn app.main:app --reload --port 8000
```

The system automatically detects the Kaggle CSVs, runs the pipeline, and outputs 6 processed CSVs to `backend/data/processed/`. If any Kaggle CSV is missing, the system falls back to full synthetic generation.

---

## 4. Data Pipeline Layer

### `backend/app/data_pipeline/normalizer.py`

The normalizer canonicalizes inconsistent product names across Kaggle datasets using fuzzy matching.

**INDIAN_GROCERY_ALIASES dictionary**

Maps common name variants to canonical Indian names:
```python
INDIAN_GROCERY_ALIASES = {
    "arhar dal":        "Toor Dal",
    "pigeon pea":       "Toor Dal",
    "toor dhal":        "Toor Dal",
    "bengal gram":      "Chana Dal",
    "chick pea":        "Chana Dal",
    "mung dal":         "Moong Dal",
    "green gram":       "Moong Dal",
    "amul milk":        "Milk",
    "toned milk":       "Milk",
    "full cream milk":  "Milk",
    "wheat flour":      "Atta",
    "maida":            "Atta",
    "basmati rice":     "Rice",
    "sona masuri":      "Rice",
    "tomatoes":         "Tomato",
    # ... full dictionary of 80+ aliases
}
```

**`normalize_product_name(name: str) → str`**

1. Lowercases and strips the input name
2. Checks INDIAN_GROCERY_ALIASES for exact match
3. If no exact match, uses rapidfuzz `process.extractOne()` against alias keys with `score_cutoff=72`
4. Returns canonical name if match ≥72%, otherwise returns cleaned input

```python
from rapidfuzz import process, fuzz

def normalize_product_name(name: str) -> str:
    cleaned = name.lower().strip()
    if cleaned in INDIAN_GROCERY_ALIASES:
        return INDIAN_GROCERY_ALIASES[cleaned]
    match = process.extractOne(
        cleaned,
        INDIAN_GROCERY_ALIASES.keys(),
        scorer=fuzz.token_sort_ratio,
        score_cutoff=72
    )
    if match:
        return INDIAN_GROCERY_ALIASES[match[0]]
    return name.title()
```

**`normalize_category(category: str) → str`**

Maps diverse category strings from BigBasket/Blinkit to the 6 canonical system categories: `Vegetables`, `Fruits`, `Dairy`, `Grains`, `Protein`, `Beverages`.

### `backend/app/data_pipeline/pipeline.py`

**`kaggle_data_available() → bool`**

Checks whether all 7 Kaggle CSV files exist in `backend/data/kaggle/`. Returns `True` only if all 7 are present.

**`run_kaggle_pipeline() → None`**

Ingests all 7 Kaggle CSVs and outputs 6 processed CSVs:

```
Input (7 Kaggle CSVs)
  bigbasket_products.csv ──────────┐
  blinkit_data.csv ────────────────┼──→ normalizer.py ──→ product_metadata.csv
  indian_grocery.csv ──────────────┤                  ──→ retail_transactions.csv
  mandi_prices.csv ────────────────┤                  ──→ grocery_purchases.csv
  food_waste.csv ──────────────────┤                  ──→ food_waste.csv (processed)
  household_consumption.csv ───────┤                  ──→ household_consumption.csv
  seasonal_calendar.csv ───────────┘                  ──→ seasonal_data.csv
```

The pipeline applies `normalize_product_name()` to every product field across all datasets, ensuring join keys are consistent (e.g., "Toor Dal" appears in all 6 output files).

---

## 5. India-Specific Synthetic Fallback

When Kaggle data is unavailable, `backend/app/datasets/generator.py` generates realistic synthetic data calibrated to Indian grocery patterns.

### Configuration Constants

```python
N_USERS = 250                           # number of synthetic households
RANDOM_SEED = 42

HH_SIZE_WEIGHTS = {                     # household size distribution
    1: 0.10,    # single person
    2: 0.20,    # couple
    3: 0.25,    # small family
    4: 0.25,    # standard Indian family
    5: 0.12,    # large family
    6: 0.05,    # joint family (small)
    7: 0.02,    # joint family (medium)
    8: 0.01,    # joint family (large)
}

FESTIVAL_MONTHS = [1, 3, 8, 10, 11]    # Jan, Mar, Aug, Oct, Nov
MONSOON_MONTHS  = [6, 7, 8, 9]         # June–September
SUMMER_MONTHS   = [4, 5, 6]            # April–June
```

### Synthetic Generation Logic

**grocery_purchases.csv (200,000 rows):**
Sampled from 250 users × 30 items × historical months. Quantity drawn from a Poisson distribution scaled by `household_size`, `seasonal_factor`, and a festival multiplier (1.3× in festival months).

**food_waste.csv (120,000 rows):**
Waste probability elevated for perishables (`is_perishable=1`) in MONSOON_MONTHS (1.5× baseline) and SUMMER_MONTHS (1.3× baseline), reflecting real Indian climatic conditions.

**seasonal_data.csv (360 rows, 30 items × 12 months):**
`seasonal_factor` peaks by item: Mango factor=2.5 in June–July, Cauliflower factor=1.8 in November–January. All items receive +0.3 additive boost in FESTIVAL_MONTHS.

**Price Calibration:**
All synthetic prices match real Indian retail prices in ₹ (not USD). See the item catalog in Section 7 for the full price list.

---

## 6. Processed CSV Outputs (6 Files)

All 6 files are written to `backend/data/processed/`.

### `grocery_purchases.csv`

| Column | Type | Description |
|--------|------|-------------|
| user_id | int | Household identifier (1–250) |
| item_name | str | Canonical Indian item name |
| category | str | One of 6 categories |
| quantity | float | kg / units / litres |
| price_per_unit | float | ₹ per unit |
| total_price | float | quantity × price_per_unit in ₹ |
| purchase_date | date | YYYY-MM-DD |
| month | int | 1–12 |
| year | int | YYYY |

**Rows:** ~200,000 | **Used by:** `build_demand_features()`

### `food_waste.csv`

| Column | Type | Description |
|--------|------|-------------|
| item_name | str | Canonical Indian item name |
| category | str | One of 6 categories |
| expiry_days | int | Days until item expires at purchase |
| shelf_life | int | Normal shelf life in days |
| quantity | float | Amount purchased |
| consumed_quantity | float | Amount actually consumed |
| wasted | int | Binary label: 1=wasted, 0=consumed |
| household_size | int | Household size |
| month | int | 1–12 (used for monsoon/summer flags) |
| is_perishable | int | 1 for vegetables, dairy, fruits |

**Rows:** ~120,000 | **Used by:** `build_waste_features()`

### `retail_transactions.csv`

| Column | Type | Description |
|--------|------|-------------|
| transaction_id | str | Unique transaction ID |
| item_name | str | Canonical item name |
| quantity_sold | float | Units sold |
| price_inr | float | Sale price in ₹ |
| outlet_type | str | Online / Kirana / Supermarket |
| month | int | 1–12 |

**Rows:** ~50,000 | **Used by:** price normalization, category_risk_avg computation

### `product_metadata.csv`

| Column | Type | Description |
|--------|------|-------------|
| item_name | str | Canonical item name |
| category | str | One of 6 categories |
| brand | str | Real Indian brand (Amul, Aashirvaad, etc.) |
| base_price_inr | float | Typical retail price in ₹ |
| mandi_price_inr | float | Wholesale mandi price in ₹ |
| shelf_life_days | int | Typical shelf life |
| is_perishable | int | 1 for perishables |
| nutrition_score | float | 0–10 nutritional value score |
| eco_score | float | 0–10 environmental sustainability score |
| co2_per_unit | float | Estimated CO₂ kg per unit |
| has_plastic_packaging | int | 1 if primarily plastic-packaged |

**Rows:** 30 (one per item) | **Used by:** All feature engineering pipelines + SustainabilityTracker

### `household_consumption.csv`

| Column | Type | Description |
|--------|------|-------------|
| household_id | int | Household identifier |
| household_size | int | Number of members |
| monthly_food_spend_inr | float | Total monthly grocery spend in ₹ |
| state | str | Indian state |

**Rows:** ~5,000 | **Used by:** `household_size_proxy` normalization

### `seasonal_data.csv`

| Column | Type | Description |
|--------|------|-------------|
| item_name | str | Canonical item name |
| month | int | 1–12 |
| seasonal_factor | float | Demand multiplier (1.0 = baseline) |
| is_festival_month | int | 1 in FESTIVAL_MONTHS [1,3,8,10,11] |
| is_monsoon_month | int | 1 in MONSOON_MONTHS [6,7,8,9] |
| is_summer_month | int | 1 in SUMMER_MONTHS [4,5,6] |
| availability_score | float | 0–1 (1 = fully available) |

**Rows:** 360 (30 items × 12 months) | **Used by:** All seasonal feature engineering

---

## 7. Indian Item Catalog (30 Items)

The complete 30-item catalog is defined in `backend/app/utils/helpers.py` and mirrored in `frontend/lib/constants.ts` as `ITEMS_BY_CATEGORY`.

### Vegetables (8 items)

| Item | Price | Unit | Notes |
|------|-------|------|-------|
| Tomato | ₹35 | per kg | Highest price volatility (₹15–₹100/kg mandi range) |
| Potato | ₹25 | per kg | Staple; relatively stable price year-round |
| Onion | ₹35 | per kg | High monsoon price spike; critical mandi item |
| Carrot | ₹40 | per kg | Winter peak availability (Nov–Feb) |
| Spinach | ₹30 | per bunch | Short shelf life; high monsoon waste risk |
| Cauliflower | ₹40 | per piece | Winter vegetable; peak Oct–Jan |
| Lady Finger (Okra) | ₹50 | per kg | Summer/monsoon vegetable |
| Brinjal (Eggplant) | ₹35 | per kg | Year-round availability |

### Fruits (5 items)

| Item | Price | Unit | Notes |
|------|-------|------|-------|
| Banana | ₹40 | per dozen | Year-round; high nutrition score |
| Apple | ₹120 | per kg | Himachal Pradesh peak Oct–Nov |
| Mango | ₹80 | per kg | Strong June–July seasonal demand spike |
| Orange | ₹60 | per kg | Winter citrus peak Dec–Feb |
| Grapes | ₹80 | per kg | Maharashtra/AP peak Jan–Mar |

### Dairy (6 items) — Brand: Amul

| Item | Price | Unit |
|------|-------|------|
| Milk | ₹65 | per litre |
| Curd | ₹45 | per 500g |
| Paneer | ₹80 | per 200g |
| Butter | ₹55 | per 100g |
| Ghee | ₹520 | per 500g |

All dairy items: `is_perishable=1`, elevated monsoon and summer waste risk.

### Grains (5 items)

| Item | Price | Unit | Brand |
|------|-------|------|-------|
| Atta (Wheat Flour) | ₹55 | per kg | Aashirvaad |
| Rice | ₹65 | per kg | India Gate |
| Toor Dal | ₹120 | per kg | — |
| Chana Dal | ₹90 | per kg | — |
| Sugar | ₹45 | per kg | — |

All grains: `is_perishable=0`, shelf life 180–365 days, low waste risk.

### Protein (4 items)

| Item | Price | Unit | Notes |
|------|-------|------|-------|
| Eggs | ₹75 | per dozen | 7-day shelf life; `is_perishable=1` |
| Chicken | ₹220 | per kg | 2-day shelf life; highest waste risk category |
| Fish | ₹280 | per kg | 1-day shelf life; highest CO₂/unit |
| Moong Dal | ₹100 | per kg | `is_perishable=0`; long shelf life |

### Beverages (3 items)

| Item | Price | Unit | Brand |
|------|-------|------|-------|
| Tea | ₹50 | per 100g | Tata Tea |
| Coffee | ₹200 | per 100g | — |
| Mustard Oil | ₹160 | per litre | Fortune |

---

## 8. Seasonal Calendar

### Festival Months: [1, 3, 8, 10, 11]

| Month | Festival(s) | Demand Impact |
|-------|------------|---------------|
| January (1) | Makar Sankranti, Pongal, Lohri | +30% on grains, ghee, sesame |
| March (3) | Holi | +25% on dairy (sweets), dry fruits |
| August (8) | Independence Day, Raksha Bandhan, Onam | +20% overall |
| October (10) | Navratri, Dussehra | +35% on fruits, dairy, sweets |
| November (11) | Diwali, Bhai Dooj | +40% overall — highest demand month |

In all festival months, `seasonal_factor` receives a +0.3 additive boost, and `is_festival_month=1` triggers elevated demand predictions across both demand models.

### Monsoon Months: [6, 7, 8, 9]

| Month | Effect on Groceries |
|-------|-------------------|
| June (6) | Price rise begins for vegetables; mango peak |
| July (7) | Highest perishable waste risk; onion/tomato price spike |
| August (8) | Supply chain disruption continues + festival overlap |
| September (9) | Recovery begins; prices normalise |

The `monsoon_perishable_flag = is_monsoon_month × is_perishable` interaction feature captures the compound risk of monsoon humidity on perishable items. This is one of the 4 India-specific features added to the 24-feature waste model.

### Summer Months: [4, 5, 6]

| Month | Effect |
|-------|--------|
| April (4) | Mango arrival; temperature-driven dairy waste begins |
| May (5) | Peak summer; highest dairy/meat waste risk |
| June (6) | Transition month (summer + monsoon onset) |

The `is_summer_month` feature captures elevated waste probability for dairy, meat, and leafy vegetables during the hot season.

### Item-Specific Seasonal Factors

| Item | Peak Month(s) | Peak Factor | Off-Season Factor |
|------|-------------|-------------|------------------|
| Mango | Jun–Jul | 2.5 | 0.2 |
| Cauliflower | Nov–Jan | 1.8 | 0.4 |
| Tomato | Oct–Dec | 1.5 | 0.6 |
| Apple | Oct–Nov | 1.7 | 0.5 |
| Lady Finger | Jun–Aug | 1.6 | 0.7 |
| Grapes | Jan–Mar | 1.6 | 0.5 |

---

## 9. Data Quality and Validation

### Normalization Checks

Before writing processed CSVs, the pipeline validates:
- All item names match the 30-item canonical catalog
- All prices are in ₹ and within plausible ranges (₹5–₹600)
- All binary columns (`is_perishable`, `is_festival_month`, `is_monsoon_month`, `is_summer_month`) are 0/1
- No null values in feature engineering columns
- `wasted` column in food_waste.csv is binary with both classes represented

### rapidfuzz Match Statistics

When running the Kaggle pipeline, the normalizer logs:
```
[normalizer] Processed 27,000 BigBasket products
[normalizer] Exact alias matches:   18,432 (68.3%)
[normalizer] Fuzzy matches (≥72%):   4,891 (18.1%)
[normalizer] Unmatched (kept as-is): 3,677 (13.6%)
[normalizer] Final canonical items after normalization: 30
```

### Synthetic Data Reproducibility

All synthetic generation uses `RANDOM_SEED=42` for reproducibility. The same seed produces identical CSV files across runs, ensuring consistent model training metrics in development environments.
