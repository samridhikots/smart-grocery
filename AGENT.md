# AGENT.md — Smart Grocery Management System
## Context File for AI Assistants

> **CRITICAL RULE FOR EVERY FUTURE CHANGE:**
> Whenever you modify any code, model, dataset, feature, API field, or configuration in this project:
> 1. **Update this file (AGENT.md)** — reflect the change in the relevant section.
> 2. **Update the relevant doc(s) in `/docs/`** — every code change has a documentation counterpart.
>
> Never leave AGENT.md or the docs stale. They are the source of truth for future sessions.
 
---

## 1. Project Identity

| Field | Value |
|-------|-------|
| **Name** | Smart Grocery Management System |
| **Root** | `/Users/samridhi/Documents/Projects/smart-grocery/` |
| **Purpose** | Final-year engineering project — ML model comparison, demand forecasting, waste prediction, budget optimization |
| **Status** | Complete and runnable |
| **Backend port** | 8000 |
| **Frontend port** | 3000 |

---

## 2. How to Run

```bash
# Backend (auto-generates data + trains models on first run)
cd smart-grocery/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd smart-grocery/frontend
npm install
npm run dev
```

**First-run startup time:** ~10–15 minutes (TabNet training on 120k rows dominates).  
**Subsequent runs:** ~3–5 minutes (CSVs cached, only model retraining).  
**API docs:** http://localhost:8000/docs  
**Health check:** `GET /health` → `{"status": "healthy", "models_ready": true}`

---

## 3. Technology Stack

### Backend
| Package | Version | Role |
|---------|---------|------|
| fastapi | 0.109.0 | REST API framework |
| uvicorn[standard] | 0.27.0 | ASGI server |
| sqlalchemy | 2.0.25 | SQLite ORM |
| pandas | 2.1.4 | Feature engineering |
| numpy | 1.26.3 | Data generation, array ops |
| scikit-learn | 1.4.0 | LinearRegression, LogisticRegression, StandardScaler, confusion_matrix |
| xgboost | 2.0.3 | Demand prediction (modern model) |
| scipy | 1.12.0 | Statistical utilities |
| pydantic | 2.5.3 | Request/response validation |
| python-multipart | 0.0.6 | Form data handling |
| torch | ≥2.0.0 | TabNet backend |
| pytorch-tabnet | ≥4.1.0 | TabNet waste classifier |

### Frontend
| Package | Role |
|---------|------|
| Next.js 14 (App Router) | React framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Recharts | Charts (BarChart, RadarChart, LineChart) |
| Lucide React | Icons |

---

## 4. Project File Map

```
smart-grocery/
├── AGENT.md                              ← THIS FILE — update on every change
├── docs/
│   ├── 01_PROJECT_OVERVIEW.md
│   ├── 02_DATASETS.md
│   ├── 03_FEATURE_ENGINEERING.md
│   ├── 04_ML_MODELS.md
│   ├── 05_BACKEND.md
│   ├── 06_FRONTEND.md
│   ├── 07_API_REFERENCE.md
│   ├── 08_END_TO_END_FLOW.md
│   └── 09_MODEL_COMPARISON.md
│
├── backend/
│   ├── requirements.txt
│   ├── grocery.db                        ← auto-created SQLite
│   └── app/
│       ├── main.py                       ← FastAPI app + lifespan (startup)
│       ├── database/db.py                ← SQLAlchemy setup, Purchase model
│       ├── datasets/
│       │   ├── generator.py              ← Synthetic data generation (6 CSVs)
│       │   └── loader.py                 ← CSV loaders → DataFrames
│       ├── models/
│       │   ├── demand/
│       │   │   ├── linear_model.py       ← Ridge Regression (legacy)
│       │   │   └── xgboost_model.py      ← XGBoost Regressor (modern)
│       │   └── waste/
│       │       ├── logistic_model.py     ← Logistic Regression (legacy) + confusion_matrix
│       │       └── tabnet_model.py       ← TabNet Classifier (modern) + confusion_matrix
│       ├── routes/
│       │   ├── grocery.py                ← GET /purchases, POST /add-purchase, GET /items
│       │   ├── prediction.py             ← GET /predict-demand, GET /predict-waste
│       │   ├── optimization.py           ← POST /optimize-budget, GET /generate-plan
│       │   └── comparison.py             ← GET /compare-models
│       ├── services/
│       │   ├── feature_engineering.py    ← build_demand_features(), build_waste_features(), compute_item_stats()
│       │   ├── data_processing.py        ← scale_features() → StandardScaler
│       │   ├── evaluator.py              ← train_all_models() — full training orchestrator
│       │   └── budget_optimizer.py       ← fractional knapsack
│       └── utils/
│           ├── helpers.py                ← ITEMS catalog, get_seasonal_factor(), FESTIVAL_MONTHS
│           └── store.py                  ← model_store singleton (global registry)
│
└── frontend/
    ├── app/
    │   ├── layout.tsx                    ← Root layout + Navbar
    │   ├── page.tsx                      ← Landing page
    │   ├── dashboard/page.tsx            ← Overview: spend charts + waste alerts
    │   ├── add/page.tsx                  ← Purchase recording form
    │   ├── recommendations/page.tsx      ← Demand / Waste / Budget tabs
    │   └── comparison/page.tsx           ← Model metrics + confusion matrix + feature importance
    ├── components/
    │   ├── Navbar.tsx
    │   ├── Chart.tsx                     ← BarChartComponent, RadarChartComponent, LineChartComponent
    │   ├── Table.tsx                     ← Generic typed table with optional render fn
    │   └── Form.tsx                      ← Purchase input form
    ├── services/api.ts                   ← All API calls + TypeScript types
    └── lib/constants.ts                  ← CATEGORIES, CATEGORY_COLORS, RISK_COLORS
```

