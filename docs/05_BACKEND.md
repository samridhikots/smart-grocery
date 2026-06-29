# Backend Documentation
## Smart Grocery Management System — FastAPI

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Entry Point: main.py](#2-entry-point-mainpy)
3. [Database Layer](#3-database-layer)
4. [Dataset Layer](#4-dataset-layer)
5. [Services Layer](#5-services-layer)
6. [Models Layer](#6-models-layer)
7. [Routes Layer](#7-routes-layer)
8. [Utils Layer](#8-utils-layer)
9. [Startup Sequence](#9-startup-sequence)
10. [Error Handling](#10-error-handling)
11. [Configuration](#11-configuration)

---

## 1. Architecture Overview

The backend follows a **layered architecture** with clear separation of concerns:

```
┌──────────────────────────────────────────────────────────┐
│  Routes Layer (HTTP interface)                            │
│  grocery.py  prediction.py  optimization.py               │
│  comparison.py  insights.py  sustainability.py  auth.py   │
├──────────────────────────────────────────────────────────┤
│  Services Layer (business logic)                          │
│  feature_engineering.py  evaluator.py                     │
│  budget_optimizer.py  data_processing.py                  │
├──────────────────────────────────────────────────────────┤
│  Models Layer (ML algorithms)                             │
│  linear_model.py  xgboost_model.py                        │
│  logistic_model.py  tabnet_model.py                       │
├──────────────────────────────────────────────────────────┤
│  Data Layer (storage)                                     │
│  generator.py  loader.py  db.py (users + purchases)       │
├──────────────────────────────────────────────────────────┤
│  Utils Layer (shared state)                               │
│  helpers.py (item catalog)  store.py (registry)           │
│  auth.py (JWT + bcrypt)                                   │
└──────────────────────────────────────────────────────────┘
```

**Key architectural decisions:**
- No ORM for ML data (raw CSV + pandas for flexibility)
- SQLAlchemy ORM for both `users` and `purchases` tables
- JWT authentication (python-jose HS256, 30-day expiry) — user identity derived from token on every protected request
- Global model registry loaded once at startup
- Pydantic models for all request/response validation

---

## 2. Entry Point: main.py

**File:** `backend/app/main.py`

The application entry point that:
1. Creates the FastAPI app instance with metadata
2. Attaches CORS middleware
3. Registers all 7 routers with `/api` prefix
4. Orchestrates the startup lifecycle

### Full Application Lifecycle

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP (runs once when server starts)
    create_tables()           # SQLite schema creation
    generate_all_datasets()   # Write 6 CSVs if not present
    train_all_models()        # Train 7 models (4 supervised + IF + FP-Growth + Sustainability), populate model_store
    yield
    # SHUTDOWN (cleanup if needed)
```

### CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Allows the Next.js frontend (port 3000) to call the FastAPI backend (port 8000) from a browser.

### Router Prefixes

```python
app.include_router(auth_routes.router,    prefix="/api", tags=["Auth"])
app.include_router(grocery.router,        prefix="/api", tags=["Grocery"])
app.include_router(prediction.router,     prefix="/api", tags=["Prediction"])
app.include_router(optimization.router,   prefix="/api", tags=["Optimization"])
app.include_router(comparison.router,     prefix="/api", tags=["Comparison"])
app.include_router(insights.router,       prefix="/api", tags=["Insights"])
app.include_router(sustainability.router, prefix="/api", tags=["Sustainability"])
```

---

## 3. Database Layer

**File:** `backend/app/database/db.py`

### Database Engine

```python
DATABASE_URL = f"sqlite:///./grocery.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
```

- **SQLite** — file-based, zero-configuration database
- `check_same_thread=False` — required because FastAPI uses a thread pool
- Database file created at: `backend/grocery.db`

### Schema: UserRecord Table

```sql
CREATE TABLE users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT    NOT NULL,
    email               TEXT    NOT NULL UNIQUE,
    password_hash       TEXT    NOT NULL,      -- bcrypt hash
    household_size      INTEGER DEFAULT 3,
    monthly_budget      REAL    DEFAULT 3000.0,
    dietary_prefs       TEXT    DEFAULT '',
    onboarding_complete INTEGER DEFAULT 0,     -- 0=False, 1=True
    created_at          TEXT    NOT NULL       -- ISO timestamp
);
```

### Schema: PurchaseRecord Table

```sql
CREATE TABLE purchases (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,            -- FK → users.id (from JWT)
    item          TEXT    NOT NULL,
    category      TEXT    NOT NULL,
    quantity      REAL    NOT NULL,
    price         REAL    NOT NULL,
    purchase_date TEXT    NOT NULL
);
```

### Session Management

```python
def get_db():
    db = SessionLocal()
    try:
        yield db          # Yield to route handler
    finally:
        db.close()        # Always close, even if exception occurs
```

Used as a FastAPI dependency:
```python
@router.post("/add-purchase")
def add_purchase(data: PurchaseCreate, db: Session = Depends(get_db)):
    ...
```

---

## 4. Dataset Layer

### generator.py

**File:** `backend/app/datasets/generator.py`

Generates 6 synthetic datasets as pandas DataFrames and saves them to CSV.

**Generation functions:**

| Function | Output | Key Logic |
|----------|--------|-----------|
| `generate_grocery_purchases()` | 3,000 rows | Simulates 50 households × 30 items × 2 years |
| `generate_food_waste()` | 1,200 rows | `waste_prob = 0.6×expiry_risk + 0.4×(1-consumption_rate)` |
| `generate_retail_transactions()` | ~760 rows | Frequency/time-between-purchases per user-item |
| `generate_product_metadata()` | 30 rows | Static item properties with synthetic nutrition scores |
| `generate_household_consumption()` | 2,160 rows | `6 sizes × 30 items × 12 months` |
| `generate_seasonal_data()` | 12 rows | Monthly demand multipliers |

**Idempotency:**
```python
def generate_all_datasets(force: bool = False):
    for filename, generator_fn in files.items():
        path = os.path.join(DATA_DIR, filename)
        if not os.path.exists(path) or force:
            df = generator_fn()
            df.to_csv(path, index=False)
```
Datasets are only regenerated if:
- CSV doesn't exist (first run)
- `force=True` is passed explicitly

### loader.py

**File:** `backend/app/datasets/loader.py`

Simple utility functions that load each CSV file and return a pandas DataFrame:

```python
def load_all() -> dict:
    return {
        "purchases":    load_grocery_purchases(),
        "waste":        load_food_waste(),
        "transactions": load_retail_transactions(),
        "metadata":     load_product_metadata(),
        "household":    load_household_consumption(),
        "seasonal":     load_seasonal_data(),
    }
```

---

## 5. Services Layer

### feature_engineering.py

**File:** `backend/app/services/feature_engineering.py`

Contains two major pipeline functions:

**`build_demand_features()`**
- Loads 6 datasets, joins them, engineers 13 features (10 base + 3 Indian-context: `price_variation_index`, `is_summer_month`, `is_monsoon_month`)
- Creates rolling window features using pandas GroupBy
- Returns `(X_demand: DataFrame, y_demand: Series)`

**`build_waste_features()`**
- Loads waste + metadata, engineers 24 features (10 base + 10 engineered + 4 Indian-context: `is_summer_month`, `is_monsoon_month`, `monsoon_perishable_flag`, `price_variation_index`)
- Returns `(X_waste: DataFrame, y_waste: Series)`

**`compute_item_stats()`**
- Builds per-item inference feature dict from aggregated statistics
- Called once at startup, stored in `model_store["item_stats"]`

### data_processing.py

**File:** `backend/app/services/data_processing.py`

```python
def scale_features(X_train, X_test):
    scaler = StandardScaler()
    return scaler.fit_transform(X_train), scaler.transform(X_test), scaler

def handle_missing(df):
    numeric_cols = df.select_dtypes(include=np.number).columns
    df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].median())
    return df

def clip_outliers(df, cols, lower=0.01, upper=0.99):
    for col in cols:
        lo, hi = df[col].quantile(lower), df[col].quantile(upper)
        df[col] = df[col].clip(lo, hi)
    return df
```

### evaluator.py

**File:** `backend/app/services/evaluator.py`

The training orchestrator. Called once at startup:
1. Builds both feature matrices
2. Performs train/test splits
3. Scales features
4. Trains all 4 models
5. Evaluates each on test set
6. Populates `model_store`

### budget_optimizer.py

**File:** `backend/app/services/budget_optimizer.py`

**`optimize_budget(budget, household_size, preferred_categories)`**

Implements the fractional knapsack algorithm:

```
1. For each item, compute:
   value_density = (priority_score × nutrition_score) / unit_price

2. Sort items by value_density (descending)

3. Greedily add items until budget exhausted:
   - If full quantity fits: add full quantity
   - If only partial fits: add fractional quantity

4. Return sorted shopping list + metadata
```

**`generate_weekly_plan(household_size)`**

Splits items into 3 shopping trips based on perishability:
- **Monday:** Items with shelf_life ≤ 7 days (fresh produce, bread, meat)
- **Wednesday:** Items with shelf_life 8–30 days + overflow perishables
- **Saturday:** Non-perishables (shelf_life > 30 days)

---

## 6. Models Layer

### Model Class Interface

All 4 model classes implement the same interface:

```python
class AnyModel:
    def __init__(self):
        self.model = <sklearn/xgboost instance>
        self.is_trained = False

    def train(self, X: np.ndarray, y: np.ndarray) -> dict:
        """Train and return training metrics."""

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Return predictions for input X."""

    def evaluate(self, X: np.ndarray, y: np.ndarray) -> dict:
        """Return test metrics dict."""
```

Regression models additionally have:
```python
    def feature_importance(self, feature_names: list) -> dict:
        """Return feature importance scores."""
```

### File Locations

```
backend/app/models/
├── demand/
│   ├── linear_model.py     ← DemandLinearModel (Ridge)
│   └── xgboost_model.py    ← DemandXGBoostModel (XGBRegressor)
└── waste/
    ├── logistic_model.py   ← WasteLogisticModel (LogisticRegression)
    └── random_forest_model.py ← WasteRandomForestModel (RandomForestClassifier)
```

---

## 7. Routes Layer

### auth.py

**File:** `backend/app/routes/auth.py`  
**Prefix:** `/api/auth`  
**Auth:** Public endpoints return tokens; protected endpoints require `Authorization: Bearer <token>`

```
POST /api/auth/signup       → Create account, return JWT + user object
POST /api/auth/login        → Verify credentials, return JWT + user object
GET  /api/auth/me           → Return current user (requires JWT)
PUT  /api/auth/onboarding   → Save household_size / monthly_budget / dietary_prefs
```

**Signup/login response shape:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": 1, "name": "Samridhi", "email": "...",
    "household_size": 3, "monthly_budget": 3000.0,
    "dietary_prefs": "", "onboarding_complete": false
  }
}
```

### grocery.py

**File:** `backend/app/routes/grocery.py`  
**Prefix:** `/api`  
**Auth:** All purchase endpoints require `Authorization: Bearer <token>`. `user_id` is derived from the JWT — never accepted as a body field or query param.

```
POST   /api/add-purchase        → Record a purchase (user_id from JWT)
GET    /api/purchases           → List purchases for the authenticated user
DELETE /api/purchases/{id}      → Delete a purchase (ownership check enforced)
GET    /api/items               → List all 30 catalog items (no auth required)
```

**Pydantic schemas:**
```python
class PurchaseCreate(BaseModel):
    item:          str
    category:      str
    quantity:      float  # Field(gt=0)
    price:         float  # Field(gt=0)
    purchase_date: str    # "YYYY-MM-DD"
    # user_id intentionally absent — comes from JWT

class PurchaseResponse(BaseModel):
    id:            int
    user_id:       int
    item:          str
    category:      str
    quantity:      float
    price:         float
    purchase_date: str
```

### prediction.py

**File:** `backend/app/routes/prediction.py`  
**Prefix:** `/api`

```
GET /api/predict-demand   → Demand forecast for all 30 items
GET /api/predict-waste    → Waste risk for all 30 items
```

**Inference logic (demand):**
```python
for item, stats in item_stats.items():
    row = _demand_row(stats)                  # [10 values]
    row_sc = scaler.transform(row)            # scale
    xgb_pred = xgb_model.predict(row_sc)      # XGBoost
    lin_pred = linear_model.predict(row_sc)   # Linear
```

**Feature encoding at inference time:**
```python
def _demand_row(stats: dict) -> np.ndarray:
    cat = CATEGORY_ENCODE.get(stats["category"], 3)
    return np.array([[
        stats["avg_quantity_last3"],
        stats["days_since_last"],
        stats["purchase_frequency"],
        stats["seasonal_factor"],
        stats["household_size"],
        stats["consumption_rate"],
        stats["price"],
        cat,
        stats["expiry_risk_proxy"],
        stats["is_festival_month"],
    ]])
```

### optimization.py

**File:** `backend/app/routes/optimization.py`  
**Prefix:** `/api`

```
POST /api/optimize-budget  → Knapsack-optimized shopping list
GET  /api/generate-plan    → 3-day weekly shopping plan
```

**Request schema:**
```python
class BudgetRequest(BaseModel):
    budget:               float  # required, > 0
    household_size:       int = 3
    preferred_categories: Optional[List[str]] = None
```

### comparison.py

**File:** `backend/app/routes/comparison.py`  
**Prefix:** `/api`

```
GET /api/compare-models → Full model comparison metrics + feature importance
```

Reads directly from `model_store["demand"]["metrics"]` and `model_store["waste"]["metrics"]`, formats into a structured comparison response.

---

## 8. Utils Layer

### auth.py

**File:** `backend/app/utils/auth.py`

JWT and password utilities used by all protected routes:

```python
SECRET_KEY = "smart-grocery-india-jwt-secret-2024"
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> int:
    # Decodes JWT → returns user_id (int) or raises 401
```

**Dependency injection pattern** — routes use `user_id: int = Depends(get_current_user_id)` to automatically authenticate every request:

```python
@router.get("/purchases")
def get_purchases(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    return db.query(PurchaseRecord).filter(PurchaseRecord.user_id == user_id).all()
```

**bcrypt note:** Uses `bcrypt` directly (`import bcrypt as _bcrypt`), not `passlib`. This avoids the `bcrypt.__about__` AttributeError introduced in bcrypt 4.x that breaks passlib 1.7.4.

### helpers.py

**File:** `backend/app/utils/helpers.py`

Contains:
- **`ITEMS` dict:** The authoritative 30-item catalog with all static properties
- **`SEASONAL_MULTIPLIERS` dict:** Per-item monthly demand multipliers for 13 items
- **`FESTIVAL_MONTHS` list:** `[1, 3, 8, 10, 11]` (Jan/Makar Sankranti, Mar/Holi, Aug/Raksha Bandhan, Oct/Dussehra, Nov/Diwali)
- **`MONSOON_MONTHS` list:** `[6, 7, 8, 9]`
- **`SUMMER_MONTHS` list:** `[4, 5, 6]`
- **`get_seasonal_factor(item, month)`:** Returns seasonal multiplier, defaulting to festival boost or 1.0
- **`ensure_data_dir()`:** Creates `backend/data/` if it doesn't exist
- **`DATA_DIR`:** Absolute path to the data directory

### store.py

**File:** `backend/app/utils/store.py`

The global model registry:
```python
model_store = {
    "demand": {
        "linear": None,
        "xgboost": None,
        "scaler": None,
        "feature_names": [],
        "metrics": {"linear": {}, "xgboost": {}},
    },
    "waste": {
        "logistic": None,
        "random_forest": None,
        "scaler": None,
        "feature_names": [],
        "metrics": {"logistic": {}, "random_forest": {}},
    },
    "item_stats": {},    # per-item inference features
    "initialized": False,
}
```

All routes guard against accessing before initialization:
```python
if not model_store["initialized"]:
    raise HTTPException(status_code=503, detail="Models not yet initialized")
```

---

## 9. Startup Sequence

Complete startup sequence with timing:

```
uvicorn app.main:app starts
         │
         ▼
FastAPI app created
  + CORSMiddleware attached
  + 4 routers registered
         │
         ▼ lifespan startup begins
         │
    create_tables()
    ├── Checks if grocery.db exists
    └── Creates purchases table if not present
         │
    generate_all_datasets()
    ├── grocery_purchases.csv  (3,000 rows)  ← ~1s if new
    ├── food_waste.csv         (1,200 rows)
    ├── retail_transactions.csv (~760 rows)
    ├── product_metadata.csv   (30 rows)
    ├── household_consumption.csv (2,160 rows)
    └── seasonal_data.csv      (12 rows)
         │ (skipped if files exist)
         │
    train_all_models()
    ├── build_demand_features()   ← ~1s (pandas joins + rolling ops)
    ├── build_waste_features()    ← ~0.3s
    ├── train Ridge Regression    ← < 100ms
    ├── train XGBoost             ← ~5–8s (200 trees)
    ├── train Logistic Regression ← < 100ms
    ├── train Random Forest       ← ~2–4s (150 trees)
    ├── evaluate all models on test sets
    ├── compute_item_stats()
    └── model_store["initialized"] = True
         │
         ▼
INFO: Application startup complete.
INFO: Uvicorn running on http://127.0.0.1:8000
```

**Total startup time:** ~12–18 seconds on first run; ~10–15 seconds on subsequent runs (datasets already generated).

---

## 10. Error Handling

### 503 Service Unavailable

Returned by prediction/optimization/comparison routes if called before startup completes:
```python
if not model_store["initialized"]:
    raise HTTPException(status_code=503, detail="Models not yet initialized")
```

### 400 Bad Request

Returned by `/add-purchase` for invalid inputs:
```python
if purchase.item not in ITEMS and purchase.category not in VALID_CATEGORIES:
    raise HTTPException(status_code=400, detail=f"Unknown item: {purchase.item}")
```

### 422 Unprocessable Entity

Automatically returned by FastAPI/Pydantic for schema validation failures (e.g., negative quantity, missing required fields).

### 500 Internal Server Error

Unhandled exceptions propagate as 500. FastAPI logs the traceback.

---

## 11. Configuration

All configuration is via hardcoded constants or environment-derived paths. No `.env` file required for basic operation.

| Setting | Value | Location |
|---------|-------|----------|
| Backend port | 8000 | `uvicorn` command |
| Database path | `backend/grocery.db` | `db.py` (relative to app root) |
| Data directory | `backend/data/` | `helpers.py` (derived from `__file__`) |
| CORS origins | `localhost:3000` | `main.py` |
| Random seed | 42 | `generator.py` |
| Train/test split | 80/20 | `evaluator.py` |

### Changing the Frontend URL (CORS)

If deploying frontend on a different port/domain, update `main.py`:
```python
allow_origins=["http://localhost:3000", "https://your-frontend.example.com"]
```

### Forcing Dataset Regeneration

```python
# From backend directory
python3 -c "
import sys; sys.path.insert(0, '.')
from app.datasets.generator import generate_all_datasets
generate_all_datasets(force=True)
"
```
