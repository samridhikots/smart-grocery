# Smart Grocery Management System — India
## Project Overview & Problem Statement

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Why This Problem Matters for Indian Households](#2-why-this-problem-matters-for-indian-households)
3. [Our Solution](#3-our-solution)
4. [Core Features](#4-core-features)
5. [System Architecture](#5-system-architecture)
6. [Technology Stack](#6-technology-stack)
7. [Project Structure](#7-project-structure)
8. [Data Flow Diagram](#8-data-flow-diagram)
9. [Quick Start](#9-quick-start)
10. [Key Design Decisions](#10-key-design-decisions)

---

## 1. Problem Statement

### The Challenge of Household Grocery Management in India

Indian households face unique, interconnected challenges when managing groceries that differ significantly from Western contexts:

**Challenge 1 — Demand Uncertainty with Seasonal Complexity**
> "How much dal should I stock before the monsoon? How much extra atta for Diwali?"

Indian grocery demand is shaped by festivals (Diwali, Holi, Eid, Navratri), monsoon-driven supply disruptions, and mandi (wholesale market) price volatility. Without data-driven guidance, families either over-buy (leading to waste) or under-buy (forcing extra trips to the kirana store or BigBasket/Blinkit).

**Challenge 2 — Food Waste Under Indian Conditions**
> "My spinach wilted in 2 days — it's the monsoon humidity."

India's diverse climate creates distinct food-safety windows. Perishables stored during summer (April–June) or monsoon (June–September) have dramatically shorter shelf lives than the same items in winter. Leafy vegetables, paneer, and curd are particularly vulnerable, yet most households apply uniform buying patterns year-round.

**Challenge 3 — Budget Inefficiency and Overspending Detection**
> "We spent ₹6,000 this month — is that normal for our household?"

With prices in Indian Rupees and strong mandi-to-retail price swings (tomatoes at ₹15/kg in October vs ₹80/kg in January), static budgets fail. Households need AI-driven anomaly detection to flag unusual spending months before they spiral.

**Challenge 4 — Sustainability and Eco-Awareness**
> "Which items in my cart have a high carbon footprint?"

Growing awareness of food miles, plastic packaging, and environmental impact requires a sustainability layer that can score items, suggest eco-friendly swaps, and track CO₂ estimates per purchase.

---

## 2. Why This Problem Matters for Indian Households

| Metric | Indian Context |
|--------|---------------|
| Average household food waste | ₹8,000–₹12,000/year |
| Festival overspend premium | 20–35% above monthly average |
| Mandi price volatility (tomato) | ±300% within a calendar year |
| Monsoon perishable loss rate | 2–3× normal wastage rate |
| Households without a grocery budget | ~68% of urban middle-class |
| Top waste categories | Vegetables, dairy, bread/roti |

These are **data problems** at their core. Indian households make purchasing decisions without leveraging their own historical consumption patterns, mandi price indices, seasonal demand shifts, or product shelf-life data specific to Indian climatic conditions.

**This is exactly what an India-specific ML grocery system is designed to solve.**

---

## 3. Our Solution

The **Smart Grocery Management System — India** is an end-to-end, data-driven application that addresses all four challenges simultaneously using 7 machine learning models:

```
Historical Purchases + 6 Kaggle Datasets (or India-specific synthetic fallback)
             ↓
    Data Pipeline: normalizer.py (rapidfuzz) + pipeline.py (Kaggle ingestion)
             ↓
    Feature Engineering (13 demand features / 24 waste features)
             ↓
    ┌─────────────────────────────────────────────────────────┐
    │  ML Pipeline (7 models)                                  │
    │  ├── Demand Prediction (Ridge + XGBoost)                 │  → "Buy 3 kg Tomatoes (₹105)"
    │  ├── Waste Prediction (Logistic + TabNet)                │  → "Paneer HIGH RISK — use today"
    │  ├── Budget Optimization (Fractional Knapsack)           │  → "Optimal 14 items for ₹2,000"
    │  ├── Overspending Detection (Isolation Forest)           │  → "March spend anomalous (+41%)"
    │  ├── Product Recommendations (FP-Growth)                 │  → "Atta buyers also buy Ghee"
    │  └── Sustainability Tracking (Rule-based eco scoring)    │  → "Chicken: 3.8 CO₂/kg — swap?"
    └─────────────────────────────────────────────────────────┘
             ↓
    7-page Frontend: Home, Dashboard, Add Purchase, Recommendations,
                     Insights, Sustainability, Model Comparison
```

### What makes it India-specific

| Generic Grocery App | Smart Grocery — India |
|---------------------|----------------------|
| Generic seasonal data | FESTIVAL_MONTHS=[1,3,8,10,11], MONSOON_MONTHS=[6,7,8,9] |
| USD prices | ₹ (Indian Rupees) throughout |
| Generic items | 30 real Indian items with brands (Amul, Aashirvaad, India Gate, Tata, Fortune) |
| No mandi pricing | price_variation_index from wholesale mandi data |
| No climate context | monsoon_perishable_flag, is_summer_month, is_monsoon_month features |
| No sustainability | Eco scores, CO₂/unit, plastic flags, swap suggestions |
| No anomaly alerts | Isolation Forest overspending detection |
| Basic recommendations | FP-Growth market basket analysis |

---

## 4. Core Features

### Feature 1: Demand Prediction
- Trains on up to 200,000 historical purchase records from Indian households
- Predicts next purchase quantity per item with Indian seasonal context
- Compares Ridge Linear Regression (legacy) vs XGBoost (modern)
- **13 engineered features** including rolling averages, seasonal factors, mandi price variation index, is_summer_month, is_monsoon_month
- Returns unit price in ₹, estimated total cost in ₹, brand, and urgency message

### Feature 2: Waste Risk Prediction
- Classifies items as High / Medium / Low waste risk
- **24 engineered features** including monsoon_perishable_flag and climate-aware signals
- Compares Logistic Regression (legacy) vs TabNet deep learning model (modern)
- Returns shelf_life_days, is_perishable flag, brand, and actionable recommendations
- Monsoon perishable flag (is_monsoon_month × is_perishable) is a key signal for summer/monsoon accuracy

### Feature 3: Budget Optimizer
- Fractional knapsack algorithm optimised for Indian item prices (₹)
- Maximizes combined `priority_score × nutrition_score / price` value density
- Default budget: ₹2,000 per week; currency field: "INR" in all responses
- Supports household size scaling and category filtering

### Feature 4: Overspending Detection
- **Isolation Forest** with n_estimators=150, contamination=0.1
- Features: monthly_spend, spend_vs_avg, n_unique_items, avg_price_paid, is_festival_month
- Per-user, per-month anomaly scoring; returns is_anomaly flag and anomaly score
- Accessible via GET /api/overspending

### Feature 5: Product Recommendations
- **FP-Growth via mlxtend** (min_support=0.005, min_confidence=0.20)
- Market basket analysis on Indian co-purchase patterns (e.g., Milk → Curd, Atta → Ghee)
- Results sorted by lift; fallback to India-specific heuristics when data is sparse
- Accessible via POST /api/recommendations with basket: ["Milk", "Atta"]

### Feature 6: Sustainability Tracking
- Rule-based eco scoring (0–10 scale per item)
- CO₂ estimates per unit, plastic packaging flag, swap suggestions
- Supports: GET /api/sustainability, GET /api/sustainability/items, GET /api/sustainability/swaps
- Frontend: /sustainability page with EcoMeter, swap suggestions table, CO₂ chart

### Feature 7: AI Insights Aggregation
- Combines outputs from all 7 models into prioritized insight cards
- Accessible via GET /api/insights?user_id=1
- Frontend: /insights page with InsightCard components and SpendingHistory

### Feature 8: Weekly Plan Generator
- Separates items into shopping trips by perishability
- Monday: fresh produce (shelf life ≤ 7 days)
- Wednesday: semi-perishables + overflow
- Saturday: pantry staples and non-perishables

### Feature 9: Model Comparison Dashboard
- Side-by-side metrics: MAE, RMSE, R², Directional Accuracy (demand)
- Accuracy, Precision, Recall, F1, ROC-AUC (waste)
- Updated to include anomaly_detection and recommendation sections
- Radar chart, bar charts, feature importance rankings

---

## 5. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 14)                         │
│  ┌────────┐ ┌─────────┐ ┌─────┐ ┌───────────┐ ┌────────┐ ┌────────┐ │
│  │Dashboard│ │Add Purch│ │Recom│ │ Insights  │ │Sustain-│ │Compare │ │
│  │(charts) │ │(form)   │ │tabs │ │(IsoForest)│ │ability │ │(7 mdls)│ │
│  └────┬────┘ └────┬────┘ └──┬──┘ └─────┬─────┘ └───┬────┘ └───┬────┘ │
│       └───────────┴─────────┴──────────┴───────────┴──────────┘      │
│                         API Layer (api.ts)                             │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTP/JSON (port 3000 → 8000)
┌──────────────────────────────▼───────────────────────────────────────┐
│                         BACKEND (FastAPI v2.0.0)                      │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                     Routes Layer (6 files)                    │   │
│   │  grocery  prediction  optimization  comparison  insights      │   │
│   │  sustainability                                               │   │
│   └──────────────────────────────────────────────────────────────┘   │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                    Services Layer                             │   │
│   │  feature_engineering  evaluator  budget_optimizer            │   │
│   └──────────────────────────────────────────────────────────────┘   │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                  Data Pipeline Layer                          │   │
│   │  data_pipeline/normalizer.py (rapidfuzz)                     │   │
│   │  data_pipeline/pipeline.py (Kaggle ingestion)                │   │
│   └──────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────┐  ┌─────────────────────────────────┐   │
│   │     Model Registry       │  │       Dataset Layer             │   │
│   │  demand/   (2 models)   │  │  generator.py  loader.py        │   │
│   │  waste/    (2 models)   │  └─────────────────────────────────┘   │
│   │  anomaly/  (1 model)    │                                         │
│   │  recommendation/ (1)    │  ┌─────────────────────────────────┐   │
│   │  sustainability/ (1)    │  │  SQLite Database (purchases)    │   │
│   └─────────────────────────┘  └─────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────────┐
│                    Data Layer (CSV Files)                              │
│  backend/data/kaggle/          ← Place Kaggle CSVs here (optional)   │
│  backend/data/processed/       ← 6 processed CSVs (auto-generated)   │
│  grocery_purchases.csv  food_waste.csv  retail_transactions.csv       │
│  product_metadata.csv   household_consumption.csv  seasonal_data.csv  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Technology Stack

### Backend
| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Web Framework | FastAPI | 0.109.0 | REST API, async routing, auto-docs |
| ASGI Server | Uvicorn | 0.27.0 | Production-grade async server |
| Database ORM | SQLAlchemy | 2.0.25 | SQLite ORM for purchase records |
| Data Processing | Pandas | 2.1.4 | DataFrame manipulation, feature engineering |
| Numerical Computing | NumPy | 1.26.3 | Array operations, synthetic data generation |
| ML Framework | scikit-learn | 1.4.0 | Ridge, Logistic, IsolationForest, scaling |
| Gradient Boosting | XGBoost | 2.0.3 | Advanced demand prediction (13 features) |
| Deep Learning | PyTorch | ≥2.0.0 | TabNet model backend |
| Tabular DL | pytorch-tabnet | ≥4.1.0 | TabNet waste classifier (24 features) |
| Market Basket | mlxtend | ≥0.23.0 | FP-Growth association rules |
| Fuzzy Matching | rapidfuzz | ≥3.6.0 | Product name normalization in data pipeline |
| Data Validation | Pydantic | 2.5.3 | Request/response schema validation |

### Frontend
| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | Next.js | 14.1.0 | React framework with App Router |
| Language | TypeScript | 5.x | Type-safe frontend code |
| Styling | Tailwind CSS | 3.3.0 | Utility-first CSS |
| Charts | Recharts | 2.10.4 | BarChart, RadarChart, LineChart |
| Icons | Lucide React | 0.309.0 | Including Lightbulb (Insights), Leaf (Sustainability) |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Database | SQLite (file-based, zero setup) |
| Data Storage | CSV files (auto-generated or Kaggle-sourced) |
| Communication | JSON REST API over HTTP |
| Currency | ₹ Indian Rupees (INR) throughout |

---

## 7. Project Structure

```
smart-grocery/
│
├── docs/                              ← You are here
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
│   ├── grocery.db                     ← Auto-created SQLite DB
│   ├── data/
│   │   ├── kaggle/                    ← Place Kaggle CSVs here
│   │   └── processed/                 ← 6 processed CSVs (auto-generated)
│   │       ├── grocery_purchases.csv
│   │       ├── food_waste.csv
│   │       ├── retail_transactions.csv
│   │       ├── product_metadata.csv
│   │       ├── household_consumption.csv
│   │       └── seasonal_data.csv
│   └── app/
│       ├── main.py                    ← FastAPI app entry point (lifespan)
│       ├── database/
│       │   └── db.py                  ← SQLAlchemy setup
│       ├── data_pipeline/             ← NEW: Kaggle ingestion layer
│       │   ├── normalizer.py          ← rapidfuzz product name normalization
│       │   └── pipeline.py            ← Kaggle CSV ingestion + processing
│       ├── datasets/
│       │   ├── generator.py           ← India-specific synthetic fallback
│       │   └── loader.py              ← CSV loading utilities
│       ├── services/
│       │   ├── feature_engineering.py ← 13-feature demand / 24-feature waste
│       │   ├── data_processing.py     ← Scaling, encoding
│       │   ├── evaluator.py           ← Training orchestrator (7 models)
│       │   └── budget_optimizer.py    ← Fractional knapsack (₹)
│       ├── models/
│       │   ├── demand/
│       │   │   ├── linear_model.py    ← Ridge Regression (13 features)
│       │   │   └── xgboost_model.py   ← XGBoost Regressor (13 features)
│       │   ├── waste/
│       │   │   ├── logistic_model.py  ← Logistic Regression (24 features)
│       │   │   └── tabnet_model.py    ← TabNet Classifier (24 features)
│       │   ├── anomaly/               ← NEW
│       │   │   └── isolation_forest_model.py  ← OverspendingDetector
│       │   ├── recommendation/        ← NEW
│       │   │   └── fpgrowth_model.py  ← GroceryRecommender
│       │   └── sustainability/        ← NEW
│       │       └── tracker.py         ← SustainabilityTracker
│       ├── routes/
│       │   ├── grocery.py             ← Purchase CRUD
│       │   ├── prediction.py          ← Demand + waste endpoints
│       │   ├── optimization.py        ← Budget + plan endpoints
│       │   ├── comparison.py          ← Model metrics (7 models)
│       │   ├── insights.py            ← NEW: /api/insights, /api/overspending
│       │   └── sustainability.py      ← NEW: /api/sustainability/*
│       └── utils/
│           ├── helpers.py             ← 30-item Indian catalog, seasonal factors
│           └── store.py               ← Global model registry (7-model store)
│
└── frontend/
    ├── app/
    │   ├── layout.tsx                 ← Root layout with updated Navbar (7 links)
    │   ├── page.tsx                   ← Landing page
    │   ├── dashboard/page.tsx         ← Overview dashboard
    │   ├── add/page.tsx               ← Purchase recording form (₹)
    │   ├── recommendations/page.tsx   ← Demand + waste + budget tabs
    │   ├── insights/page.tsx          ← NEW: InsightCard, SpendingHistory
    │   ├── sustainability/page.tsx    ← NEW: EcoMeter, swaps, CO₂ chart
    │   └── comparison/page.tsx        ← Model comparison (7 models)
    ├── components/
    │   ├── Navbar.tsx                 ← 7 links: + Insights (Lightbulb), Sustainability (Leaf)
    │   ├── Chart.tsx                  ← Recharts wrappers
    │   ├── Table.tsx                  ← Generic typed table
    │   └── Form.tsx                   ← Purchase input form
    ├── services/
    │   └── api.ts                     ← Typed API client (updated types + new functions)
    └── lib/
        └── constants.ts               ← Indian item catalog, ITEMS_BY_CATEGORY
```

---

## 8. Data Flow Diagram

```
                        STARTUP SEQUENCE (v2.0.0)
                        ─────────────────────────
  main.py starts (lifespan)
       │
       ├── create_tables()              → Creates SQLite schema
       │
       ├── kaggle_data_available()?
       │       ├── YES → run_kaggle_pipeline()   → normalizer.py + pipeline.py
       │       └── NO  → generate_all_datasets() → India-specific synthetic data
       │
       └── train_all_models()
               │
               ├── build_demand_features()   → 13-feature matrix
               │       ├── grocery_purchases.csv
               │       ├── household_consumption.csv
               │       ├── seasonal_data.csv (FESTIVAL/MONSOON/SUMMER months)
               │       ├── product_metadata.csv (mandi prices)
               │       └── Engineer 13 features → X_demand, y_demand
               │
               ├── build_waste_features()    → 24-feature matrix
               │       ├── food_waste.csv
               │       ├── product_metadata.csv
               │       └── Engineer 24 features → X_waste, y_waste
               │
               ├── Train Ridge + XGBoost      (demand, 80/20 split)
               ├── Train Logistic + TabNet    (waste, 80/20 stratified)
               ├── Train IsolationForest      (overspending)
               ├── Train FP-Growth            (recommendations)
               ├── Init SustainabilityTracker (rule-based)
               └── Populate model_store{}     ← Global registry
                   model_store["initialized"] = True

                        REQUEST SEQUENCE
                        ────────────────
  User Action → Frontend → HTTP Request → FastAPI Route
                                               │
                               ┌───────────────┴──────────────┐
                               │        model_store{}          │
                               │  scaler.transform(features)   │
                               │  model.predict(scaled_X)      │
                               └───────────────┬──────────────┘
                                               │
                               ← JSON Response (₹ prices, INR currency)
```

---

## 9. Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm 9+

### Backend Setup
```bash
cd smart-grocery/backend

# Install Python dependencies (includes mlxtend and rapidfuzz)
pip install -r requirements.txt

# Optional: place Kaggle CSVs in backend/data/kaggle/ before starting
# (see docs/02_DATASETS.md for the 7 Kaggle dataset filenames)

# Start server — auto-detects Kaggle data, falls back to synthetic if absent
uvicorn app.main:app --reload --port 8000
```

Expected startup output:
```
INFO: Starting up Smart Grocery Management System — India v2.0.0
[pipeline] Kaggle data not found — generating India-specific synthetic datasets...
[datasets] Generated grocery_purchases.csv: 200,000 rows (250 users, 30 Indian items)
[datasets] Generated food_waste.csv: 120,000 rows
[datasets] Generated seasonal_data.csv with FESTIVAL/MONSOON/SUMMER months
...
[evaluator] Training 7 models...
  Demand  — Ridge trained | XGBoost (200 trees, 13 features) trained
  Waste   — Logistic trained | TabNet (n_steps=5, 24 features) trained
  Anomaly — IsolationForest (n_estimators=150) trained
  Recommendation — FP-Growth rules computed
  Sustainability — Eco scores initialized (30 Indian items)
[evaluator] All 7 models trained successfully.
INFO: System ready. model_store["initialized"] = True
INFO: Uvicorn running on http://127.0.0.1:8000
```

> **Note:** First-run startup takes approximately 10–20 minutes: synthetic data generation (~30–60s) + XGBoost training (~30–60s on 200k rows) + TabNet training (~3–8 minutes on 120k rows with 50 epochs). If Kaggle CSVs are present, data generation is skipped.

### Frontend Setup
```bash
cd smart-grocery/frontend

# Install Node.js dependencies
npm install

# Start development server
npm run dev
```

### Verify It Works
```bash
# Health check — should show all 7 model readiness fields
curl http://localhost:8000/health
# → {"status":"healthy","models_ready":true,"anomaly_trained":true,
#    "recommender_trained":true,"sustainability_ready":true}

# Open frontend (7 pages including Insights and Sustainability)
open http://localhost:3000

# Browse auto-generated API docs
open http://localhost:8000/docs
```

---

## 10. Key Design Decisions

### Decision 1: India-Specific Data and Context
**Choice:** Build the entire data layer, feature engineering, and item catalog around Indian grocery context.  
**Reason:** Generic grocery datasets use USD prices, Western items, and seasonal patterns irrelevant to Indian households. Indian-specific signals — mandi price indices, festival months, monsoon perishability — materially improve prediction accuracy and user relevance.  
**How:** 30 Indian items with real brands (Amul, Aashirvaad, India Gate, Tata Tea, Fortune), FESTIVAL_MONTHS=[1,3,8,10,11], MONSOON_MONTHS=[6,7,8,9], SUMMER_MONTHS=[4,5,6], and price_variation_index from mandi wholesale data.

### Decision 2: Kaggle-First with Synthetic Fallback
**Choice:** Check for Kaggle datasets at startup; only generate synthetic data if Kaggle CSVs are absent.  
**Reason:** Real Kaggle data (BigBasket, Blinkit, Mandi prices) produces more realistic model training and better generalisation. The synthetic fallback ensures the system runs without any external data dependency for demos or development.

### Decision 3: 7 Models for Complete Coverage
**Choice:** Expand from 4 to 7 models covering demand, waste, overspending, recommendations, and sustainability.  
**Reason:** Real grocery management requires more than demand/waste prediction. Overspending detection (Isolation Forest) catches budget anomalies automatically. FP-Growth provides data-driven co-purchase recommendations. The sustainability tracker adds eco-awareness increasingly relevant to urban Indian households.

### Decision 4: rapidfuzz for Product Name Normalization
**Choice:** Use rapidfuzz (≥72% match score) in normalizer.py to canonicalize product names from Kaggle datasets.  
**Reason:** Kaggle datasets use inconsistent product names ("Toor Dal", "Arhar Dal", "Pigeon Pea Dal"). rapidfuzz fuzzy matching maps these to canonical Indian names without requiring exact string matches, dramatically improving join quality between datasets.

### Decision 5: Global Model Registry
**Choice:** Store all 7 trained models in a module-level singleton dict (`model_store`).  
**Reason:** Model loading from pickle files adds ~200ms per request. The global registry means models are loaded once at startup and reused across all requests with zero per-request overhead.

### Decision 6: ₹ (INR) Throughout
**Choice:** All prices, budgets, and cost estimates use Indian Rupees.  
**Reason:** The system is designed for Indian households. USD prices would create a disconnect from real-world grocery shopping. The frontend default budget is ₹2,000/week; all API responses include `currency: "INR"` fields.

### Decision 7: SQLite for Persistence
**Choice:** SQLite over PostgreSQL/MySQL.  
**Reason:** Zero infrastructure setup for a demo project. The schema is simple (`users` + `purchases` tables). SQLite handles concurrent reads adequately for a single-user demo and can be replaced with PostgreSQL with minimal code changes.

### Decision 8: JWT Authentication
**Choice:** python-jose JWT tokens (HS256, 30-day expiry) + passlib bcrypt password hashing.  
**Reason:** Proper multi-user isolation requires authentication. JWT stored in localStorage is sent as `Authorization: Bearer <token>` on every API request. The backend extracts `user_id` from the token instead of accepting it as a query param, preventing users from accessing each other's data.

**Flow:**
1. POST `/api/auth/signup` → creates `UserRecord`, returns `{access_token, user}`
2. POST `/api/auth/login` → verifies bcrypt hash, returns `{access_token, user}`
3. All user-specific routes (`/api/purchases`, `/api/insights`, `/api/overspending`, `/api/sustainability`) require `Authorization: Bearer <token>` — missing or invalid tokens return HTTP 401.
4. PUT `/api/auth/onboarding` → saves household size, monthly budget, dietary prefs; sets `onboarding_complete=True`.

### Decision 9: Next.js 14 App Router
**Choice:** Next.js 14 App Router with Server and Client components.  
**Reason:** App Router is the recommended pattern from Next.js 14 onwards, supports streaming, and separates layout from page logic cleanly. The 9-page structure (including /auth/signin, /auth/signup, /insights, /sustainability) maps naturally to the App Router's file-based routing.