---

## 5. Datasets (Current State)

All CSVs live in `backend/app/datasets/data/`. Generated automatically at startup if missing. Pass `force=True` to `generate_all_datasets()` to regenerate.

| File | Rows | Key Constants | Purpose |
|------|------|--------------|---------|
| `grocery_purchases.csv` | 200,000 | N_USERS=200, 3 years (2022–2025), PURCHASE_CAP=200_000 | Demand model training |
| `food_waste.csv` | 120,000 | WASTE_ROWS=120_000 | Waste model training |
| `retail_transactions.csv` | ~3,200 | N_USERS=200 | Purchase frequency context |
| `product_metadata.csv` | 30 | One row per item | Shelf life, nutrition, priority |
| `household_consumption.csv` | 2,160 | 6 sizes × 30 items × 12 months | Consumption rate lookup |
| `seasonal_data.csv` | 12 | One row per month | Seasonal demand multipliers |

**Generation constants** (in `generator.py`):
```python
N_USERS = 200
START_DATE = datetime(2022, 1, 1)
END_DATE   = datetime(2025, 1, 1)
PURCHASE_CAP = 200_000
WASTE_ROWS   = 120_000
```

**Item catalog:** 30 items across 6 categories (Vegetables, Fruits, Dairy, Grains, Protein, Beverages). Defined in `utils/helpers.py → ITEMS`.

**Festival months:** 1 (New Year), 3 (Holi), 10 (Dussehra), 11 (Diwali) — `FESTIVAL_MONTHS` in helpers.py.

---

## 6. Feature Engineering

### Demand Features (10) — `build_demand_features()`

| # | Feature | Source | Notes |
|---|---------|--------|-------|
| 1 | `avg_quantity_last3` | purchases | Rolling mean, shift(1) prevents leakage |
| 2 | `days_since_last` | purchases | Clipped 1–90 |
| 3 | `purchase_frequency` | purchases | n_purchases / total_months (computed dynamically from date span) |
| 4 | `seasonal_factor` | purchases (already present) | From generator |
| 5 | `household_size` | purchases | 1–6 |
| 6 | `consumption_rate` | household_consumption join | Avg usage rate per household_size × item |
| 7 | `price` | purchases | ±12% variance |
| 8 | `category_encoded` | purchases | Veg=0, Fruit=1, Dairy=2, Grain=3, Protein=4, Bev=5 |
| 9 | `expiry_risk_proxy` | metadata | 1 / shelf_life |
| 10 | `is_festival_month` | seasonal | Binary |

**Target:** `next_quantity` (next purchase qty per user-item pair, shift(-1), clipped 0.1–20)

### Waste Features (20) — `build_waste_features()`

**Base (10):**

