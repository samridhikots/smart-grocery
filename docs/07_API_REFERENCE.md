# API Reference
## Smart Grocery Management System

**Base URL:** `http://localhost:8000`  
**API Prefix:** `/api`  
**Interactive Docs:** `http://localhost:8000/docs` (Swagger UI)  
**ReDoc:** `http://localhost:8000/redoc`  
**Content-Type:** `application/json`

---

## Table of Contents

1. [Health Endpoints](#1-health-endpoints)
2. [POST /api/add-purchase](#2-post-apiadd-purchase)
3. [GET /api/purchases](#3-get-apipurchases)
4. [GET /api/items](#4-get-apiitems)
5. [GET /api/predict-demand](#5-get-apipredict-demand)
6. [GET /api/predict-waste](#6-get-apipredict-waste)
7. [POST /api/optimize-budget](#7-post-apioptimize-budget)
8. [GET /api/generate-plan](#8-get-apigenerate-plan)
9. [GET /api/compare-models](#9-get-apicompare-models)
10. [Error Responses](#10-error-responses)
11. [Sample cURL Commands](#11-sample-curl-commands)

---

## 1. Health Endpoints

### GET /

Returns basic API information.

**Response:**
```json
{
  "message": "Smart Grocery Management System",
  "version": "1.0.0",
  "docs": "/docs"
}
```

---

### GET /health

Returns server health and model readiness status.

**Response:**
```json
{
  "status": "healthy",
  "models_ready": true
}
```

> **Note:** `models_ready` will be `false` during the startup training phase (~15 seconds). Prediction/optimization endpoints return `503` until this becomes `true`.

---

## 2. POST /api/add-purchase

Record a grocery purchase in the database.

**Request Body:**

```json
{
  "item": "Tomato",
  "category": "Vegetables",
  "quantity": 1.5,
  "price": 3.75,
  "purchase_date": "2024-05-01",
  "user_id": 1
}
```

| Field | Type | Required | Validation | Description |
|-------|------|----------|-----------|-------------|
| `item` | string | Yes | — | Item name (any string) |
| `category` | string | Yes | — | Category name |
| `quantity` | float | Yes | > 0 | Amount in kg or units |
| `price` | float | Yes | > 0 | Total price paid ($) |
| `purchase_date` | string | Yes | — | Format: `YYYY-MM-DD` |
| `user_id` | int | No | default=1 | Household identifier |

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

List recorded purchases, most recent first.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 50 | Maximum number of records to return |
| `user_id` | int | none | Filter by user/household ID |

**Example:** `GET /api/purchases?limit=10&user_id=1`

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

## 4. GET /api/items

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
      "item": "Milk",
      "category": "Dairy",
      "predicted_quantity_xgboost": 2.41,
      "predicted_quantity_linear": 2.38,
      "historical_avg": 2.31,
      "confidence": 0.92,
      "recommended_quantity": 2.41,
      "unit_price": 2.5,
      "days_until_next": 8,
      "seasonal_factor": 1.02
    },
    {
      "item": "Tomato",
      "category": "Vegetables",
      "predicted_quantity_xgboost": 3.29,
      "predicted_quantity_linear": 3.31,
      "historical_avg": 2.31,
      "confidence": 0.85,
      "recommended_quantity": 3.29,
      "unit_price": 2.5,
      "days_until_next": 8,
      "seasonal_factor": 1.02
    }
  ],
  "model_used": "XGBoost (modern)",
  "total_items": 30
}
```

**Response Fields:**

| Field | Description |
|-------|-------------|
| `predicted_quantity_xgboost` | XGBoost model prediction |
| `predicted_quantity_linear` | Ridge Linear Regression prediction |
| `historical_avg` | Mean quantity from training data |
| `confidence` | Model confidence score (0.0–1.0) |
| `recommended_quantity` | Use this value — XGBoost prediction |
| `unit_price` | Average price per unit ($) |
| `days_until_next` | Estimated days until next purchase needed |
| `seasonal_factor` | Current month demand multiplier |

Results are sorted by `confidence` descending. Returns 30 items.

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
      "waste_probability_tabnet": 0.741,
      "waste_probability_logistic": 0.683,
      "risk_level": "High",
      "days_until_expiry": 2,
      "recommendation": "Use Spinach within 2 days — high spoilage risk!",
      "shelf_life": 5
    },
    {
      "item": "Chicken",
      "category": "Protein",
      "waste_probability_tabnet": 0.632,
      "waste_probability_logistic": 0.594,
      "risk_level": "High",
      "days_until_expiry": 1,
      "recommendation": "Use Chicken within 1 days — high spoilage risk!",
      "shelf_life": 3
    },
    {
      "item": "Rice",
      "category": "Grains",
      "waste_probability_tabnet": 0.072,
      "waste_probability_logistic": 0.091,
      "risk_level": "Low",
      "days_until_expiry": 255,
      "recommendation": "Rice has low waste risk, normal usage is fine.",
      "shelf_life": 365
    }
  ],
  "high_risk_count": 7
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

Generate an optimized shopping list for a given budget.

**Request Body:**

```json
{
  "budget": 80.0,
  "household_size": 4,
  "preferred_categories": ["Vegetables", "Fruits", "Dairy", "Protein"]
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `budget` | float | Yes | — | Total budget in dollars (> 0) |
| `household_size` | int | No | 3 | Household size (1–10) |
| `preferred_categories` | array | No | null | Filter to these categories only. Pass `null` or omit for all categories |

**Response: 200 OK**

```json
{
  "total_cost": 78.92,
  "budget": 80.0,
  "savings": 1.08,
  "optimization_score": 0.946,
  "items_count": 13,
  "items": [
    {
      "item": "Chicken",
      "category": "Protein",
      "quantity": 1.33,
      "unit_price": 8.0,
      "total_cost": 10.64,
      "priority_score": 9,
      "nutrition_score": 8.45
    },
    {
      "item": "Tomato",
      "category": "Vegetables",
      "quantity": 2.0,
      "unit_price": 2.5,
      "total_cost": 5.0,
      "priority_score": 8,
      "nutrition_score": 8.34
    }
  ]
}
```

**Response Fields:**

| Field | Description |
|-------|-------------|
| `total_cost` | Actual total cost of selected items |
| `savings` | `budget - total_cost` — unspent amount |
| `optimization_score` | Value delivered / max possible value (0.0–1.0) |
| `items_count` | Number of items in the list |
| `items` | Shopping list sorted by category |

**Note on `optimization_score`:**  
`1.0 = perfect` (maximum possible priority × nutrition per dollar within budget).  
Typically > 0.90 for reasonable budgets.

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

## 9. GET /api/compare-models

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
    }
  },
  "waste_prediction": {
    "task": "Classification — predict if item will be wasted",
    "metric_description": "Higher accuracy/F1/AUC is better",
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
