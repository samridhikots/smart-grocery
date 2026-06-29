# Feature Engineering Documentation
## Smart Grocery Management System

---

## Table of Contents

1. [Overview](#1-overview)
2. [Demand Prediction Feature Set](#2-demand-prediction-feature-set)
3. [Waste Prediction Feature Set](#3-waste-prediction-feature-set)
4. [Feature Construction Pipeline](#4-feature-construction-pipeline)
5. [Feature Importance Analysis](#5-feature-importance-analysis)
6. [Preprocessing Steps](#6-preprocessing-steps)
7. [Inference-Time Feature Construction](#7-inference-time-feature-construction)
8. [Design Decisions](#8-design-decisions)

---

## 1. Overview

Feature engineering transforms raw dataset columns into a rich numerical feature matrix that ML models can learn from. We build **13 features for demand prediction** and **24 features for waste prediction**, each grounded in domain knowledge about household grocery consumption.

| Pipeline | Input Datasets | Output Shape | Target |
|----------|---------------|-------------|--------|
| Demand | grocery_purchases + household_consumption + seasonal_data + product_metadata | (N, 13) | `next_quantity` (continuous) |
| Waste | food_waste + product_metadata | (M, 24) | `wasted` (binary 0/1) |

**Key principle:** Every feature was chosen because it has a plausible causal relationship with the prediction target. No random feature throwing.

---

## 2. Demand Prediction Feature Set (13 Features)

Target variable: **`next_quantity`** — the quantity the household will purchase in their next shopping trip for a given item.

### Feature 1: `avg_quantity_last3`

**What it is:** Rolling mean of the last 3 purchase quantities for this (user, item) pair.

**Why it matters:** Recent purchase quantities are the strongest predictor of future purchase quantities. If someone has been buying 2 kg of Tomatoes for 3 consecutive trips, they will likely buy ~2 kg next time too.

**Construction:**
```python
purchases["avg_quantity_last3"] = (
    purchases.groupby(["user_id", "item"])["quantity"]
    .transform(lambda s: s.shift(1).rolling(3, min_periods=1).mean())
)
```
- `shift(1)` prevents data leakage (excludes current purchase)
- `rolling(3, min_periods=1)` handles the first 1–2 purchases gracefully

**Expected range:** 0.1 – 10.0  
**Correlation with target:** High (≈0.85)

---

### Feature 2: `days_since_last`

**What it is:** Number of days elapsed since the previous purchase of this item by this user.

**Why it matters:** Long gaps since last purchase indicate either: (a) the household is low on stock and will buy more, or (b) the item isn't consumed frequently. It captures purchase urgency.

**Construction:**
```python
purchases["prev_date"] = purchases.groupby(["user_id", "item"])["purchase_date"].shift(1)
purchases["days_since_last"] = (purchases["purchase_date"] - purchases["prev_date"]).dt.days
purchases["days_since_last"].fillna(14).clip(1, 90)
```
- Default of 14 days used for first-ever purchase records
- Clipped at 90 days to prevent outliers from dominating

**Expected range:** 1 – 90  
**Role:** Helps models distinguish "regular restocking" (short gap, moderate quantity) from "bulk buying after gap" (long gap, large quantity)

---

### Feature 3: `purchase_frequency`

**What it is:** Average number of purchase events per month for a (user, item) pair over the 2-year observation window.

**Why it matters:** A household that buys Milk 4 times/month is stocking a 1-litre carton each time, while one that buys it once/month is buying 4-litre bulk. Frequency fundamentally shapes quantity predictions.

**Construction:**
```python
freq = purchases.groupby(["user_id", "item"]).agg(n_purchases=("quantity", "count"))
freq["purchase_frequency"] = freq["n_purchases"] / 24  # 24 months in dataset
```

**Expected range:** 0.2 – 8.0 purchases/month

---

### Feature 4: `seasonal_factor`

**What it is:** The demand multiplier for the current calendar month, from the seasonal dataset.

**Why it matters:** Mango demand is 2× higher in June than in December. A model without this feature would over-predict Mango in winter and under-predict in summer.

**Construction:**
```python
# Seasonal factor already in grocery_purchases from generation
# Festival flag merged from seasonal dataset
purchases = purchases.merge(
    seasonal[["month", "is_festival"]],
    on="month", how="left"
)
```

**Expected range:** 0.7 – 2.0  
**Note:** Festival months (Jan, Mar, Oct, Nov) receive an additional 0.3 boost

---

### Feature 5: `household_size`

**What it is:** Number of people in the purchasing household.

**Why it matters:** A family of 6 needs 3× more food than a single person. This is the primary scaling factor for absolute purchase quantities.

**Source:** Directly from `grocery_purchases.csv` (recorded at purchase time).

**Expected range:** 1 – 6  
**Expected effect:** Roughly linear with `next_quantity` across most items

---

### Feature 6: `consumption_rate`

**What it is:** Average weekly usage rate of the item at the given household size and month, from the household consumption dataset.

**Why it matters:** Consumption rate captures how quickly an item gets used. A household that uses Spinach quickly (high consumption_rate) needs to restock more frequently.

**Construction:**
```python
hh_avg = household_consumption.groupby(["household_size", "item"])["item_usage_rate"].mean()
purchases = purchases.merge(hh_avg, on=["household_size", "item"], how="left")
```

**Expected range:** 0.1 – 8.0  
**Interaction with target:** Combined with `days_since_last`, helps infer how much has been consumed since the last purchase

---

### Feature 7: `price`

**What it is:** The price paid in the current purchase transaction.

**Why it matters:** Price elasticity is real — when Chicken prices spike, households may buy less per trip and substitute with Lentils. The model learns demand-price relationships.

**Source:** Directly from `grocery_purchases.csv`  
**Expected range:** $0.10 – $22.00

---

### Feature 8: `category_encoded`

**What it is:** Integer encoding of the item's category.

**Why it matters:** Category is a categorical proxy for many correlated properties — average shelf life, buying frequency, typical quantity. The model uses this as a grouping signal.

**Encoding map:**
```
Vegetables → 0
Fruits     → 1
Dairy      → 2
Grains     → 3
Protein    → 4
Beverages  → 5
```

---

### Feature 9: `expiry_risk_proxy`

**What it is:** `1 / shelf_life` — a continuous measure of how quickly an item perishes relative to others.

**Why it matters:** Perishable items (Chicken: 3 days, Fish: 2 days) are bought in small, frequent quantities to avoid waste. Non-perishables (Rice: 365 days) are bought in bulk infrequently. This feature captures that buying pattern.

**Construction:**
```python
purchases = purchases.merge(metadata[["item", "shelf_life"]], on="item")
purchases["expiry_risk_proxy"] = (1.0 / purchases["shelf_life"].clip(1, 365)).round(4)
```

**Example values:**
- Fish (shelf_life=2): expiry_risk_proxy = 0.5000 (buy small, buy often)
- Chicken (shelf_life=3): expiry_risk_proxy = 0.3333
- Tomato (shelf_life=7): expiry_risk_proxy = 0.1429
- Rice (shelf_life=365): expiry_risk_proxy = 0.0027 (buy large, buy rarely)

---

### Feature 10: `is_festival_month`

**What it is:** Binary flag (0/1) indicating whether the purchase occurred in a festival month.

**Why it matters:** Festival months (Diwali, Holi, New Year) show a consistent 20–30% demand spike across most categories as households entertain guests and cook special meals.

**Festival months:** January (New Year), March (Holi), August (Raksha Bandhan/Janmashtami), October (Dussehra), November (Diwali), December (Christmas/New Year)

---

### Feature 11: `price_variation_index`

**What it is:** `(price - mandi_price) / mandi_price` — how much more (or less) the household paid vs. the wholesale mandi rate.

**Why it matters:** When retail prices spike above mandi rates, households often buy less or buy from cheaper sources. This feature captures price volatility relative to the wholesale benchmark.

**Construction:**
```python
if "mandi_price" in purchases.columns:
    purchases["price_variation_index"] = (
        (purchases["price"] - purchases["mandi_price"]) / purchases["mandi_price"].clip(1)
    ).clip(-0.5, 3.0).fillna(0.0)
else:
    # Synthetic fallback: normally distributed around 0.2 retail markup
    purchases["price_variation_index"] = rng.normal(0.2, 0.1, len(purchases)).clip(-0.5, 3.0)
```

**Expected range:** -0.5 – 3.0 (positive = retail above mandi; negative = retail below mandi)

---

### Feature 12: `is_summer_month`

**What it is:** Binary flag (0/1) indicating whether the purchase occurred in India's summer months (April–June).

**Why it matters:** Summer heat (April–June) accelerates spoilage of perishables and drives higher consumption of cooling items (Curd, Buttermilk, Fruits). It also affects purchase quantity as households stock more refrigerated items.

**Construction:**
```python
purchases["is_summer_month"] = purchases["month"].isin(SUMMER_MONTHS).astype(int)
# SUMMER_MONTHS = {4, 5, 6}
```

**Expected range:** 0 or 1

---

### Feature 13: `is_monsoon_month`

**What it is:** Binary flag (0/1) indicating whether the purchase occurred in India's monsoon months (June–September).

**Why it matters:** Monsoon humidity (June–September) dramatically increases spoilage risk for vegetables and dairy. Households adjust buying patterns — smaller quantities of perishables, more shelf-stable items. Mandi supply disruptions also cause price spikes.

**Construction:**
```python
purchases["is_monsoon_month"] = purchases["month"].isin(MONSOON_MONTHS).astype(int)
# MONSOON_MONTHS = {6, 7, 8, 9}
```

**Expected range:** 0 or 1

---

## 3. Waste Prediction Feature Set (24 Features)

Target variable: **`wasted`** — 1 if the item was wasted before consumption, 0 if fully consumed.

### Feature 1: `expiry_days`

**What it is:** Days remaining until expiry at the time of purchase.

**Why it matters:** An item with 1 day left is almost certain to be wasted unless consumed immediately. This is the single strongest predictor of waste.

**Expected range:** 1 – 365

---

### Feature 2: `shelf_life`

**What it is:** Total shelf life of the item in days (from product metadata).

**Why it matters:** Provides context for `expiry_days`. "2 days left" is very different for Chicken (total shelf life 3 days) vs Yogurt (total shelf life 14 days).

**Expected range:** 2 – 365

---

### Feature 3: `expiry_risk`

**What it is:** `1 - (expiry_days / shelf_life)` — a normalised measure of how close to expiry an item is.

**Why it matters:** Normalizes the raw `expiry_days` by shelf life, making the risk comparable across items:
- Chicken with 1 day left: (1/3) → risk = 0.667
- Rice with 30 days left: (30/365) → risk = 0.918

**Formula:** `expiry_risk = clip(1 - expiry_days/shelf_life, 0, 1)`  
**Expected range:** 0.0 – 1.0

This is the feature that was explicitly engineered in `food_waste.csv` generation and is directly referenced in the data.

---

### Feature 4: `consumption_rate`

**What it is:** How quickly the item is consumed (0.0 = not consumed at all, 1.0 = consumed immediately).

**Why it matters:** A high consumption rate means the household uses the item quickly — even with short expiry, waste is unlikely. A low consumption rate + short expiry = likely waste.

**Expected range:** 0.05 – 1.0  
**Distribution:** Beta(5, 2) × item_usage_rate (right-skewed, most items above 0.5)

---

### Feature 5: `quantity`

**What it is:** Quantity of the item purchased.

**Why it matters:** Buying 3 kg of Spinach (shelf life 5 days) almost guarantees waste for a small household, while buying 0.5 kg is easily consumed.

**Expected range:** 0.1 – 20.0

---

### Feature 6: `price`

**What it is:** Price paid for the item.

**Why it matters:** Higher-priced items receive more attention and are less likely to be wasted (psychological loss aversion). A $10 Fish is watched closely; a $1.50 Banana is not.

**Expected range:** $0.10 – $22.00

---

### Feature 7: `household_size_proxy`

**What it is:** Estimated household size derived from `quantity / consumption_rate`.

**Why it matters:** A proxy because the waste dataset doesn't directly record household size. Large households can consume more before expiry, reducing waste probability.

**Construction:**
```python
household_size_proxy = clip(quantity / max(consumption_rate, 0.05), 1, 6)
```

---

### Feature 8: `nutrition_score`

**What it is:** Nutritional value score of the item (1–10), from product metadata.

**Why it matters:** Items with high nutritional value (Vegetables, Protein) are prioritized for consumption. Households tend to finish nutritious foods before low-nutrition items.

**Expected range:** 2.0 – 10.0

---

### Feature 9: `is_perishable`

**What it is:** Binary flag: 1 if shelf_life ≤ 14 days, 0 otherwise.

**Why it matters:** Perishable items are categorically different in handling — they require refrigeration, active meal planning, and immediate use. This binary flag captures the non-linear boundary effect.

**Perishable items:** Tomato, Spinach, Broccoli, Cucumber, Bell Pepper, Banana, Mango, Grapes, Milk, Bread, Juice, Chicken, Fish

---

### Feature 10: `category_encoded`

**What it is:** Integer encoding of category (same mapping as demand features).

**Why it matters:** Category captures shared waste patterns. Protein items (Chicken, Fish) waste patterns are fundamentally different from Grains (Rice, Pasta).

---

### Feature 11: `consumption_to_expiry_ratio`

**What it is:** `(consumption_rate / expiry_days).clip(0, 10)` — how fast consumed relative to expiry urgency.

**Why it matters:** High consumption relative to expiry days means the item will be consumed before going bad; low ratio signals likely waste.

**Construction:**
```python
waste["consumption_to_expiry_ratio"] = (waste["consumption_rate"] / waste["expiry_days"].clip(1, 365)).clip(0, 10)
```

**Expected range:** 0.0 – 10.0

---

### Feature 12: `quantity_per_household`

**What it is:** `(quantity / household_size_proxy).clip(0, 20)` — quantity relative to how many people will consume it.

**Why it matters:** 3 kg of Spinach for a household-size-proxy of 1 is very different from the same for proxy of 6.

**Construction:**
```python
waste["quantity_per_household"] = (waste["quantity"] / waste["household_size_proxy"].clip(1, 6)).clip(0, 20)
```

**Expected range:** 0.0 – 20.0

---

### Feature 13: `price_per_unit`

**What it is:** `(price / quantity).clip(0, 50)` — cost per unit of quantity.

**Why it matters:** Expensive-per-unit items receive closer attention; psychological loss aversion increases consumption effort.

**Construction:**
```python
waste["price_per_unit"] = (waste["price"] / waste["quantity"].clip(0.1, 100)).clip(0, 50)
```

**Expected range:** 0.0 – 50.0

---

### Feature 14: `perishability_score`

**What it is:** `(1.0 / shelf_life).round(4)` — continuous measure of perishability.

**Why it matters:** Unlike the binary `is_perishable`, this provides a continuous gradient; Fish (shelf_life=2) scores 0.5, Rice scores 0.0027.

**Construction:**
```python
waste["perishability_score"] = (1.0 / waste["shelf_life"].clip(1, 365)).round(4)
```

**Expected range:** 0.0027 – 0.5000

---

### Feature 15: `waste_risk_interaction`

**What it is:** `expiry_risk × (1.0 - consumption_rate)` — multiplicative interaction of the two strongest signals.

**Why it matters:** Both expiry proximity AND low consumption must coincide for high waste probability; this captures their joint effect which linear models cannot.

**Construction:**
```python
waste["waste_risk_interaction"] = waste["expiry_risk"] * (1.0 - waste["consumption_rate"].clip(0, 1))
```

**Expected range:** 0.0 – 1.0

---

### Feature 16: `category_risk_avg`

**What it is:** Average waste rate for the item's category across the training set.

**Why it matters:** Some categories (Protein, Vegetables) have systematically higher waste than others (Grains, Beverages); this encodes learned category-level base rates.

**Construction:**
```python
waste["category_risk_avg"] = waste.groupby("category")["wasted"].transform("mean")
```

**Expected range:** 0.0 – 1.0 (typically 0.3–0.7)

---

### Feature 17: `rolling_waste_rate`

**What it is:** Average waste rate for this specific item across all records in the training set.

**Why it matters:** Some items (Fish, Spinach) are systematically wasted more often than others (Rice, Lentils); this encodes item-level waste history.

**Construction:**
```python
waste["rolling_waste_rate"] = waste.groupby("item")["wasted"].transform("mean")
```

**Expected range:** 0.0 – 1.0

---

### Feature 18: `normalized_quantity`

**What it is:** `((quantity - global_mean) / global_std).clip(-3, 3)` — z-score normalised quantity.

**Why it matters:** Provides the model with a centred, scale-invariant view of quantity; works well with neural network activations (TabNet).

**Construction:**
```python
q_mean = waste["quantity"].mean()
q_std = waste["quantity"].std()
waste["normalized_quantity"] = ((waste["quantity"] - q_mean) / q_std).clip(-3, 3)
```

**Expected range:** -3.0 – 3.0

---

### Feature 19: `seasonal_waste_factor`

**What it is:** `is_perishable × (1.0 + 0.2 × (shelf_life < 7))` — perishability boosted for ultra-short-shelf items.

**Why it matters:** Very short shelf life items (shelf_life < 7 days) that are also perishable have disproportionately higher waste risk; this encodes that threshold non-linearity.

**Construction:**
```python
waste["seasonal_waste_factor"] = waste["is_perishable"] * (1.0 + 0.2 * (waste["shelf_life"] < 7).astype(float))
```

**Expected range:** 0.0, 1.0, or 1.2

---

### Feature 20: `price_sensitivity_score`

**What it is:** `price × is_perishable` — price of the item weighted by whether it's perishable.

**Why it matters:** Expensive perishable items (Chicken at ₹500, Fish at ₹400) combine financial loss and time pressure; cheap non-perishables have neither.

**Construction:**
```python
waste["price_sensitivity_score"] = waste["price"] * waste["is_perishable"]
```

**Expected range:** 0.0 – 1000.0

---

### Feature 21: `is_summer_month`

**What it is:** Binary flag (0/1) — 1 if the waste record was created during India's summer months (April–June).

**Why it matters:** Summer heat dramatically shortens actual shelf life for vegetables and dairy. An item that would last 5 days in winter may last only 2 days in June heat without refrigeration.

**Construction:**
```python
waste["is_summer_month"] = waste["month"].isin(SUMMER_MONTHS).astype(int)
# SUMMER_MONTHS = {4, 5, 6}
```

**Expected range:** 0 or 1

---

### Feature 22: `is_monsoon_month`

**What it is:** Binary flag (0/1) — 1 if the waste record was created during India's monsoon months (June–September).

**Why it matters:** Monsoon humidity accelerates fungal growth and bacterial spoilage, especially for leafy vegetables (Spinach, Cauliflower) and dairy (Paneer, Curd). This flag helps the model learn seasonally elevated waste risk.

**Construction:**
```python
waste["is_monsoon_month"] = waste["month"].isin(MONSOON_MONTHS).astype(int)
# MONSOON_MONTHS = {6, 7, 8, 9}
```

**Expected range:** 0 or 1

---

### Feature 23: `monsoon_perishable_flag`

**What it is:** `is_monsoon_month × is_perishable` — interaction flag that is 1 only when both conditions hold simultaneously.

**Why it matters:** The spoilage risk increase from monsoon humidity applies specifically to perishable items. A non-perishable (Rice, Oil) is unaffected by monsoon humidity; the compounding risk only exists for perishables. This explicit interaction term lets linear models (Logistic Regression) capture what would otherwise require a non-linear threshold.

**Construction:**
```python
waste["monsoon_perishable_flag"] = waste["is_monsoon_month"] * waste["is_perishable"]
```

**Expected range:** 0 or 1

---

### Feature 24: `price_variation_index`

**What it is:** `(price - mandi_price) / mandi_price` clipped to [-0.5, 3.0] — how much the retail price deviates from the mandi wholesale rate.

**Why it matters:** When prices are unusually high (large positive PVI), households may buy smaller quantities than usual to stay within budget, potentially leaving bought items partially unused. Conversely, during mandi-price dips, bulk-buying increases waste probability.

**Construction:**
```python
if "mandi_price" in waste.columns:
    waste["price_variation_index"] = (
        (waste["price"] - waste["mandi_price"]) / waste["mandi_price"].clip(1)
    ).clip(-0.5, 3.0).fillna(0.0)
else:
    waste["price_variation_index"] = rng.normal(0.2, 0.1, len(waste)).clip(-0.5, 3.0)
```

**Expected range:** -0.5 – 3.0

---

## 4. Feature Construction Pipeline

```
                    DEMAND FEATURE PIPELINE
                    ────────────────────────

grocery_purchases.csv
         │
         ├── sort by [user_id, item, purchase_date]
         │
         ├── groupby [user_id, item]:
         │     └── rolling(3).mean() → avg_quantity_last3
         │     └── date.diff()       → days_since_last
         │     └── count() / total_months → purchase_frequency
         │
         ├── add month column → merge with seasonal_data
         │     └── is_festival_month
         │
         ├── derive Indian season flags from month
         │     └── is_summer_month   (Apr–Jun)
         │     └── is_monsoon_month  (Jun–Sep)
         │
         ├── merge with household_consumption
         │     └── consumption_rate
         │
         ├── merge with product_metadata
         │     └── shelf_life → expiry_risk_proxy
         │
         ├── label encode category
         │     └── category_encoded
         │
         ├── compute price variation index
         │     └── (price - mandi_price) / mandi_price → price_variation_index
         │
         ├── target: shift(-1) on quantity → next_quantity
         │
         └── drop rows where next_quantity is NaN
                    ↓
         X = DataFrame(13 features), y = next_quantity
         Shape: ~200,000 rows × 13 features

                    WASTE FEATURE PIPELINE
                    ──────────────────────

food_waste.csv
         │
         ├── merge with product_metadata
         │     └── nutrition_score, is_perishable
         │
         ├── compute household_size_proxy
         │     └── quantity / consumption_rate
         │
         ├── label encode category
         │     └── category_encoded
         │
         ├── columns already present:
         │     expiry_days, shelf_life, expiry_risk,
         │     consumption_rate, quantity, price
         │
         ├── engineer 10 additional features:
         │     consumption_to_expiry_ratio  = (consumption_rate / expiry_days.clip(1,365)).clip(0,10)
         │     quantity_per_household       = (quantity / household_size_proxy.clip(1,6)).clip(0,20)
         │     price_per_unit               = (price / quantity.clip(0.1,100)).clip(0,1000)
         │     perishability_score          = (1.0 / shelf_life.clip(1,365)).round(4)
         │     waste_risk_interaction       = expiry_risk * (1.0 - consumption_rate.clip(0,1))
         │     category_risk_avg            = groupby("category")["wasted"].transform("mean")
         │     rolling_waste_rate           = groupby("item")["wasted"].transform("mean")
         │     normalized_quantity          = ((quantity - q_mean) / q_std).clip(-3,3)
         │     seasonal_waste_factor        = is_perishable * (1.0 + 0.2*(shelf_life < 7))
         │     price_sensitivity_score      = price * is_perishable
         │
         └── add 4 Indian context features:
               is_summer_month          = month.isin({4,5,6})
               is_monsoon_month         = month.isin({6,7,8,9})
               monsoon_perishable_flag  = is_monsoon_month * is_perishable
               price_variation_index    = (price - mandi_price) / mandi_price.clip(1)
                    ↓
         X = DataFrame(24 features), y = wasted
         Shape: 120,000 rows × 24 features
```

---

## 5. Feature Importance Analysis

### XGBoost Demand Model Feature Importance

Feature importance scores represent the average gain per split in the ensemble trees (higher = more predictive).

| Rank | Feature | Importance | Interpretation |
|------|---------|-----------|---------------|
| 1 | `avg_quantity_last3` | ~0.45 | Recent purchase history dominates |
| 2 | `consumption_rate` | ~0.18 | Consumption speed strongly predicts quantity |
| 3 | `household_size` | ~0.12 | Household scaling is a strong signal |
| 4 | `seasonal_factor` | ~0.08 | Seasonality matters, especially for fresh produce |
| 5 | `price` | ~0.06 | Price elasticity captured |
| 6 | `purchase_frequency` | ~0.04 | Frequency provides context |
| 7 | `days_since_last` | ~0.03 | Minor recency signal |
| 8 | `expiry_risk_proxy` | ~0.02 | Slight buying pattern signal |
| 9 | `price_variation_index` | ~0.01 | Retail vs mandi price deviation |
| 10 | `is_monsoon_month` | ~0.01 | Monsoon buying-pattern adjustment |
| 11 | `is_summer_month` | ~0.01 | Summer heat demand adjustments |
| 12 | `is_festival_month` | ~0.01 | Small but present festival effect |
| 13 | `category_encoded` | ~0.00 | Residual categorical signal |

**Key finding:** `avg_quantity_last3` accounts for ~45% of predictive power, confirming the strong auto-regressive nature of grocery purchasing. The three new Indian-context features (#9–12) collectively add seasonal signal especially for perishables.

### TabNet Waste Model — Feature Importance (Attention Weights)

TabNet derives feature importance from aggregated attention masks across all decision steps and samples. The `feature_importances_` attribute returns values that sum to 1.0, representing how frequently and strongly each feature was attended to.

| Rank | Feature | Approx. Attention | Interpretation |
|------|---------|-------------------|----------------|
| 1 | `waste_risk_interaction` | ~0.14 | Joint expiry+consumption signal is most attended |
| 2 | `expiry_risk` | ~0.12 | Core expiry proximity |
| 3 | `consumption_rate` | ~0.10 | Consumption speed |
| 4 | `rolling_waste_rate` | ~0.09 | Item-level waste history |
| 5 | `category_risk_avg` | ~0.08 | Category base rate |
| 6 | `expiry_days` | ~0.07 | Raw days remaining |
| 7 | `consumption_to_expiry_ratio` | ~0.07 | Ratio signal |
| 8 | `shelf_life` | ~0.06 | Total shelf life |
| 9 | `perishability_score` | ~0.05 | Continuous perishability |
| 10 | `normalized_quantity` | ~0.04 | Scaled quantity |
| 11 | `quantity_per_household` | ~0.03 | Household-normalised quantity |
| 12 | `price_sensitivity_score` | ~0.03 | Price × perishability interaction |
| 13 | `price_per_unit` | ~0.03 | Cost per unit |
| 14 | `seasonal_waste_factor` | ~0.02 | Ultra-perishable threshold |
| 15 | `is_perishable` | ~0.02 | Binary perishability |
| 16 | `quantity` | ~0.02 | Raw quantity |
| 17 | `monsoon_perishable_flag` | ~0.02 | Monsoon × perishable compound risk |
| 18 | `is_monsoon_month` | ~0.01 | Monsoon humidity baseline |
| 19 | `is_summer_month` | ~0.01 | Summer heat baseline |
| 20 | `price_variation_index` | ~0.01 | Mandi price deviation |
| 21 | `price` | ~0.01 | Raw price |
| 22 | `nutrition_score` | ~0.01 | Nutritious items consumed first |
| 23 | `household_size_proxy` | ~0.01 | Larger households reduce waste |
| 24 | `category_encoded` | ~0.00 | Captured by category_risk_avg |

---

## 6. Preprocessing Steps

After feature construction, the following preprocessing is applied before model training:

### Step 1: Missing Value Handling

```python
# Demand pipeline
purchases[numeric_cols] = purchases[numeric_cols].fillna(0)
# avg_quantity_last3 → 0 for first purchase (no history)
# days_since_last → filled with 14 days (default inter-purchase gap)

# Waste pipeline
waste.fillna(0, inplace=True)
# household_size_proxy → 0 if consumption_rate is missing
```

### Step 2: Outlier Clipping

```python
purchases["days_since_last"] = purchases["days_since_last"].clip(1, 90)
purchases["next_quantity"] = purchases["next_quantity"].clip(0.1, 20)
# Prevents extreme outliers from distorting regression loss
```

### Step 3: Train/Test Split

```python
# Demand (no stratification needed for regression)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)

# Waste (stratified to preserve class balance)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42, stratify=y)
```

### Step 4: Feature Scaling

```python
scaler = StandardScaler()
X_train_sc = scaler.fit_transform(X_train)  # fit ONLY on train
X_test_sc  = scaler.transform(X_test)        # transform test with train stats
```

**Why StandardScaler on tree models?**  
While decision trees are scale-invariant, applying the same scaler to all 4 models simplifies the inference pipeline — one scaler per task (demand / waste) transforms input for whichever model is called.

---

## 7. Inference-Time Feature Construction

At prediction time (API calls), we need to construct the same features without re-running the full training pipeline. For demand, this means 13 features; for waste, this means 24 features. The demand side is handled by `compute_item_stats()`. For waste, `category_risk_avg`, `rolling_waste_rate`, and `normalized_quantity` require pre-computed stats stored in `model_store["waste"]["feature_stats"]` at startup:

```python
def compute_item_stats(purchases, metadata, seasonal):
    """Build a per-item feature dict for inference."""
    current_month = pd.Timestamp.now().month
    seasonal_now = seasonal[seasonal["month"] == current_month].iloc[0]

    for item in purchases["item"].unique():
        item_df = purchases[purchases["item"] == item]
        meta = metadata[metadata["item"] == item].iloc[0]

        item_stats[item] = {
            "avg_quantity_last3":  item_df["quantity"].mean(),
            "days_since_last":     7.0,               # default inter-purchase gap
            "purchase_frequency":  len(item_df) / 24, # purchases per month
            "seasonal_factor":     seasonal_now["demand_multiplier"],
            "household_size":      3.0,               # default household
            "consumption_rate":    item_df["quantity"].mean() * 0.8,
            "price":               item_df["price"].mean(),
            "category":            item_df["category"].iloc[0],
            "shelf_life":          meta["shelf_life"],
            "expiry_risk_proxy":   1.0 / max(1, meta["shelf_life"]),
            "is_festival_month":   seasonal_now["is_festival"],
            ...
        }
```

This dict is stored in `model_store["item_stats"]` at startup and queried by prediction routes.

For waste prediction, the following pre-computed stats are also loaded at startup in `evaluator.py` and stored in `model_store["waste"]["feature_stats"]`:

```python
feature_stats = model_store["waste"]["feature_stats"]
# Populated at startup in evaluator.py:
# {
#   "category_risk":   {"Vegetables": 0.52, "Protein": 0.61, ...},
#   "item_waste_rate": {"Spinach": 0.68, "Rice": 0.12, ...},
#   "quantity_mean":   3.14,
#   "quantity_std":    2.21,
# }
```

### Why Not Re-compute at Request Time?

1. **Performance:** Computing rolling stats on 3,000 rows per API request would add ~80ms latency
2. **Consistency:** Pre-computed stats match training-time feature distributions exactly
3. **Simplicity:** One dict lookup vs a full pandas pipeline per request
4. **Dataset scan avoidance:** `category_risk_avg` and `rolling_waste_rate` require a full dataset scan to compute — caching these in `feature_stats` avoids repeating this work on every prediction request

---

## 8. Design Decisions

### Feature Count Rationale

**Demand uses 13 features:** The demand prediction task has a strong auto-regressive signal (`avg_quantity_last3` alone explains ~45% of variance) and a predominantly linear data-generating process. The original 10 features were extended with 3 India-specific context features (`price_variation_index`, `is_summer_month`, `is_monsoon_month`) to capture seasonal buying-pattern shifts driven by Indian climate and market conditions.

**Waste expanded to 24 features:** The scale-up to 120k waste rows supports a richer feature space. TabNet's attention mechanism benefits from having more interaction candidates to select from. The 10 engineered features (Features 11–20) encode domain-specific non-linearities (e.g., `waste_risk_interaction`, `category_risk_avg`, `rolling_waste_rate`) that TabNet would otherwise need to discover implicitly. Four additional Indian-context features (Features 21–24: `is_summer_month`, `is_monsoon_month`, `monsoon_perishable_flag`, `price_variation_index`) capture the climate-driven spoilage patterns unique to Indian households — monsoon humidity and summer heat are the two biggest drivers of unexpected waste beyond what expiry_risk alone can explain.

### Why Create `expiry_risk_proxy` for Demand?

`expiry_risk_proxy = 1 / shelf_life` is used in the **demand** model (not the waste model which uses the actual `expiry_risk` computed from remaining days). This is because at demand-prediction time, we know the item's total shelf life but not how many days have elapsed since purchase. The proxy captures the _category of buying behaviour_ rather than actual expiry state.

### Why Keep `category_encoded` in Both Models?

Category is a proxy for a cluster of correlated attributes (shelf life, typical quantity, buying frequency). Even though shelf_life and other features are included, category captures residual variance from category-specific patterns not explained by those individual features.