| # | Feature | Source |
|---|---------|--------|
| 1 | `expiry_days` | food_waste.csv |
| 2 | `shelf_life` | metadata join |
| 3 | `expiry_risk` | food_waste.csv (precomputed: `1 - expiry_days/shelf_life`) |
| 4 | `consumption_rate` | food_waste.csv |
| 5 | `quantity` | food_waste.csv |
| 6 | `price` | food_waste.csv |
| 7 | `household_size_proxy` | computed: `clip(qty / consumption_rate, 1, 6)` |
| 8 | `nutrition_score` | metadata join |
| 9 | `is_perishable` | metadata join (shelf_life ≤ 14) |
| 10 | `category_encoded` | waste.category |

**Engineered (10):**

| # | Feature | Formula |
|---|---------|---------|
| 11 | `consumption_to_expiry_ratio` | `(consumption_rate / expiry_days.clip(1,365)).clip(0,10)` |
| 12 | `quantity_per_household` | `(quantity / household_size_proxy.clip(1,6)).clip(0,20)` |
| 13 | `price_per_unit` | `(price / quantity.clip(0.1,100)).clip(0,50)` |
| 14 | `perishability_score` | `(1.0 / shelf_life.clip(1,365)).round(4)` |
| 15 | `waste_risk_interaction` | `expiry_risk * (1.0 - consumption_rate.clip(0,1))` |
| 16 | `category_risk_avg` | `groupby("category")["wasted"].transform("mean")` |
| 17 | `rolling_waste_rate` | `groupby("item")["wasted"].transform("mean")` |
| 18 | `normalized_quantity` | `((quantity - q_mean) / q_std).clip(-3, 3)` |
| 19 | `seasonal_waste_factor` | `is_perishable * (1.0 + 0.2*(shelf_life < 7))` |
| 20 | `price_sensitivity_score` | `price * is_perishable` |

**Target:** `wasted` (binary 0/1)

### Inference-Time Feature Stats (stored in model_store at startup)

`model_store["waste"]["feature_stats"]` is populated in `evaluator.py` from `waste_raw`:
```python
{
    "category_risk":  {"Vegetables": 0.52, ...},  # groupby category → mean(wasted)
    "item_waste_rate": {"Spinach": 0.68, ...},     # groupby item → mean(wasted)
    "quantity_mean":  3.14,
    "quantity_std":   2.21,
}
```
Used in `prediction.py → _waste_row()` to reconstruct features 16, 17, 18 at inference time without re-running pandas.

---

## 7. ML Models (Current State)

### Model Overview

| Task | Type | Legacy | Modern |
|------|------|--------|--------|
| Demand | Regression | Ridge Linear Regression | XGBoost Regressor |
| Waste | Classification | Logistic Regression | TabNet Classifier |

**Train/test split:** 80/20 for demand; 80/20 stratified for waste.  
**Scaler:** StandardScaler fit on train only, transform applied to both. One scaler per task (demand / waste).

### Demand Models

**Linear (`DemandLinearModel`):**
```python
Ridge(alpha=1.0)
```

**XGBoost (`DemandXGBoostModel`):**
```python
XGBRegressor(n_estimators=200, max_depth=5, learning_rate=0.08, subsample=0.8, colsample_bytree=0.8, random_state=42)
```

**Metrics (approximate, on ~40k test rows):** Linear wins on this synthetic dataset (linear data-generating process).
- Linear: MAE ~0.26, R² ~0.86
- XGBoost: MAE ~0.29, R² ~0.82

### Waste Models

**Logistic (`WasteLogisticModel`):**
```python
LogisticRegression(max_iter=1000, C=1.0, random_state=42, class_weight="balanced")
```
Returns `confusion_matrix: {tn, fp, fn, tp}` in metrics.

**TabNet (`WasteTabNetModel`):**
```python
TabNetClassifier(
    n_d=16, n_a=16, n_steps=5, gamma=1.5,
    optimizer_fn=torch.optim.Adam,
    optimizer_params={"lr": 0.02},
    mask_type="entmax",
    verbose=0,
)
# fit params: max_epochs=50, patience=10, batch_size=256, virtual_batch_size=128
# internal val split: 15% of training set, stratified
```
Returns `feature_importances_` (attention mask aggregation) and `confusion_matrix: {tn, fp, fn, tp}` in metrics.

