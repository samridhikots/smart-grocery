# API Reference
## Smart Grocery Management System

**Base URL:** `http://localhost:8000`  
**API Prefix:** `/api`  
**Interactive Docs:** `http://localhost:8000/docs` (Swagger UI)  
**ReDoc:** `http://localhost:8000/redoc`  
**Content-Type:** `application/json`

---

**Authentication:** Protected endpoints require `Authorization: Bearer <token>`. Tokens are obtained from `/api/auth/signup` or `/api/auth/login` and are valid for 30 days.

## Table of Contents

0. [Auth Endpoints](#0-auth-endpoints)
1. [Health Endpoints](#1-health-endpoints)
2. [POST /api/add-purchase](#2-post-apiadd-purchase)
3. [GET /api/purchases](#3-get-apipurchases)
4. [DELETE /api/purchases/{id}](#4-delete-apipurchasesid)
5. [GET /api/items](#5-get-apiitems)
6. [GET /api/predict-demand](#6-get-apipredict-demand)
7. [GET /api/predict-waste](#7-get-apipredict-waste)
8. [POST /api/optimize-budget](#8-post-apioptimize-budget)
9. [GET /api/insights](#9-get-apiinsights)
10. [GET /api/overspending](#10-get-apioverspending)
11. [GET /api/sustainability](#11-get-apisustainability)
12. [GET /api/compare-models](#12-get-apicompare-models)
13. [Error Responses](#13-error-responses)
14. [Sample cURL Commands](#14-sample-curl-commands)

---

## 0. Auth Endpoints

### POST /api/auth/signup

Create a new user account and return a JWT.

**Request Body:**
```json
{ "name": "Samridhi", "email": "s@example.com", "password": "secret123" }
```

**Response: 200 OK**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": 1, "name": "Samridhi", "email": "s@example.com",
    "household_size": 3, "monthly_budget": 3000.0,
    "dietary_prefs": "", "onboarding_complete": false
  }
}
```

**Error 400:** Email already registered.

---

### POST /api/auth/login

Authenticate and return a JWT.

**Request Body:**
```json
{ "email": "s@example.com", "password": "secret123" }
```

**Response:** Same shape as signup (200 OK).  
**Error 401:** Invalid credentials.

---

### GET /api/auth/me

Return the current user's profile. **Requires Bearer token.**

**Response: 200 OK** — `User` object (same shape as above).

---

### PUT /api/auth/onboarding

Save onboarding data and mark `onboarding_complete = true`. **Requires Bearer token.**

**Request Body:**
```json
{ "household_size": 4, "monthly_budget": 5000.0, "dietary_prefs": "Vegetarian" }
```

**Response: 200 OK** — Updated `User` object.

---

## 1. Health Endpoints

### GET /

Returns basic API information.

**Response:**
```json
{
  "message": "Smart Grocery Management System — India",
  "version": "2.0.0",
  "models": ["Ridge", "XGBoost", "Logistic", "TabNet", "IsolationForest", "FP-Growth", "Sustainability"],
  "docs": "/docs"
}
```

---

### GET /health

Returns server health and model readiness status.

**Response:**
```json
{
  "status": "ready",
  "models_ready": true,
  "models": {
    "demand_linear":  true,
    "demand_xgboost": true,
    "waste_logistic": true,
    "waste_tabnet":   true,
    "anomaly":        true,
    "recommender":    true,
    "sustainability": true
  }
}
```

> **Note:** `status` is `"initializing"` and `models_ready` is `false` while training runs in the background. All prediction/optimization endpoints return `503` until `models_ready` is `true`. Training can take up to ~15 minutes on cold start; cached runs (datasets unchanged) complete in under 5 seconds.

---

## 2. POST /api/add-purchase

Record a grocery purchase. **Requires Bearer token.** The `user_id` is extracted from the JWT — do not send it in the body.

**Request Body:**

```json
{
  "item": "Tomato",
  "category": "Vegetables",
  "quantity": 1.5,
  "price": 37.50,
  "purchase_date": "2024-05-01"
}
```

| Field | Type | Required | Validation | Description |
|-------|------|----------|-----------|-------------|
| `item` | string | Yes | — | Item name |
| `category` | string | Yes | — | Category name |
| `quantity` | float | Yes | > 0 | Amount in kg or units |
| `price` | float | Yes | > 0 | Total price paid (₹) |
| `purchase_date` | string | Yes | — | Format: `YYYY-MM-DD` |

**Response: 201 Created**

```json
{
  "id": 42,
  "user_id": 1,
  "item": "Tomato",
  "category": "Vegetables",
  "quantity": 1.5,
  "price": 3.75,
  "purchase_date": "2024-05-01"
}
```

**Error: 400 Bad Request**
```json
{ "detail": "Unknown item: BadItem" }
```

**Error: 422 Unprocessable Entity**
```json
{
  "detail": [{"loc": ["body", "quantity"], "msg": "ensure this value is greater than 0"}]
}
```

---

## 3. GET /api/purchases

List the authenticated user's purchases, most recent first. **Requires Bearer token.**

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 50 | Maximum number of records to return |

**Example:** `GET /api/purchases?limit=100`

**Response: 200 OK**

```json
[
  {
    "id": 42,
    "user_id": 1,
    "item": "Tomato",
    "category": "Vegetables",
    "quantity": 1.5,
    "price": 3.75,
    "purchase_date": "2024-05-01"
  },
  {
    "id": 41,
    "user_id": 1,
    "item": "Milk",
    "category": "Dairy",
    "quantity": 2.0,
    "price": 5.00,
    "purchase_date": "2024-04-29"
  }
]
```

Returns empty array `[]` if no purchases exist.

---

## 4. DELETE /api/purchases/{id}

Delete a purchase record. **Requires Bearer token.** Returns 403 if the purchase belongs to a different user.

**Path parameter:** `id` — the purchase record ID.

**Response: 204 No Content**  
**Error 403:** Forbidden — purchase does not belong to the current user.  
**Error 404:** Purchase not found.

---

## 5. GET /api/items

List all items in the product catalog.

**Response: 200 OK**

```json
[
  {
    "item": "Tomato",
    "category": "Vegetables",
    "avg_price": 2.5,
    "shelf_life": 7,
    "priority": 8
  },
  {
    "item": "Rice",
    "category": "Grains",
    "avg_price": 3.0,
    "shelf_life": 365,
    "priority": 9
  }
]
```

Returns 30 items. No parameters required.

---

## 5. GET /api/predict-demand

Get demand predictions for all catalog items using both models.

**Response: 200 OK**

```json
{
  "predictions": [
    {
      "item": "Spinach",
      "category": "Vegetables",
      "brand": "Local",
      "predicted_quantity_xgboost": 0.48,
      "predicted_quantity_linear": 0.51,
      "historical_avg": 0.50,
      "confidence": 0.79,
      "recommended_quantity": 0.48,
      "unit_price_inr": 30.0,
      "estimated_cost_inr": 14.4,
      "days_until_next": 3,
      "seasonal_factor": 1.0,
      "is_festival_month": 0,
      "urgency_message": "Buy in 3 days."
    },
    {
      "item": "Milk",
      "category": "Dairy",
      "brand": "Amul",
      "predicted_quantity_xgboost": 2.41,
      "predicted_quantity_linear": 2.38,
      "historical_avg": 2.31,
      "confidence": 0.82,
      "recommended_quantity": 2.41,
      "unit_price_inr": 60.0,
      "estimated_cost_inr": 144.6,
      "days_until_next": 7,
      "seasonal_factor": 1.02,
      "is_festival_month": 0,
      "urgency_message": "Next purchase in ~7 days."
    }
  ],
  "model_used": "XGBoost (primary)",
  "total_items": 30,
  "currency": "INR"
}
```

**Response Fields:**

| Field | Description |
|-------|-------------|
| `predicted_quantity_xgboost` | XGBoost model prediction (primary) |
| `predicted_quantity_linear` | Ridge Linear Regression prediction (baseline) |
| `historical_avg` | Rolling mean quantity from recent purchases |
| `confidence` | Model confidence score (0.0–1.0), derived from test R² |
| `recommended_quantity` | Same as `predicted_quantity_xgboost` |
| `unit_price_inr` | Average price per unit in ₹ |
| `estimated_cost_inr` | `recommended_quantity × unit_price_inr` |
| `days_until_next` | `30 / purchase_frequency` — estimated days to next needed purchase |
| `seasonal_factor` | Current month demand multiplier from seasonal dataset |
| `is_festival_month` | 1 if current month is a festival month |
| `urgency_message` | Human-readable buy-now guidance |

Results are sorted by `days_until_next` ascending (most urgent first). Requires Bearer token.

**Error: 503**
```json
{ "detail": "Models not yet initialized" }
```

---

## 6. GET /api/predict-waste

Get waste risk predictions for all items using both models.

**Response: 200 OK**

```json
{
  "waste_alerts": [
    {
      "item": "Spinach",
      "category": "Vegetables",
      "brand": "Local",
      "waste_probability_tabnet": 0.741,
      "waste_probability_logistic": 0.683,
      "risk_level": "High",
      "days_until_expiry": 2,
      "shelf_life_days": 5,
      "recommendation": "Use Spinach within 2 days — high spoilage risk! Monsoon humidity increases risk — check daily.",
      "is_perishable": 1
    },
    {
      "item": "Chicken",
      "category": "Protein",
      "brand": "Local",
      "waste_probability_tabnet": 0.632,
      "waste_probability_logistic": 0.594,
      "risk_level": "High",
      "days_until_expiry": 1,
      "shelf_life_days": 3,
      "recommendation": "Use Chicken within 1 days — high spoilage risk!",
      "is_perishable": 1
    },
    {
      "item": "Rice",
      "category": "Grains",
      "brand": "Aashirvaad",
      "waste_probability_tabnet": 0.072,
      "waste_probability_logistic": 0.091,
      "risk_level": "Low",
      "days_until_expiry": 255,
      "shelf_life_days": 365,
      "recommendation": "Rice has low waste risk. Normal usage is fine.",
      "is_perishable": 0
    }
  ],
  "high_risk_count": 7,
  "medium_risk_count": 4
}
```

**Risk Level Thresholds** (driven by TabNet probability):

| `waste_probability_tabnet` | `risk_level` |
|---------------------------|-------------|
| > 0.60 | `"High"` |
| 0.35 – 0.60 | `"Medium"` |
| < 0.35 | `"Low"` |

Results are sorted by `waste_probability_tabnet` descending (highest risk first).

---

## 7. POST /api/optimize-budget

Generate a personalized budget-optimized shopping list based on the user's actual purchase history. **Requires Bearer token.**

**Request Body:**

```json
{
  "budget": 2000.0,
  "household_size": 4,
  "preferred_categories": ["Vegetables", "Fruits", "Dairy", "Protein"]
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `budget` | float | Yes | — | Total budget in ₹ (> 0) |
| `household_size` | int | No | 3 | Household size (1–10) |
| `preferred_categories` | array | No | null | Filter to these categories only. Pass `null` or omit for all categories |

**Response: 200 OK**

```json
{
  "total_cost": 1820.0,
  "total_needed": 2400.0,
  "budget": 2000.0,
  "savings": 180.0,
  "budget_gap": 400.0,
  "is_over_budget": true,
  "optimization_score": 0.82,
  "items_count": 8,
  "total_items_needed": 12,
  "currency": "INR",
  "items": [
    {
      "item": "Spinach",
      "category": "Vegetables",
      "quantity": 1.0,
      "unit_price": 30.0,
      "total_cost": 30.0,
      "priority_score": 9,
      "nutrition_score": 8.2,
      "days_until_next": 2,
      "urgency_label": "Buy today",
      "is_perishable": true,
      "status": "included",
      "note": null
    },
    {
      "item": "Milk",
      "category": "Dairy",
      "quantity": 2.0,
      "unit_price": 60.0,
      "total_cost": 120.0,
      "priority_score": 8,
      "nutrition_score": 8.8,
      "days_until_next": 3,
      "urgency_label": "This week",
      "is_perishable": true,
      "status": "included",
      "note": null
    }
  ],
  "deferred_items": [
    {
      "item": "Rice",
      "category": "Grains",
      "quantity": 5.0,
      "unit_price": 80.0,
      "total_cost": 400.0,
      "priority_score": 7,
      "nutrition_score": 7.5,
      "days_until_next": 14,
      "urgency_label": "Later",
      "is_perishable": false,
      "status": "deferred",
      "note": "Deferred — over budget"
    }
  ]
}
```

**Response Fields:**

| Field | Description |
|-------|-------------|
| `total_cost` | Actual cost of selected (included/partial) items |
| `total_needed` | Total cost if all candidate items were purchased (including deferred) |
| `budget` | The budget passed in the request |
| `savings` | `budget - total_cost` — unspent amount (0 if over budget) |
| `budget_gap` | `max(0, total_needed - budget)` — how much more is needed |
| `is_over_budget` | `true` when `total_needed > budget` |
| `optimization_score` | Value delivered / max possible value (0.0–1.0) |
| `items_count` | Number of selected items |
| `total_items_needed` | Total candidate count (selected + deferred) |
| `items` | Items that fit within the budget, sorted by urgency |
| `deferred_items` | Items that couldn't fit, sorted by urgency |
| `currency` | Always `"INR"` |

**Per-item fields (in both `items` and `deferred_items`):**

| Field | Description |
|-------|-------------|
| `days_until_next` | Estimated days until item is needed (from purchase history) |
| `urgency_label` | `"Buy today"` (≤2 days) / `"This week"` (3–7 days) / `"Later"` (>7 days) |
| `is_perishable` | `true` for items with short shelf life |
| `status` | `"included"` / `"partial"` / `"deferred"` |
| `note` | Reason string for partial/deferred items, `null` for included |

**Note on fallback:** If the authenticated user has 0 purchase records, falls back to catalog-based optimization (same response shape, `deferred_items=[]`, `is_over_budget=false`).

**Error: 401 Unauthorized** — Missing or invalid Bearer token.  
**Error: 503** — Models not yet initialized.

---

## 8. GET /api/generate-plan

Generate a 3-day weekly shopping plan organized by shopping trip.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `household_size` | int | 3 | Household size |

**Example:** `GET /api/generate-plan?household_size=4`

**Response: 200 OK**

```json
{
  "week_plan": [
    {
      "day": "Monday",
      "items": [
        { "item": "Tomato", "category": "Vegetables", "quantity": 2.0, "estimated_price": 5.0 },
        { "item": "Spinach", "category": "Vegetables", "quantity": 0.67, "estimated_price": 1.0 },
        { "item": "Milk", "category": "Dairy", "quantity": 2.67, "estimated_price": 6.67 },
        { "item": "Chicken", "category": "Protein", "quantity": 1.33, "estimated_price": 10.64 }
      ]
    },
    {
      "day": "Wednesday",
      "items": [
        { "item": "Apple", "category": "Fruits", "quantity": 2.0, "estimated_price": 8.0 },
        { "item": "Yogurt", "category": "Dairy", "quantity": 0.67, "estimated_price": 2.0 }
      ]
    },
    {
      "day": "Saturday",
      "items": [
        { "item": "Rice", "category": "Grains", "quantity": 2.67, "estimated_price": 8.0 },
        { "item": "Lentils", "category": "Protein", "quantity": 1.33, "estimated_price": 4.0 }
      ]
    }
  ],
  "estimated_weekly_cost": 62.40,
  "household_size": 4,
  "shopping_days": ["Monday", "Wednesday", "Saturday"]
}
```

**Shopping Day Logic:**

| Day | Items | Shelf Life Criteria |
|-----|-------|---------------------|
| Monday | Perishables | shelf_life ≤ 7 days |
| Wednesday | Semi-perishables + fresh overflow | shelf_life 8–30 days |
| Saturday | Pantry staples | shelf_life > 30 days |

---

## 9. GET /api/insights

Return ML-generated insights for the authenticated user. **Requires Bearer token.**

**Response: 200 OK**
```json
{
  "user_id": 1,
  "insights": [
    {
      "title": "High spending on Vegetables",
      "message": "You spent ₹820 on Vegetables — 32% of your total budget.",
      "severity": "high",
      "data": { "spend": 820, "pct": 32.0 }
    }
  ],
  "total": 5
}
```

`severity` values: `"critical"` | `"high"` | `"medium"` | `"info"` | `"low"`

---

## 10. GET /api/overspending

Detect whether the current month's spend is anomalous using IsolationForest. **Requires Bearer token.**

**Query Parameters:** `month` (int, default = current month), `year` (int, default = current year)

**Response: 200 OK**
```json
{
  "is_overspending": true,
  "anomaly_score": -0.0823,
  "monthly_spend": 4200.0,
  "rolling_avg_3m": 3100.0,
  "overspent_by": 1100.0,
  "n_unique_items": 21,
  "category_breakdown": {
    "Vegetables": 820.0,
    "Dairy": 630.0,
    "Grains": 450.0
  },
  "message": "You overspent ₹1100 vs your 3-month average."
}
```

| Field | Description |
|-------|-------------|
| `is_overspending` | `true` if Isolation Forest labels this month as anomalous |
| `anomaly_score` | Raw IF score — negative = anomalous, positive = normal |
| `monthly_spend` | Total ₹ spent this month |
| `rolling_avg_3m` | 3-month rolling average spend |
| `overspent_by` | `max(0, monthly_spend - rolling_avg_3m)` |
| `n_unique_items` | Number of distinct items purchased this month |
| `category_breakdown` | Per-category spend (₹) for this month |
| `message` | Human-readable verdict |

Returns `"Not enough purchase history to detect overspending."` in `message` if no current-month data exists.

---

## 11. GET /api/sustainability

Return the user's environmental footprint for recent purchases. **Requires Bearer token.**

**Query Parameters:** `months` (int, default = 1)

**Response: 200 OK**
```json
{
  "total_co2_kg_estimate": 12.4,
  "avg_eco_score": 6.8,
  "plastic_packaging_pct": 42.0,
  "non_biodegradable_pct": 35.0,
  "swap_suggestions": [
    { "item": "Paneer", "swap_to": "Tofu", "co2_saving_pct": 28, "reason": "Lower CO₂ per unit" }
  ]
}
```

**GET /api/sustainability/items** (no auth) — returns all 30 items' static eco profiles.

---

## 12. GET /api/compare-models

Return full model comparison metrics, winners, and feature importance.

**Response: 200 OK**

```json
{
  "demand_prediction": {
    "task": "Regression — predict next purchase quantity",
    "metric_description": "Lower MAE/RMSE is better; Higher R² is better",
    "legacy": {
      "name": "Ridge Linear Regression",
      "type": "Legacy",
      "split": "test",
      "mae": 0.2607,
      "rmse": 0.4180,
      "r2": 0.8642,
      "directional_accuracy": 0.9158
    },
    "modern": {
      "name": "XGBoost Regressor",
      "type": "Modern",
      "split": "test",
      "mae": 0.2885,
      "rmse": 0.4867,
      "r2": 0.8160,
      "directional_accuracy": 0.9084
    },
    "winner": "Ridge Linear Regression",
    "improvement": {
      "mae_reduction": -0.0278,
      "r2_gain": -0.0482
    },
    "features_count": 13,
    "feature_names": ["avg_quantity_last3", "days_since_last", "purchase_frequency",
                      "seasonal_factor", "household_size", "consumption_rate",
                      "price", "category_encoded", "expiry_risk_proxy",
                      "is_festival_month", "price_variation_index",
                      "is_summer_month", "is_monsoon_month"]
  },
  "waste_prediction": {
    "task": "Classification — predict if item will be wasted",
    "metric_description": "Higher accuracy/F1/AUC is better",
    "features_count": 24,
    "legacy": {
      "name": "Logistic Regression",
      "type": "Legacy",
      "split": "test",
      "accuracy": 0.6375,
      "precision": 0.5304,
      "recall": 0.6489,
      "f1": 0.5837,
      "roc_auc": 0.6529,
      "confusion_matrix": { "tn": 7890, "fp": 4310, "fn": 4230, "tp": 7570 }
    },
    "modern": {
      "name": "TabNet Classifier",
      "type": "Modern",
      "split": "test",
      "accuracy": 0.74,
      "precision": 0.70,
      "recall": 0.72,
      "f1": 0.71,
      "roc_auc": 0.78,
      "confusion_matrix": { "tn": 8812, "fp": 3388, "fn": 3360, "tp": 8440 }
    },
    "winner": "TabNet",
    "improvement": {
      "f1_gain": 0.08,
      "auc_gain": 0.08
    }
  },
  "anomaly_detection": {
    "task": "Unsupervised — detect overspending months per user",
    "model": "Isolation Forest",
    "trained": true,
    "params": { "n_estimators": 150, "contamination": 0.1 }
  },
  "recommendation": {
    "task": "Association rules — suggest co-purchased items",
    "model": "FP-Growth",
    "trained": true,
    "top_rules": [
      { "if": ["Atta"], "then": ["Toor Dal"], "confidence": 0.72, "lift": 3.4 }
    ]
  },
  "feature_importance": {
    "demand_xgboost": {
      "avg_quantity_last3": 0.4521,
      "consumption_rate": 0.1803,
      "household_size": 0.1245,
      "seasonal_factor": 0.0823,
      "price": 0.0612,
      "purchase_frequency": 0.0401,
      "days_since_last": 0.0298,
      "expiry_risk_proxy": 0.0172,
      "is_festival_month": 0.0091,
      "category_encoded": 0.0034
    },
    "waste_tabnet": {
      "waste_risk_interaction": 0.14,
      "expiry_risk": 0.12,
      "consumption_rate": 0.10,
      "rolling_waste_rate": 0.09,
      "category_risk_avg": 0.08,
      "expiry_days": 0.07,
      "consumption_to_expiry_ratio": 0.07,
      "shelf_life": 0.06,
      "perishability_score": 0.05,
      "normalized_quantity": 0.04,
      "quantity_per_household": 0.03,
      "price_sensitivity_score": 0.03,
      "price_per_unit": 0.03,
      "seasonal_waste_factor": 0.02,
      "is_perishable": 0.02,
      "quantity": 0.02,
      "price": 0.01,
      "nutrition_score": 0.01,
      "household_size_proxy": 0.01,
      "category_encoded": 0.00
    }
  }
}
```

**Note on `improvement` fields:**  
Negative values mean the legacy model performs better on this metric for this dataset. This is a valid and realistic outcome — simpler models sometimes outperform complex ones on linear data.

---

## 10. Error Responses

### Standard Error Format

All error responses follow FastAPI's standard format:

```json
{
  "detail": "Error message here"
}
```

### HTTP Status Codes

| Code | Meaning | When It Occurs |
|------|---------|----------------|
| 200 | OK | Successful GET request |
| 201 | Created | Successful POST /add-purchase |
| 400 | Bad Request | Invalid item/category in add-purchase |
| 422 | Unprocessable Entity | Pydantic validation failure (missing/invalid fields) |
| 503 | Service Unavailable | Models not yet initialized (startup in progress) |
| 500 | Internal Server Error | Unexpected exception |

### 422 Example (Validation Error)

```bash
curl -X POST http://localhost:8000/api/add-purchase \
  -H "Content-Type: application/json" \
  -d '{"item": "Tomato", "category": "Vegetables", "quantity": -1, "price": 3.0, "purchase_date": "2024-01-01"}'
```

Response:
```json
{
  "detail": [
    {
      "type": "greater_than",
      "loc": ["body", "quantity"],
      "msg": "Input should be greater than 0",
      "input": -1
    }
  ]
}
```

---

## 11. Sample cURL Commands

### Add a Purchase

```bash
curl -X POST http://localhost:8000/api/add-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "item": "Tomato",
    "category": "Vegetables",
    "quantity": 1.5,
    "price": 3.75,
    "purchase_date": "2024-05-01"
  }'
```

### List Recent Purchases

```bash
curl "http://localhost:8000/api/purchases?limit=5"
```

### Get Demand Predictions

```bash
curl http://localhost:8000/api/predict-demand | python3 -m json.tool | head -40
```

### Get Waste Alerts (High Risk Only)

```bash
curl http://localhost:8000/api/predict-waste | \
  python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps([x for x in data['waste_alerts'] if x['risk_level']=='High'], indent=2))"
```

### Optimize a $100 Budget for Family of 4

```bash
curl -X POST http://localhost:8000/api/optimize-budget \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 100,
    "household_size": 4,
    "preferred_categories": ["Vegetables", "Fruits", "Dairy", "Protein"]
  }'
```

### Generate Weekly Plan

```bash
curl "http://localhost:8000/api/generate-plan?household_size=3"
```

### Get Model Comparison

```bash
curl http://localhost:8000/api/compare-models | python3 -m json.tool
```

### Check Health

```bash
curl http://localhost:8000/health
```

### Run All Endpoints in Sequence

```bash
#!/bin/bash
BASE="http://localhost:8000/api"
echo "=== Health Check ==="
curl -s http://localhost:8000/health | python3 -m json.tool

echo -e "\n=== Add Purchase ==="
curl -s -X POST $BASE/add-purchase \
  -H "Content-Type: application/json" \
  -d '{"item":"Milk","category":"Dairy","quantity":2,"price":5.0,"purchase_date":"2024-05-01"}' | python3 -m json.tool

echo -e "\n=== Demand Prediction (first item) ==="
curl -s $BASE/predict-demand | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['predictions'][0], indent=2))"

echo -e "\n=== Waste Prediction (first item) ==="
curl -s $BASE/predict-waste | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['waste_alerts'][0], indent=2))"

echo -e "\n=== Budget Optimization (\$50) ==="
curl -s -X POST $BASE/optimize-budget \
  -H "Content-Type: application/json" \
  -d '{"budget":50,"household_size":3}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Items: {d[\"items_count\"]}, Cost: \${d[\"total_cost\"]:.2f}, Score: {d[\"optimization_score\"]}')"

echo -e "\n=== Model Comparison Winners ==="
curl -s $BASE/compare-models | python3 -c "import sys,json; d=json.load(sys.stdin); print('Demand winner:', d['demand_prediction']['winner']); print('Waste winner:', d['waste_prediction']['winner'])"
```
