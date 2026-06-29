# End-to-End Flow Documentation
## Smart Grocery Management System

---

## Table of Contents

0. [Authentication & Onboarding Flow](#0-authentication--onboarding-flow)
1. [System Startup Flow](#1-system-startup-flow)
2. [Demand Prediction Flow (with Explainability)](#2-demand-prediction-flow)
3. [Waste Prediction Flow](#3-waste-prediction-flow)
4. [Budget Optimization Flow](#4-budget-optimization-flow)
5. [Model Comparison Flow](#5-model-comparison-flow)
6. [Add Purchase Flow](#6-add-purchase-flow)
7. [Dashboard — Budget Bar & Spend Trend](#7-dashboard--budget-bar--spend-trend)
8. [Insights — Top 3 Actions & Anomaly Chart](#8-insights--top-3-actions--anomaly-chart)
9. [Cross-Component Interactions](#9-cross-component-interactions)
10. [Full Request Lifecycle](#10-full-request-lifecycle)

---

## 0. Authentication & Onboarding Flow

```
            USER REGISTRATION & ONBOARDING
            ═══════════════════════════════

  User visits /auth/signup
         │
         ▼ [Browser] POST /api/auth/signup
  { name, email, password }
         │
         ▼ [Backend — auth.py]
  hash_password(password) → bcrypt hash
  INSERT INTO users (name, email, password_hash, ...) → id=1
  create_access_token(user_id=1) → JWT (30-day expiry)
         │
         ▼ [Response]
  { access_token: "eyJ...", user: { onboarding_complete: false } }
         │
         ▼ [Frontend — AuthContext]
  localStorage.setItem("sg_token", access_token)
  setUser(user)                  ← user.onboarding_complete = false
         │
         ▼ [OnboardingModal renders]
  Step 1: Household size (1–15, +/− stepper)
  Step 2: Monthly budget (₹ input + ₹1500/3000/5000/8000 presets)
  Step 3: Dietary prefs (Vegetarian / Non-Veg / Vegan / Jain / GF chips)
         │
         ▼ [PUT /api/auth/onboarding — Bearer token]
  { household_size: 4, monthly_budget: 5000, dietary_prefs: "Vegetarian" }
         │
         ▼ [Backend]
  UPDATE users SET household_size=4, monthly_budget=5000,
                   dietary_prefs="Vegetarian", onboarding_complete=1
  WHERE id = <from JWT>
         │
         ▼ [Frontend]
  setUser({ ...user, onboarding_complete: true })
  Modal closes → user sees Dashboard

  ────────────────────────────────────────────

  SUBSEQUENT VISITS (token in localStorage)
         │
         ▼ [AuthContext mount]
  token = localStorage.getItem("sg_token")
  GET /api/auth/me  (Authorization: Bearer token)
         │
         ▼ [Backend decodes JWT → user_id → DB lookup]
  setUser(user)     ← restores full session, no re-login needed
         │
         ▼ User sees their dashboard directly
```

**Token lifecycle:**  
- 30-day expiry encoded in the JWT payload (`"exp"` claim)  
- On 401 from `/auth/me`: `logout()` is called — clears token, redirects to `/auth/signin`

---

## 1. System Startup Flow

The most critical flow — everything depends on this completing successfully.

```
                    SERVER STARTUP
                    ══════════════

User runs: uvicorn app.main:app --reload --port 8000
                         │
                         ▼
          ┌──────────────────────────┐
          │  FastAPI app created     │
          │  + CORS middleware       │
          │  + 4 routers registered  │
          └──────────┬───────────────┘
                     │
                     ▼ lifespan(startup)
                     │
          ┌──────────────────────────┐
          │  create_tables()          │
          │  ┌────────────────────┐  │
          │  │ grocery.db exists? │  │
          │  │  Yes → skip        │  │
          │  │  No  → CREATE TABLE│  │
          │  └────────────────────┘  │
          └──────────┬───────────────┘
                     │
                     ▼
          ┌──────────────────────────────────┐
          │  generate_all_datasets()          │
          │                                  │
          │  For each of 6 datasets:          │
          │  ┌──────────────────────────┐    │
          │  │ CSV file exists?          │    │
          │  │  Yes → log "skipping"    │    │
          │  │  No  → generate & save   │    │
          │  └──────────────────────────┘    │
          │                                  │
          │  Outputs:                         │
          │  ✓ grocery_purchases.csv  3000 r  │
          │  ✓ food_waste.csv         1200 r  │
          │  ✓ retail_transactions.csv ~760r  │
          │  ✓ product_metadata.csv    30 r   │
          │  ✓ household_consumption  2160 r  │
          │  ✓ seasonal_data.csv        12 r  │
          └──────────┬───────────────────────┘
                     │
                     ▼
          ┌──────────────────────────────────────────┐
          │  train_all_models()                       │
          │                                          │
          │  1. build_demand_features()              │
          │     Load: purchases + household +        │
          │           seasonal + metadata            │
          │     Engineer: 13 features                │
          │     Output: X(≈200k×13), y(≈200k)        │
          │                                          │
          │  2. build_waste_features()               │
          │     Load: food_waste + metadata          │
          │     Engineer: 24 features                │
          │     Output: X(120k×24), y(120k)          │
          │                                          │
          │  3. Train/test split (80/20)             │
          │     + StandardScaler (fit on train only) │
          │                                          │
          │  4. Train Ridge Regression  < 100ms      │
          │  5. Train XGBoost           ~5–8s        │
          │  6. Train Logistic Reg      < 100ms      │
          │  7. Train TabNet            ~3–8min       │
          │  8. Train Isolation Forest  < 2s         │
          │  9. Train FP-Growth         ~5–15s       │
          │ 10. Build Sustainability tracker         │
          │                                          │
          │ 11. Evaluate supervised models on test   │
          │ 12. compute_item_stats() → item_stats    │
          │ 13. model_store["initialized"] = True    │
          └──────────┬───────────────────────────────┘
                     │
                     ▼
          INFO: All 7 models ready.
          INFO: Uvicorn running on http://127.0.0.1:8000
          (Cold startup: ~10–15 min | Cached: < 5s)
```

---

## 2. Demand Prediction Flow

Triggered by: User visits `/recommendations` → Demand tab  
API endpoint: `GET /api/predict-demand`

```
                DEMAND PREDICTION
                ═════════════════

  Browser                FastAPI                model_store
     │                      │                       │
     │  GET /predict-demand  │                       │
     │─────────────────────>│                       │
     │                      │                       │
     │                      │ model_store           │
     │                      │ ["initialized"]?      │
     │                      │───────────────────>   │
     │                      │<── True               │
     │                      │                       │
     │                      │  For each of 30 items:│
     │                      │                       │
     │                      │  1. stats = item_stats["Tomato"]
     │                      │     {avg_quantity_last3: 2.31,
     │                      │      days_since_last: 7.0,
     │                      │      purchase_frequency: 3.71,
     │                      │      seasonal_factor: 1.02,
     │                      │      household_size: 3.0,
     │                      │      consumption_rate: 1.85,
     │                      │      price: 2.5,
     │                      │      category_encoded: 0,
     │                      │      expiry_risk_proxy: 0.1429,
     │                      │      is_festival_month: 0}
     │                      │
     │                      │  2. row = array([10 values])
     │                      │
     │                      │  3. row_sc = demand_scaler.transform(row)
     │                      │
     │                      │  4. xgb_pred = demand_xgboost.predict(row_sc)
     │                      │     → 3.29
     │                      │
     │                      │  5. lin_pred = demand_linear.predict(row_sc)
     │                      │     → 3.31
     │                      │
     │                      │  6. confidence = computed from
     │                      │     |xgb_pred - historical_avg| / historical_avg
     │                      │     → 0.85
     │                      │
     │                      │  7. days_until_next = 30 / purchase_frequency
     │                      │     → 8 days
     │                      │
     │  JSON Response        │
     │<─────────────────────│
     │  {predictions: [...]} │

  Frontend receives:
  ┌─────────────────────────────────────────────────────────┐
  │  item: "Tomato"                                          │
  │  predicted_quantity_xgboost: 3.29                        │
  │  predicted_quantity_linear: 3.31                         │
  │  historical_avg: 2.31                                    │
  │  confidence: 0.85                                        │
  │  recommended_quantity: 3.29  ← XGBoost value used        │
  │  unit_price: 2.5                                         │
  │  days_until_next: 8                                      │
  │  seasonal_factor: 1.02                                   │
  └─────────────────────────────────────────────────────────┘

  Frontend renders:
  ┌────────────────────────────────────────────────────────┐
  │  BAR CHART: XGBoost vs Linear vs Historical (top 12)   │
  │                                                        │
  │  EXPLAINABLE CARDS (3-column grid):                   │
  │  ┌─────────────────────────────────────────┐          │
  │  │ Tomato               Vegetables          │          │
  │  │ "Buy in 8 days"                  × 3.29 │          │
  │  │ ████████████░░░░  86% confidence  ₹132  │          │
  │  │ [High seasonal demand] [High confidence] │          │
  │  │ "Why this recommendation?" ▼             │          │
  │  │   Historical avg: ×2.31                  │          │
  │  │   XGBoost pred:   ×3.29                  │          │
  │  │   Seasonal factor: 1.35×                 │          │
  │  │   Festival month:  No                    │          │
  │  └─────────────────────────────────────────┘          │
  └────────────────────────────────────────────────────────┘
```

---

## 3. Waste Prediction Flow

Triggered by: User visits `/recommendations` → Waste tab OR `/dashboard`  
API endpoint: `GET /api/predict-waste`

```
              WASTE PREDICTION
              ════════════════

  For each item in item_stats (30 items):

  Step 1: Construct waste feature row
  ┌─────────────────────────────────────────┐
  │  shelf = stats["shelf_life"]            │
  │  expiry_days = max(1, shelf × 0.7)      │  ← 70% of shelf life remaining
  │  expiry_risk = 1 - expiry_days/shelf    │
  │  consumption_rate = stats[...]          │
  │  quantity = stats["avg_quantity_last3"] │
  │  nutrition_score = stats[...]           │
  │  is_perishable = stats[...]             │
  │  household_size_proxy = qty/consump_rate│
  │  category_encoded = 0 (Vegetables)      │
  └─────────────────────────────────────────┘

  Step 2: Scale
  row_sc = waste_scaler.transform(row)

  Step 3: Predict with both models
  rf_prob    = rf_model.predict_proba(row_sc)[0,1]
  logit_prob = logistic_model.predict_proba(row_sc)[0,1]

  Step 4: Classify risk
  if rf_prob > 0.60  → "High"
  if rf_prob > 0.35  → "Medium"
  else               → "Low"

  Step 5: Generate recommendation
  ┌────────────────────────────────────────────────────┐
  │ High:   "Use Spinach within 2 days — high risk!"   │
  │ Medium: "Plan meals with Carrot this week."        │
  │ Low:    "Rice has low waste risk, normal use fine" │
  └────────────────────────────────────────────────────┘

  Results sorted by rf_prob descending (worst first):
  ┌─────────────────────────────────────────────────────┐
  │ 1. Spinach     rf_prob: 0.72  → HIGH    (shelf: 5d) │
  │ 2. Chicken     rf_prob: 0.61  → HIGH    (shelf: 3d) │
  │ 3. Fish        rf_prob: 0.58  → MEDIUM  (shelf: 2d) │
  │ 4. Tomato      rf_prob: 0.38  → MEDIUM  (shelf: 7d) │
  │ 5. Banana      rf_prob: 0.35  → MEDIUM  (shelf: 7d) │
  │ ...                                                  │
  │ 30. Rice       rf_prob: 0.08  → LOW    (shelf: 365d)│
  └─────────────────────────────────────────────────────┘
```

---

## 4. Budget Optimization Flow

Triggered by: User sets budget on `/recommendations` → Budget tab and clicks "Optimize"  
API endpoint: `POST /api/optimize-budget`

```
              BUDGET OPTIMIZATION
              ═══════════════════

  Input:
  { budget: 80.0, household_size: 4, preferred_categories: ["Vegetables", "Dairy"] }

  Step 1: Filter items
  ┌──────────────────────────────────────────────────┐
  │  For each item in item_stats:                    │
  │    if preferred_categories specified:            │
  │      skip items not in preferred_categories      │
  └──────────────────────────────────────────────────┘

  Step 2: Compute value density for each item
  ┌──────────────────────────────────────────────────────┐
  │  scale  = household_size / 3.0 = 1.33               │
  │  qty    = avg_quantity × scale × seasonal_factor     │
  │  price  = avg_price                                  │
  │  value  = (priority_score × nutrition_score) / price │
  │                                                      │
  │  Tomato:  value = (8 × 8.34) / 2.50 = 26.69         │
  │  Milk:    value = (9 × 7.12) / 2.50 = 25.63         │
  │  Spinach: value = (8 × 8.45) / 1.50 = 45.07  ← high │
  │  Cheese:  value = (7 × 6.11) / 5.00 = 8.55   ← low  │
  └──────────────────────────────────────────────────────┘

  Step 3: Sort by value density (descending)
  [Spinach, Onion, Tomato, Milk, Eggs, Yogurt, Carrot, ...]

  Step 4: Greedy fractional knapsack
  ┌────────────────────────────────────────────────────────┐
  │  remaining = 80.00                                     │
  │                                                        │
  │  Spinach: needs $2.00 → remaining = 78.00 ✓ take full  │
  │  Onion:   needs $2.67 → remaining = 75.33 ✓ take full  │
  │  Tomato:  needs $6.65 → remaining = 68.68 ✓ take full  │
  │  Milk:    needs $6.67 → remaining = 62.01 ✓ take full  │
  │  Eggs:    needs $4.67 → remaining = 57.34 ✓ take full  │
  │  ...                                                   │
  │  Cheese:  needs $2.0 → remaining = 0.08  ← partial qty │
  │           take 0.02 kg (fractional)                    │
  └────────────────────────────────────────────────────────┘

  Output:
  ┌───────────────────────────────────────────────────────┐
  │  total_cost: 79.92, savings: 0.08                     │
  │  optimization_score: 0.946                            │
  │  items: [Spinach, Onion, Tomato, Milk, Eggs, ...]     │
  └───────────────────────────────────────────────────────┘
```

### Optimization Score Calculation

```python
total_priority = Σ priority_score_i × (take_qty_i / recommended_qty_i)
max_possible   = Σ priority_score_i  (for top-N items selected)
optimization_score = clip(total_priority / max_possible, 0, 1)
```

A score of 0.946 means we delivered 94.6% of the theoretically maximum priority within the budget.

---

## 5. Model Comparison Flow

Triggered by: User visits `/comparison`  
API endpoint: `GET /api/compare-models`

```
            MODEL COMPARISON
            ════════════════

  GET /compare-models
        │
        ▼
  Read from model_store (already populated at startup):
  ┌─────────────────────────────────────────────────────────┐
  │  DEMAND METRICS (test set, 20% of ~6000 rows = 1200 rows)│
  │                                                          │
  │  linear_metrics  = {mae: 0.2607, rmse: 0.418, r2: 0.864}│
  │  xgboost_metrics = {mae: 0.2885, rmse: 0.487, r2: 0.816}│
  │                                                          │
  │  winner = argmax(r2) → "Ridge Linear Regression"         │
  │  improvement = {mae_reduction: -0.028, r2_gain: -0.048}  │
  └─────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────────┐
  │  WASTE METRICS (test set, 20% of 1200 rows = 240 rows)  │
  │                                                          │
  │  logistic_metrics = {acc: 0.638, f1: 0.584, auc: 0.653} │
  │  rf_metrics       = {acc: 0.629, f1: 0.548, auc: 0.644} │
  │                                                          │
  │  winner = argmax(f1) → "Logistic Regression"             │
  │  improvement = {f1_gain: -0.036, auc_gain: -0.009}       │
  └─────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────────┐
  │  FEATURE IMPORTANCE                                     │
  │                                                         │
  │  demand_xgboost = model_store["demand"]["xgboost"]      │
  │    .feature_importance(feature_names)                   │
  │  waste_rf = model_store["waste"]["random_forest"]       │
  │    .feature_importance(feature_names)                   │
  └─────────────────────────────────────────────────────────┘

  Frontend renders:
  ┌────────────────────────────────────────────────────────┐
  │  ┌────────────────┐  ┌────────────────┐               │
  │  │ Demand Winner  │  │ Waste Winner   │               │
  │  │ Ridge Linear   │  │ Logistic Reg   │               │
  │  └────────────────┘  └────────────────┘               │
  │                                                        │
  │  MetricCard × 4   Bar chart (demand)                   │
  │  RadarChart       Bar chart (waste)                    │
  │                                                        │
  │  Feature importance bars (XGBoost + RF)                │
  │  Full metrics table (all 4 models)                     │
  └────────────────────────────────────────────────────────┘
```

---

## 6. Add Purchase Flow

Triggered by: User types in the fuzzy-search autocomplete on `/add` and clicks "Add Purchase"

```
             ADD PURCHASE FLOW
             ═════════════════

  User types in autocomplete:
  ┌──────────────────────────────────────────┐
  │ 🔍 "tom"                                 │
  │ ┌────────────────────────────────────┐   │
  │ │ Tomato          [Vegetables]       │   │← dropdown appears
  │ └────────────────────────────────────┘   │
  │ → click → item="Tomato", cat="Vegetables"│
  │                                          │
  │ Quantity: 1.5                            │
  │ Price:    37.50                          │
  │ Date:     2026-05-10                     │
  └──────────────────────────────────────────┘

  Form.tsx handleSubmit():
  1. Client-side validation (item + category + quantity + price non-empty)
  2. Parse quantity/price to float
  3. api.addPurchase({...})  ← Authorization: Bearer token auto-injected
       ↓
  POST /api/add-purchase
  Headers: Authorization: Bearer <jwt>
       ↓
  get_current_user_id(credentials) → user_id = 1  (from JWT)
  Pydantic validates body (quantity > 0, price > 0)
       ↓
  SQLAlchemy creates PurchaseRecord:
  ┌─────────────────────────────────────┐
  │ INSERT INTO purchases               │
  │ (user_id, item, category, quantity, │
  │  price, purchase_date)              │
  │ VALUES (1, 'Tomato', 'Vegetables',  │
  │         1.5, 37.50, '2026-05-10')   │
  └─────────────────────────────────────┘
       ↓
  201 Created → {id: 43, item: "Tomato", ...}
       ↓
  Form.tsx:
  - Shows success message "Added 1.5 × Tomato to your purchases!"
  - Resets form to initial state
  - Calls onSuccess() → fetchPurchases() → Table refreshes

  Note: New user purchases are stored but do NOT automatically
  retrain the ML models. They are used for display only.
  To incorporate user data into predictions, the system would
  need a retraining endpoint (future enhancement).
```

---

## A. Weekly Plan Generation Flow (Legacy Endpoint)

Triggered by: `GET /api/generate-plan?household_size=3`

```
           WEEKLY PLAN GENERATION
           ══════════════════════

  Input: household_size = 3

  Step 1: Categorize all 30 items by perishability
  ┌──────────────────────────────────────────────────────┐
  │ perishables (shelf_life ≤ 7):                        │
  │   Tomato(7), Spinach(5), Broccoli(7), Cucumber(7),   │
  │   Bell Pepper(7), Banana(7), Mango(7), Grapes(7),    │
  │   Milk(7), Bread(7), Juice(7), Chicken(3), Fish(2)   │
  │                                                      │
  │ semi_perishables (8 ≤ shelf_life ≤ 30):              │
  │   Potato(30), Onion(30), Carrot(14), Apple(14),      │
  │   Orange(14), Cheese(21), Yogurt(14), Eggs(21),      │
  │   Butter(30)                                         │
  │                                                      │
  │ non_perishables (shelf_life > 30):                   │
  │   Rice(365), Wheat Flour(180), Pasta(365), Oats(365) │
  │   Lentils(365), Beans(365), Coffee(180), Tea(365)    │
  └──────────────────────────────────────────────────────┘

  Step 2: Assign to shopping days
  ┌──────────────────────────────────────────────────────┐
  │ Monday:    perishables[:8]                           │
  │            → Tomato, Spinach, Broccoli, Cucumber,    │
  │               Bell Pepper, Banana, Milk, Bread       │
  │                                                      │
  │ Wednesday: perishables[8:] + semi_perishables[:5]    │
  │            → Mango, Grapes, Juice, Chicken, Fish     │
  │            → Potato, Onion, Carrot, Apple, Orange    │
  │                                                      │
  │ Saturday:  semi_perishables[5:] + non_perishables[:8]│
  │            → Cheese, Yogurt, Eggs, Butter            │
  │            → Rice, Wheat Flour, Pasta, Oats,         │
  │               Lentils, Beans, Coffee, Tea             │
  └──────────────────────────────────────────────────────┘

  Step 3: Compute quantities scaled by household_size
  qty = avg_quantity × (3/3) = avg_quantity  (for household of 3)
  estimated_price = avg_price × qty

  Step 4: Sum estimated weekly cost
  total = Σ estimated_price for all items in all days
```

---

## 7. Dashboard — Budget Bar & Spend Trend

Triggered by: User visits `/dashboard`  
APIs: `GET /api/purchases?limit=200` + `GET /api/predict-waste`

```
  purchases[] received
         │
         ├─── Group by purchase_date.slice(0,7)  →  monthlyMap
         │    { "2026-03": 2840, "2026-04": 3150, "2026-05": 1100 }
         │
         ├─── Filter to thisMonth = "2026-05"
         │    currentMonthSpend = ₹1100
         │
         ├─── user.monthly_budget = ₹3000 (from onboarding)
         │
         ▼  BudgetBar renders:
  ┌──────────────────────────────────────────────┐
  │ Monthly Budget                  ₹1900 left   │
  │ ₹1100  of ₹3000                              │
  │ ████░░░░░░░░░░░░░░░░░░░░  37% used           │
  └──────────────────────────────────────────────┘
  (green < 70%, yellow 70–90%, red > 90%)

         │
         ▼  LineChartComponent (only if ≥ 2 months):
  Month-over-Month Spend Trend
  ┌────────────────────────────────────────────┐
  │  ₹3500 ─                                   │
  │        ╲                                   │
  │  ₹3000 ──●────────●                        │
  │                    ╲                       │
  │  ₹2500 ──────────────●                     │
  │          Mar   Apr   May                   │
  └────────────────────────────────────────────┘
```

---

## 8. Insights — Top 3 Actions & Anomaly Chart

Triggered by: User visits `/insights`  
APIs: `GET /api/insights` + `GET /api/overspending`

```
  insights[] and overspending received
         │
         ├─── top3 = insights.filter(i => i.severity !== "low").slice(0,3)
         │
         ▼  "Your top 3 actions today" card (yellow bg):
  ┌───────────────────────────────────────────────┐
  │  ⚡ Your top 3 actions today                   │
  │  ① High spending on Dairy — ₹820 spent (32%)  │
  │  ② Spinach expiry risk — use within 2 days     │
  │  ③ Budget anomaly — ₹1,100 above 3-month avg  │
  └───────────────────────────────────────────────┘

         │
         └─── overspending.history[] fed to SpendingHistory:

  Recharts LineChart with custom AnomalyDot component:
  ┌───────────────────────────────────────────────┐
  │  12-Month Spending Trend                       │
  │  ₹4500 ─                                      │
  │         ╲    ⊕ ← red dot + "!" (anomaly)       │
  │  ₹3000 ──●────●────●────●                     │
  │           Jan  Feb  Mar  Apr                   │
  │                                                │
  │  ● Normal spend   ⊕ Anomaly detected (1 month) │
  └───────────────────────────────────────────────┘

  AnomalyDot renders:
    is_anomaly=true  → <circle r={7} fill="#ef4444" /> + <text>!</text>
    is_anomaly=false → <circle r={3} fill="#22c55e" />
```

---

## 9. Cross-Component Interactions

```
┌─────────────────────────────────────────────────────────────────┐
│                      COMPONENT INTERACTIONS                      │
│                                                                  │
│  JWT (python-jose)                                               │
│       │                                                          │
│       ├─── /auth/signup, /auth/login ──→ create_access_token()  │
│       ├─── /auth/me                  ──→ _decode_token() → id   │
│       └─── All protected routes      ──→ get_current_user_id()  │
│                                                                  │
│  SQLite — users table                                            │
│       ├─── /auth/signup     ──→ INSERT INTO users               │
│       ├─── /auth/me         ──→ SELECT user by id               │
│       └─── /auth/onboarding ──→ UPDATE users (budget, prefs)    │
│                                                                  │
│  SQLite — purchases table                                        │
│       ├─── /add-purchase ─→ INSERT (user_id from JWT)           │
│       ├─── /purchases    ─→ SELECT WHERE user_id = <from JWT>   │
│       ├─── /purchases/id ─→ DELETE (ownership check)            │
│       ├─── /insights     ─→ SELECT (aggregations per user)      │
│       └─── /overspending ─→ SELECT (monthly totals per user)    │
│                                                                  │
│  model_store (populated at startup)                              │
│       ├─── /predict-demand  ──→ demand_linear + xgboost         │
│       ├─── /predict-waste   ──→ waste_logistic + tabnet         │
│       ├─── /optimize-budget ──→ item_stats + metadata           │
│       └─── /compare-models  ──→ pre-computed metrics            │
│                                                                  │
│  CSV files (read-only after generation)                          │
│       └─── build_*_features() → pandas DataFrame operations     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Full Request Lifecycle

Anatomy of a single HTTP request through the full stack:

```
                   FULL REQUEST LIFECYCLE
           (Example: POST /api/optimize-budget)

USER CLICKS "OPTIMIZE" IN BROWSER
         │
         ▼ [Browser]
api.optimizeBudget(80.0, 4, ["Vegetables"])
         │
         ▼ [fetch()]
POST http://localhost:8000/api/optimize-budget
Headers: Content-Type: application/json
Body: {"budget": 80.0, "household_size": 4, "preferred_categories": ["Vegetables"]}
         │
         ▼ [Network → FastAPI]
CORS check: Origin: http://localhost:3000 → Allowed ✓
         │
         ▼ [FastAPI routing]
Matched route: POST /api/optimize-budget in optimization.py
         │
         ▼ [Pydantic validation]
BudgetRequest.model_validate(body)
  budget = 80.0        ← float, valid (> 0) ✓
  household_size = 4   ← int, valid (1–10) ✓
  preferred_categories = ["Vegetables"] ← Optional[List[str]] ✓
         │
         ▼ [Route handler]
def optimize(req: BudgetRequest):
    if not model_store["initialized"]:
        raise 503  ← would fail here if startup incomplete
         │
         ▼ [Service call]
optimize_budget(budget=80.0, household_size=4, preferred_categories=["Vegetables"])
         │
         ▼ [Business logic]
1. Load metadata via _load_metadata_lookup()
2. For each item in item_stats:
   - Skip non-Vegetables
   - Compute qty × unit_price, value_density
3. Sort by value_density
4. Greedy selection loop
         │
         ▼ [Result dict assembled]
{
  "total_cost": 21.43,
  "budget": 80.0,
  "savings": 58.57,     ← only Vegetables in budget
  "optimization_score": 0.978,
  "items_count": 8,
  "items": [...]
}
         │
         ▼ [FastAPI serialization]
JSON serialization + Content-Type: application/json
HTTP/1.1 200 OK
         │
         ▼ [Browser receives]
fetch resolves → api.ts request<T>() returns typed result
         │
         ▼ [React state update]
setBudget(result)
         │
         ▼ [Re-render triggered]
Stat cards update, Table renders with new items
         │
         ▼ [User sees]
"$21.43 spent on 8 Vegetable items, $58.57 savings, score 97.8%"

TOTAL ROUND-TRIP TIME: ~50–100ms
```