**Metrics (approximate, on ~24k test rows):** TabNet wins with 120k training rows.
- Logistic: F1 ~0.63, ROC-AUC ~0.70
- TabNet: F1 ~0.71, ROC-AUC ~0.78

---

## 8. Global Model Registry (`store.py`)

```python
model_store = {
    "demand": {
        "linear":       <DemandLinearModel>,
        "xgboost":      <DemandXGBoostModel>,
        "scaler":       <StandardScaler>,
        "feature_names": [10 feature names],
        "metrics": {
            "linear":  {split, mae, rmse, r2, directional_accuracy},
            "xgboost": {split, mae, rmse, r2, directional_accuracy},
        },
    },
    "waste": {
        "logistic":      <WasteLogisticModel>,
        "tabnet":        <WasteTabNetModel>,
        "scaler":        <StandardScaler>,
        "feature_names": [20 feature names],
        "feature_stats": {
            "category_risk":   {category → float},
            "item_waste_rate": {item → float},
            "quantity_mean":   float,
            "quantity_std":    float,
        },
        "metrics": {
            "logistic": {split, accuracy, precision, recall, f1, roc_auc, confusion_matrix},
            "tabnet":   {split, accuracy, precision, recall, f1, roc_auc, confusion_matrix},
        },
    },
    "item_stats": {item_name: {10 inference features per item}},
    "initialized": bool,
}
```

---

## 9. API Contract (Current Field Names)

### `GET /api/predict-waste`
```json
{
  "waste_alerts": [{
    "item": "Spinach",
    "category": "Vegetables",
    "waste_probability_tabnet": 0.741,
    "waste_probability_logistic": 0.683,
    "risk_level": "High",
    "days_until_expiry": 2,
    "recommendation": "...",
    "shelf_life": 5
  }],
  "high_risk_count": 7
}
```
Risk driven by `waste_probability_tabnet`. Sorted by `waste_probability_tabnet` desc.

### `GET /api/predict-demand`
```json
{
  "predictions": [{
    "item": "Milk",
    "predicted_quantity_xgboost": 2.41,
    "predicted_quantity_linear": 2.38,
    "historical_avg": 2.31,
    "confidence": 0.92,
    "recommended_quantity": 2.41,
    "unit_price": 2.5,
    "days_until_next": 8,
    "seasonal_factor": 1.02
  }],
  "model_used": "XGBoost (modern)",
  "total_items": 30
}
```

### `GET /api/compare-models`
Feature importance keys: `demand_xgboost` (10 features), `waste_tabnet` (20 features).  
Both waste model metrics include `confusion_matrix: {tn, fp, fn, tp}`.  
Modern waste model name: `"TabNet Classifier"`.

### `POST /api/optimize-budget`
Body: `{budget, household_size, preferred_categories?}`

### `GET /api/generate-plan`
Query: `household_size`

---

## 10. Frontend State (Current Field Names)

### `services/api.ts` key types

```typescript
interface WasteAlert {
  waste_probability_tabnet: number;   // was: waste_probability_rf (CHANGED)
  waste_probability_logistic: number;
  risk_level: "High" | "Medium" | "Low";
  // ...
}

interface ConfusionMatrix { tn: number; fp: number; fn: number; tp: number; }

interface ModelMetrics {
  // ...standard metrics...
  confusion_matrix?: ConfusionMatrix;  // present for waste models
}

interface ComparisonResult {
  feature_importance: {
    demand_xgboost: Record<string, number>;
    waste_tabnet: Record<string, number>;   // was: waste_rf (CHANGED)
  };
}
```

### Key frontend pages

| Page | Data used | Notes |
|------|----------|-------|
| `dashboard/page.tsx` | `WasteAlert.waste_probability_tabnet` | Freshness score = `1 - waste_probability_tabnet` |
| `recommendations/page.tsx` | Chart key `"TabNet Probability"`, table column `waste_probability_tabnet` | Was "RF Probability" |
| `comparison/page.tsx` | `fi.waste_tabnet`, `ConfusionMatrixDisplay` component, TabNet bar label | Was `fi.waste_rf`, no confusion matrix |

---

