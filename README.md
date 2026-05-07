# Smart Grocery Management System
### Final Year Engineering Project — ML with Model Comparison

## Quick Start

### 1. Backend (FastAPI + ML)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

On first start, the server will:
- Generate 6 synthetic datasets in `backend/data/`
- Train all 4 ML models (Linear Regression, XGBoost, Logistic Regression, Random Forest)
- Log training metrics to the console

**API docs:** http://localhost:8000/docs  
**Health check:** http://localhost:8000/health

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/add-purchase` | Record a grocery purchase |
| GET | `/api/purchases` | List recent purchases |
| GET | `/api/items` | List all known items |
| GET | `/api/predict-demand` | Demand forecast (XGBoost + Linear) |
| GET | `/api/predict-waste` | Waste risk (Random Forest + Logistic) |
| POST | `/api/optimize-budget` | Budget-optimized shopping list |
| GET | `/api/generate-plan` | Weekly shopping plan |
| GET | `/api/compare-models` | Full model comparison metrics |

### Sample Requests

```bash
# Add a purchase
curl -X POST http://localhost:8000/api/add-purchase \
  -H "Content-Type: application/json" \
  -d '{"item":"Tomato","category":"Vegetables","quantity":1.5,"price":3.75,"purchase_date":"2024-01-15"}'

# Get demand predictions
curl http://localhost:8000/api/predict-demand

# Optimize a $80 budget for household of 4
curl -X POST http://localhost:8000/api/optimize-budget \
  -H "Content-Type: application/json" \
  -d '{"budget":80,"household_size":4}'

# Compare models
curl http://localhost:8000/api/compare-models
```

---

## Project Structure

```
smart-grocery/
├── backend/
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py                      # FastAPI app + startup
│   │   ├── routes/
│   │   │   ├── grocery.py               # POST /add-purchase, GET /purchases
│   │   │   ├── prediction.py            # GET /predict-demand, /predict-waste
│   │   │   ├── optimization.py          # POST /optimize-budget, GET /generate-plan
│   │   │   └── comparison.py            # GET /compare-models
│   │   ├── models/
│   │   │   ├── demand/
│   │   │   │   ├── linear_model.py      # Legacy: Ridge Regression
│   │   │   │   └── xgboost_model.py     # Modern: XGBoost Regressor
│   │   │   └── waste/
│   │   │       ├── logistic_model.py    # Legacy: Logistic Regression
│   │   │       └── random_forest_model.py  # Modern: Random Forest
│   │   ├── services/
│   │   │   ├── feature_engineering.py  # 10 engineered features
│   │   │   ├── data_processing.py      # Scaling, encoding
│   │   │   ├── evaluator.py            # Training orchestrator
│   │   │   └── budget_optimizer.py     # Knapsack-style optimizer
│   │   ├── datasets/
│   │   │   ├── generator.py            # Generates 6 CSV datasets
│   │   │   └── loader.py               # Loads CSVs
│   │   ├── database/
│   │   │   └── db.py                   # SQLite via SQLAlchemy
│   │   └── utils/
│   │       ├── helpers.py              # Item catalog, seasonal factors
│   │       └── store.py                # Global model registry
│   └── data/                           # Auto-generated CSV files
│
└── frontend/
    ├── app/
    │   ├── page.tsx                    # Landing page
    │   ├── dashboard/page.tsx          # Overview + charts
    │   ├── add/page.tsx                # Add purchase form
    │   ├── recommendations/page.tsx   # Demand + Waste + Budget tabs
    │   └── comparison/page.tsx        # Model comparison dashboard
    ├── components/
    │   ├── Navbar.tsx
    │   ├── Chart.tsx                   # BarChart, RadarChart, LineChart
    │   ├── Table.tsx
    │   └── Form.tsx
    └── services/
        └── api.ts                     # Typed API client
```

---

## Datasets

| # | File | Rows | Purpose |
|---|------|------|---------|
| 1 | `grocery_purchases.csv` | 3,000 | Demand prediction training |
| 2 | `food_waste.csv` | 1,200 | Waste classification target |
| 3 | `retail_transactions.csv` | ~760 | Purchase frequency patterns |
| 4 | `product_metadata.csv` | 30 | Budget optimization scoring |
| 5 | `household_consumption.csv` | 2,160 | Usage-rate feature engineering |
| 6 | `seasonal_data.csv` | 12 | Seasonal demand multipliers |

## Engineered Features

**Demand Model (10 features):**
`avg_quantity_last3`, `days_since_last`, `purchase_frequency`, `seasonal_factor`,
`household_size`, `consumption_rate`, `price`, `category_encoded`, `expiry_risk_proxy`, `is_festival_month`

**Waste Model (10 features):**
`expiry_days`, `shelf_life`, `expiry_risk`, `consumption_rate`, `quantity`,
`price`, `household_size_proxy`, `nutrition_score`, `is_perishable`, `category_encoded`

## ML Models

| Task | Legacy | Modern |
|------|--------|--------|
| Demand Prediction | Ridge Linear Regression | XGBoost Regressor (200 trees) |
| Waste Prediction | Logistic Regression | Random Forest (150 trees) |

Metrics computed on 20% held-out test set: MAE, RMSE, R² (regression) and Accuracy, Precision, Recall, F1, ROC-AUC (classification).