## 11. Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Model storage | Module-level singleton `model_store` | Avoids ~200ms per-request model loading |
| Scaler scope | One scaler per task, applied to all models in that task | All models receive identical input |
| `total_months` | Computed dynamically from `purchases["purchase_date"]` date span | Not hardcoded to 24; works for any dataset time range |
| Waste feature stats | Pre-computed at startup, stored in `model_store["waste"]["feature_stats"]` | `category_risk_avg`, `rolling_waste_rate`, `normalized_quantity` need global stats; avoids pandas re-scan per request |
| TabNet val split | 15% internal split inside `model.fit()` for `eval_set` | Allows `patience=10` early stopping; not counted as part of sklearn test split |
| Confusion matrix | Returned as `{tn, fp, fn, tp}` dict in all waste model metrics | Surfaced in `GET /compare-models` and rendered in `comparison/page.tsx` |
| Data generation cap | `PURCHASE_CAP = 200_000` with early loop exit | Prevents unbounded list growth before DataFrame creation |
| food_waste RNG | `np.random.default_rng(42)` (Generator API) | Faster than legacy `np.random.*` for 120k iterations |
| `_waste_row()` signature | Takes `(item: str, stats: dict, quantity: float)` | `item` needed to look up `feature_stats["item_waste_rate"]` |

---

## 12. Known Past Bugs (Do Not Repeat)

1. **`seasonal_factor` column collision** — `grocery_purchases.csv` already has `seasonal_factor` from the generator. When merging seasonal dataset, only bring `is_festival` flag; do NOT rename `demand_multiplier` to `seasonal_factor` or you get `_x`/`_y` suffix columns.

2. **`fillna(0)` on datetime columns** — Only fill numeric columns: `purchases[purchases.select_dtypes(include="number").columns] = ...fillna(0)`. Calling `fillna(0)` on the whole DataFrame raises a FutureWarning and corrupts datetime columns.

3. **TabNet data type** — Always cast to `np.float32` for TabNet input and `np.int64` for labels. Regular numpy float64 arrays cause type errors inside pytorch-tabnet.

4. **`_waste_row()` feature count** — Must return exactly 20 values matching `WASTE_FEATURES` list order. Adding or removing a feature here without updating the list causes a scaler shape mismatch at runtime.

---

## 13. Documentation Files — What Each Covers

| File | Topics to Update When... |
|------|-------------------------|
| `01_PROJECT_OVERVIEW.md` | Tech stack changes, model changes, dataset size changes, project structure changes |
| `02_DATASETS.md` | Generator constants (N_USERS, dates, caps), CSV schemas, row counts |
| `03_FEATURE_ENGINEERING.md` | Feature added/removed, formula changes, inference-time feature construction |
| `04_ML_MODELS.md` | Model replaced/added, hyperparameters changed, training pipeline changes, model_store schema |
| `05_BACKEND.md` | New routes, service logic changes, startup sequence |
| `06_FRONTEND.md` | New pages, component changes, API field renames in frontend |
| `07_API_REFERENCE.md` | Any change to request/response shapes, field names, new endpoints |
| `08_END_TO_END_FLOW.md` | Startup sequence changes, request flow changes |
| `09_MODEL_COMPARISON.md` | Metric values, model names, feature importance, comparison logic |

---

## 14. Maintenance Instructions for Future AI Sessions

When you receive this file at the start of a session, you now have full project context. Follow these rules:

### Before making any change
- Read the relevant source files first — don't rely on AGENT.md alone for exact code.
- Check if the change affects API field names (propagates to frontend types in `api.ts`).
- Check if the change affects the `model_store` schema (propagates to all routes that read it).

### After making any change
1. **Update AGENT.md** — find the relevant section(s) and update them. This is non-negotiable.
2. **Update the relevant `/docs/` files** — see the table in Section 13.
3. If you add a model: update Sections 6, 7, 8, 9, and docs 01, 04, 07, 09.
4. If you add/remove a feature: update Sections 6, 9, and docs 03, 04, 07, 09.
5. If you change a dataset size: update Section 5, and docs 01, 02, 04.
6. If you rename an API field: update Section 9, the frontend `api.ts` types, and doc 07.

### Style rules for this project
- No comments in code unless WHY is non-obvious.
- No backwards-compatibility shims — just change and update docs.
- Frontend uses `"use client"` on all data-fetching pages.
- All chart data keys must match the field names in the API response exactly.
