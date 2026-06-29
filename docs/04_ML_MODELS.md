# Machine Learning Models Documentation
## Smart Grocery Management System

---

## Table of Contents

1. [Model Overview](#1-model-overview)
2. [Demand Prediction — Problem Formulation](#2-demand-prediction--problem-formulation)
3. [Legacy Demand Model: Ridge Linear Regression](#3-legacy-demand-model-ridge-linear-regression)
4. [Modern Demand Model: XGBoost Regressor](#4-modern-demand-model-xgboost-regressor)
5. [Waste Prediction — Problem Formulation](#5-waste-prediction--problem-formulation)
6. [Legacy Waste Model: Logistic Regression](#6-legacy-waste-model-logistic-regression)
7. [Modern Waste Model: TabNet Classifier](#7-modern-waste-model-tabnet-classifier)
8. [Anomaly Detection: Isolation Forest](#8-anomaly-detection-isolation-forest)
9. [Recommendation Engine: FP-Growth](#9-recommendation-engine-fp-growth)
10. [Sustainability Tracker (Rule-Based)](#10-sustainability-tracker-rule-based)
11. [Training Pipeline](#11-training-pipeline)
12. [Model Storage and Serving](#12-model-storage-and-serving)
13. [Evaluation Metrics Explained](#13-evaluation-metrics-explained)
14. [Why These Seven Models?](#14-why-these-seven-models)

---

## 1. Model Overview

The system contains **7 models** — **6 ML models** organized as **2 legacy + 2 modern** supervised pairs, plus an unsupervised anomaly detector, a frequent-pattern recommender, and a rule-based sustainability tracker:

| Task | Model | Type | Problem Type |
|------|-------|------|-------------|
| Demand Prediction (legacy) | Ridge Linear Regression | Supervised | Regression |
| Demand Prediction (modern) | XGBoost Regressor | Supervised | Regression |
| Waste Prediction (legacy) | Logistic Regression | Supervised | Classification |
| Waste Prediction (modern) | TabNet Classifier | Supervised | Classification |
| Overspending Detection | Isolation Forest | Unsupervised | Anomaly Detection |
| Grocery Recommendations | FP-Growth | Unsupervised | Association Rules |
| Sustainability Tracking | Rule-Based Tracker | Rule-Based | Scoring |

**Evaluation split:** 80% training / 20% test for supervised models  
**Metrics computed:** On test set only (never on training data)  
**Preprocessing:** StandardScaler applied to demand and waste feature matrices before training

---

## 2. Demand Prediction — Problem Formulation

### Task Definition

Given the purchase history and contextual information for a (household, item) pair:
> **Predict the quantity of the item the household will purchase on their next shopping trip.**

### Input Features (13)

```
X = [avg_quantity_last3, days_since_last, purchase_frequency, seasonal_factor,
     household_size, consumption_rate, price, category_encoded,
     expiry_risk_proxy, is_festival_month,
     price_variation_index, is_summer_month, is_monsoon_month]
```

### Target Variable

```
y = next_quantity  (continuous, clipped to [0.1, 20.0])
```

**Example target values:**
- "Buy 2.3 kg Tomatoes" → y = 2.3
- "Buy 1.0 litre Milk" → y = 1.0
- "Buy 0.25 kg Butter" → y = 0.25

### Training Data

- **Rows:** ~6,000 (after dropping last purchase per user-item pair)
- **Source:** `grocery_purchases.csv` + join with 3 other datasets
- **Train/Test:** 4,800 / 1,200

---

## 3. Legacy Demand Model: Ridge Linear Regression

### Algorithm Description

Ridge Regression extends Ordinary Least Squares (OLS) by adding an L2 regularization penalty to the loss function:

```
Minimize: ||Xw - y||² + α||w||²
```

Where:
- `X` = feature matrix (scaled)
- `w` = weight vector
- `y` = target values
- `α` = regularization strength (hyperparameter)

The L2 penalty prevents overfitting by shrinking large coefficients toward zero. Unlike Lasso (L1), Ridge never sets coefficients exactly to zero — all features remain active.

### Why Ridge over OLS?

With 13 features and moderate correlation (e.g., `avg_quantity_last3` and `consumption_rate` are correlated), pure OLS can produce inflated, unstable coefficients. Ridge stabilises this.

### Hyperparameters

```python
Ridge(alpha=1.0)
```

| Parameter | Value | Justification |
|-----------|-------|---------------|
| `alpha` | 1.0 | Default regularization — sufficient given ~6K training rows and 13 features |

### Model Weights (Conceptual)

After training on scaled features, the model learns weights approximately like:

```
next_quantity ≈ 0.72 × avg_quantity_last3
              + 0.15 × household_size
              + 0.08 × consumption_rate
              + 0.05 × seasonal_factor
              - 0.03 × expiry_risk_proxy
              + 0.02 × is_festival_month
              + ...intercept
```

The `avg_quantity_last3` weight dominates because grocery purchasing has strong auto-regressive structure.

### Strengths

- **Interpretable:** Coefficients can be directly read as feature contributions
- **Fast training:** O(n × d²) — milliseconds for our scale
- **Stable:** Low variance, predictable behavior
- **Calibrated predictions:** Linear relationship is reasonable for demand forecasting

### Weaknesses

- **Cannot capture non-linear interactions** (e.g., Mango seasonal spike × festival month compound effect)
- **Assumes constant relationships** — doesn't adapt when patterns shift
- **No feature interaction terms** unless manually engineered

### Test Metrics (Actual)

```
MAE:                   0.2607
RMSE:                  0.4180
R² Score:              0.8642
Directional Accuracy:  0.9158
```

---

## 4. Modern Demand Model: XGBoost Regressor

### Algorithm Description

XGBoost (Extreme Gradient Boosting) is an ensemble of decision trees built sequentially. Each new tree learns to correct the residual errors of the previous ensemble.

**Gradient Boosting Framework:**
```
F₀(x) = mean(y)                              # initial prediction
Fₜ(x) = Fₜ₋₁(x) + η × hₜ(x)               # add new tree scaled by η
where hₜ = argmin Σ L(yᵢ, Fₜ₋₁(xᵢ) + h(xᵢ))  # tree fitted on negative gradient
```

XGBoost adds several improvements over vanilla GBM:
1. **Regularization:** L1 and L2 penalties on leaf weights
2. **Approximate split finding:** Efficient handling of large feature sets
3. **Column subsampling:** `colsample_bytree` introduces randomness, reducing variance
4. **Parallel tree construction:** Uses OpenMP for multi-core training

### Hyperparameters

```python
XGBRegressor(
    n_estimators=200,       # number of trees
    max_depth=5,            # max tree depth
    learning_rate=0.08,     # shrinkage factor η
    subsample=0.8,          # row sampling per tree
    colsample_bytree=0.8,   # feature sampling per tree
    random_state=42,
    verbosity=0,
)
```

| Parameter | Value | Justification |
|-----------|-------|---------------|
| `n_estimators` | 200 | Enough trees for convergence without overfitting |
| `max_depth` | 5 | Moderate depth captures 3-way interactions without deep overfitting |
| `learning_rate` | 0.08 | Slower learning (vs default 0.3) for better generalization |
| `subsample` | 0.8 | 20% row dropout reduces variance (similar to dropout in NNs) |
| `colsample_bytree` | 0.8 | 20% feature dropout per tree, reduces correlation between trees |

### What XGBoost Learns That Linear Cannot

**Example: Festival × Seasonal interaction**

Linear regression can only model:
```
effect = w_festival × is_festival + w_seasonal × seasonal_factor
```

XGBoost can model:
```
if is_festival=1 AND seasonal_factor>1.3:
    effect = 2.1 × avg_quantity  ← stronger compound effect
else if is_festival=1:
    effect = 1.4 × avg_quantity
else:
    effect = 1.0 × avg_quantity
```

This non-linear threshold behaviour is why XGBoost generalises better on data with complex patterns.

### Test Metrics (Actual)

```
MAE:                   0.2885
RMSE:                  0.4867
R² Score:              0.8160
Directional Accuracy:  0.9084
```

### Note on Results

On this particular synthetic dataset, Ridge Linear Regression achieves a higher R² (0.864 vs 0.816). This is not surprising: the data was generated with predominantly linear relationships (quantity ~ household_size × seasonal × noise), giving linear models a natural advantage. In production with real purchase data containing richer non-linearities (weather effects, holiday panic buying, substitution effects), XGBoost typically outperforms.

---

## 5. Waste Prediction — Problem Formulation

### Task Definition

Given properties of a grocery item at the time of purchase:
> **Predict whether the item will be wasted (1) or fully consumed (0).**

### Input Features (24)

```
X = [
  # base (10)
  expiry_days, shelf_life, expiry_risk, consumption_rate, quantity,
  price, household_size_proxy, nutrition_score, is_perishable, category_encoded,
  # engineered (10)
  consumption_to_expiry_ratio, quantity_per_household, price_per_unit,
  perishability_score, waste_risk_interaction, category_risk_avg,
  rolling_waste_rate, normalized_quantity, seasonal_waste_factor,
  price_sensitivity_score,
  # Indian context (4)
  is_summer_month, is_monsoon_month, monsoon_perishable_flag, price_variation_index
]
```

### Target Variable

```
y = wasted  (binary: 0 = consumed, 1 = wasted)
```

### Class Balance

```
Class 0 (consumed): ~55%
Class 1 (wasted):   ~45%
```

Slight imbalance — both models use `class_weight="balanced"` which internally adjusts sample weights to equalise class importance.

### Training Data

- **Rows:** 120,000 records
- **Source:** `food_waste.csv` + `product_metadata.csv`
- **Train/Test:** 96,000 / 24,000 (stratified by class)

---

## 6. Legacy Waste Model: Logistic Regression

### Algorithm Description

Logistic Regression models the log-odds of the positive class as a linear function of features:

```
log(P(wasted=1) / P(wasted=0)) = w₀ + w₁×expiry_risk + w₂×consumption_rate + ...
P(wasted=1) = sigmoid(Xw) = 1 / (1 + exp(-Xw))
```

Training minimizes the **binary cross-entropy loss**:
```
L = -Σ [yᵢ log(p̂ᵢ) + (1-yᵢ) log(1-p̂ᵢ)]
```

### Hyperparameters

```python
LogisticRegression(
    max_iter=1000,         # enough iterations for convergence after scaling
    C=1.0,                 # inverse regularization strength (L2)
    random_state=42,
    class_weight="balanced"
)
```

| Parameter | Value | Justification |
|-----------|-------|---------------|
| `C` | 1.0 | Default L2 regularization |
| `max_iter` | 1000 | Ensures convergence on scaled data |
| `class_weight` | balanced | Equalises class importance for 55/45 split |

### Decision Boundary

The model draws a **hyperplane** in 10-dimensional feature space. Items on one side are classified as "wasted", on the other as "consumed". The probability is determined by the sigmoid of the signed distance from this hyperplane.

### Strengths

- **Fast training and inference** (matrix multiplication + sigmoid)
- **Probabilistic output** — returns calibrated probabilities, not just classes
- **Interpretable coefficients** — large positive w for `expiry_risk` confirms domain knowledge

### Weaknesses

- **Linear decision boundary only** — cannot capture non-linear waste patterns
- **Assumes feature independence** — interaction between expiry_risk AND consumption_rate jointly predicting waste is not captured

### Test Metrics (Actual)

```
Accuracy:   0.6375
Precision:  0.5304
Recall:     0.6489
F1 Score:   0.5837
ROC-AUC:    0.6529
```

---

## 7. Modern Waste Model: TabNet Classifier

### Algorithm Description

TabNet is an attention-based deep learning architecture specifically designed for tabular data. Unlike standard MLPs that process all features at every layer, TabNet uses **sequential attention** to select a sparse, relevant subset of features at each of `n_steps` decision steps.

At each step `t`, an attention transformer selects which features to focus on (via entmax activation), a feature transformer processes only those features, and the outputs of all steps are summed to form the final prediction:

```
Step t:
  attention_mask[t] = entmax(prior_scales[t] × H(a[t-1]))
  processed[t]      = feature_transformer(X × attention_mask[t])
  output            = Σ_t ReLU(processed[t]) × W_out
```

**Key properties:**
- Sparse feature selection at each step (entmax produces near-zero weights for irrelevant features)
- `feature_importances_` derived from aggregated attention weights across steps and samples
- Works end-to-end without manual feature selection
- Uses virtual batch normalisation for stable mini-batch training

### Hyperparameters

```python
TabNetClassifier(
    n_d=16,          # dimension of decision step output
    n_a=16,          # dimension of attention embedding
    n_steps=5,       # number of sequential attention steps
    gamma=1.5,       # coefficient for feature reusage across steps
    optimizer_fn=torch.optim.Adam,
    optimizer_params={"lr": 0.02},
    mask_type="entmax",
    verbose=0,
)
# Training call:
model.fit(
    X_train, y_train,
    eval_set=[(X_val, y_val)],
    max_epochs=50, patience=10,
    batch_size=256, virtual_batch_size=128,
)
```

| Parameter | Value | Justification |
|-----------|-------|---------------|
| `n_d` | 16 | Decision step output dimension — balances capacity and overfitting at 96k rows |
| `n_a` | 16 | Attention embedding dimension — matched to `n_d` for symmetric capacity |
| `n_steps` | 5 | Five sequential attention steps allow multi-level feature interaction discovery |
| `gamma` | 1.5 | Controls feature reuse penalisation; 1.5 encourages diversity across steps |
| `lr` | 0.02 | Higher than default Adam LR works well with virtual batch normalisation |
| `mask_type` | entmax | Sparse alternative to softmax — forces near-zero weights on irrelevant features |
| `max_epochs` | 50 | Sufficient for convergence; early stopping (patience=10) prevents overfitting |
| `batch_size` | 256 | Efficient mini-batch size for 96k rows |
| `virtual_batch_size` | 128 | Ghost batch normalisation sub-batch for stable BN statistics |

### What TabNet Learns That Logistic Regression Cannot

Logistic Regression can only model:
```
log-odds = w₁×expiry_risk + w₂×consumption_rate + w₃×category_encoded + ...
```

TabNet learns interaction rules and non-linear thresholds such as:

```
Step 1 attends to: expiry_risk, expiry_days, shelf_life
  → IF expiry_risk > 0.75 AND expiry_days < 3 THEN waste_signal = HIGH

Step 2 attends to: category_risk_avg, category_encoded, seasonal_waste_factor
  → IF category is Dairy AND seasonal_waste_factor > 1.2 THEN waste_signal += HIGH

Step 3 attends to: consumption_to_expiry_ratio, rolling_waste_rate
  → IF consumption_to_expiry_ratio < 0.4 AND rolling_waste_rate > 0.6
      THEN waste_signal += VERY HIGH
```

These category-specific, threshold-based, multi-feature interaction patterns across all 24 features simultaneously are impossible for Logistic Regression to learn.

### Strengths

- **Learns non-linear interactions** between all 24 features across multiple attention steps
- **Attention masks provide interpretability** — which features each step attends to can be inspected
- **Built-in feature selection via sparsity** — selects from all 24 features without manual pre-selection
- **Generalises well with 100k+ rows** — TabNet's capacity is fully leveraged at the 96k training scale

### Weaknesses

- **Slower training** than tree models — ~3–5 minutes for 96k rows vs seconds for Logistic Regression
- **Requires more hyperparameter tuning** — `n_d`, `n_a`, `n_steps`, `gamma`, and learning rate all interact
- **Needs PyTorch dependency** — heavier install than scikit-learn-only stack

### Test Metrics (Approximate — varies by run)

```
Accuracy:   ~0.74
Precision:  ~0.70
Recall:     ~0.72
F1 Score:   ~0.71
ROC-AUC:    ~0.78
```

Exact values vary per run due to TabNet's stochastic training (random weight initialisation, mini-batch sampling). Evaluated on the same 24,000-row stratified test set as Logistic Regression. TabNet outperforms across all 5 metrics because its 5-step sequential attention mechanism discovers non-linear interactions (e.g., `expiry_risk × (1 - consumption_rate)`) that the linear logistic model cannot represent.

---

## 8. Anomaly Detection: Isolation Forest

### Task Definition

Given a user's monthly spending profile:
> **Detect whether the current month's spend is anomalously high compared to the user's 3-month rolling baseline.**

This is an **unsupervised** problem — no labelled "overspending" ground-truth exists. The model learns the distribution of normal spending from historical data and flags outliers.

### Algorithm Description

Isolation Forest randomly partitions the feature space by selecting a feature and a random split value. Anomalies — points that are far from the bulk of the data — are isolated in fewer splits than normal points. The anomaly score is inversely proportional to the average path length.

```
anomaly_score = 2^(-average_path_length / c(n))
where c(n) is the expected path length for a dataset of size n.
```

Score < 0 → anomalous (overspending); Score > 0 → normal.

### Features (5 per user-month)

```python
FEATURE_COLS = [
    "monthly_spend",       # total ₹ spent this month
    "spend_vs_avg",        # ratio vs 3-month rolling mean (clipped to [0, 5])
    "n_unique_items",      # variety of items bought
    "avg_price_paid",      # average per-item spend
    "is_festival_month",   # 1 if current month is a festival month
]
```

### Hyperparameters

```python
IsolationForest(
    n_estimators=150,    # 150 trees for stable anomaly scores
    contamination=0.1,   # assume ~10% of months are anomalous
    max_samples="auto",  # sqrt(n_samples) auto-selected
    random_state=42,
)
```

### Inference Output

```python
{
    "is_overspending":    True,           # label == -1 from IsolationForest
    "anomaly_score":      -0.0823,        # raw score (negative = anomalous)
    "monthly_spend":      4850.0,         # ₹ spent this month
    "rolling_avg_3m":     3200.0,         # 3-month rolling mean
    "overspent_by":       1650.0,         # max(0, monthly_spend - rolling_avg)
    "n_unique_items":     18,
    "category_breakdown": {"Vegetables": 820, "Dairy": 430, ...},
    "message":            "You overspent ₹1650 vs your 3-month average.",
}
```

---

## 9. Recommendation Engine: FP-Growth

### Task Definition

Given items currently in the user's basket:
> **Suggest items frequently co-purchased with the basket contents.**

### Algorithm Description

FP-Growth (Frequent Pattern Growth) mines **association rules** from market basket transactions. A basket is defined as all items a user purchased on the same day. The algorithm:
1. Builds a compact FP-tree from frequent itemsets
2. Mines itemsets with support ≥ `min_support`
3. Generates association rules with confidence ≥ `min_confidence`
4. Ranks rules by **lift** — how much more likely a consequent item is given the antecedent, compared to random

### Hyperparameters

```python
GroceryRecommender(
    min_support=0.005,      # itemset must appear in ≥ 0.5% of baskets
    min_confidence=0.20,    # rule must hold in ≥ 20% of antecedent baskets
)
```

### Inference

```python
recommend(current_basket=["Milk", "Atta"], top_n=5)
# Returns items with highest lift that aren't already in the basket
# e.g., [{"item": "Sugar", "confidence": 0.72, "lift": 3.4, "support": 0.021}, ...]
```

**Graceful degradation:** If `mlxtend` is unavailable or there are too few baskets (< 50), falls back to a hardcoded Indian co-purchase heuristic map (e.g., Atta → [Toor Dal, Rice, Sugar, Mustard Oil]).

---

## 10. Sustainability Tracker (Rule-Based)

### Task Definition

> **Compute an environmental footprint score for a user's recent purchases and suggest lower-impact swaps.**

This is a **rule-based system**, not a trained ML model. It uses pre-defined eco-scores and CO₂ lifecycle estimates per item.

### Scoring System

```python
ECO_SCORES = {
    "Tomato": 9, "Potato": 9, "Onion": 9,   # loose produce → highest score
    "Milk": 5, "Atta": 6, "Rice": 6,         # packaged staples → moderate
    "Chicken": 4, "Butter": 4,               # animal products → lower score
    "Coffee": 3,                              # high processing → lowest
}

CO2_PER_UNIT = {  # grams CO₂ per kg / per unit (lifecycle estimates)
    "Chicken": 6200, "Coffee": 7000,  # highest carbon
    "Tomato": 150, "Potato": 120,     # lowest carbon
}
```

### Output Metrics

```python
{
    "total_items_purchased":   24,
    "plastic_packaging_pct":   41.7,
    "non_biodegradable_pct":   33.3,
    "avg_eco_score":           6.2,       # 0–10 scale
    "total_co2_kg_estimate":   8.4,
    "top_plastic_categories":  {"Dairy": 5, "Grains": 3},
    "high_impact_items":       {"Chicken": 3, "Butter": 2},
    "swap_suggestions": [
        {"item": "Chicken", "swap_to": "Toor Dal", "co2_saving_pct": 85},
        {"item": "Coffee",  "swap_to": "Tea",       "co2_saving_pct": 57},
    ],
}
```

---

## 11. Training Pipeline

All training happens in `app/services/evaluator.py` during application startup:

```python
def train_all_models():
    # 0. Load all 6 datasets once
    datasets = load_all()

    # 1. Build feature matrices
    X_demand, y_demand = build_demand_features(datasets)  # (N≈200000, 13)
    X_waste,  y_waste  = build_waste_features(datasets)   # (120000, 24)

    # 2. Train/test splits
    # demand: (160000, 13) train / (40000, 13) test
    X_d_train, X_d_test, y_d_train, y_d_test = train_test_split(
        X_demand, y_demand, test_size=0.20, random_state=42
    )
    # waste: (96000, 24) train / (24000, 24) test — stratified
    X_w_train, X_w_test, y_w_train, y_w_test = train_test_split(
        X_waste, y_waste, test_size=0.20, random_state=42, stratify=y_waste
    )

    # 3. Scale features
    X_d_train_sc, X_d_test_sc, d_scaler = scale_features(X_d_train, X_d_test)
    X_w_train_sc, X_w_test_sc, w_scaler = scale_features(X_w_train, X_w_test)

    # 4. Train demand pair
    linear = DemandLinearModel()
    linear_metrics = linear.train(X_d_train_sc, y_d_train.values)
    linear_metrics = linear.evaluate(X_d_test_sc, y_d_test.values)

    xgb = DemandXGBoostModel()
    xgb.train(X_d_train_sc, y_d_train.values)
    xgb_metrics = xgb.evaluate(X_d_test_sc, y_d_test.values)

    # 5. Train waste pair
    logistic = WasteLogisticModel()
    logistic.train(X_w_train_sc, y_w_train.values)
    logistic_metrics = logistic.evaluate(X_w_test_sc, y_w_test.values)

    tabnet = WasteTabNetModel()
    tabnet.train(X_w_train_sc, y_w_train.values)
    tabnet_metrics = tabnet.evaluate(X_w_test_sc, y_w_test.values)

    # 6. Train Isolation Forest on raw purchase history
    anomaly_detector = OverspendingDetector()
    anomaly_detector.train(datasets["purchases"])

    # 7. Train FP-Growth on purchase baskets
    recommender = GroceryRecommender(min_support=0.005, min_confidence=0.20)
    recommender.train(datasets["purchases"])

    # 8. Build sustainability footprint metadata (rule-based, no training)
    sustainability = SustainabilityTracker()
    sustainability.build_item_footprint()

    # 9. Pre-compute per-item inference stats
    item_stats = compute_item_stats(
        datasets["purchases"], datasets["metadata"], datasets["seasonal"]
    )

    # 10. Populate global model_store and mark ready
    _populate_store(linear, xgb, d_scaler, ..., logistic, tabnet, w_scaler, ...,
                    anomaly_detector, recommender, sustainability, item_stats)
    mark_initialized()
```

### Timing (approximate)

| Step | Time |
|------|------|
| Dataset generation (if not cached) | ~30–60 seconds (200k+ rows) |
| Feature engineering (13 + 24 features) | ~10–20 seconds |
| Ridge Regression training | < 500ms |
| XGBoost training (200 trees) | ~30–60 seconds |
| Logistic Regression training | ~2–5 seconds |
| TabNet training (50 epochs, 96k rows) | ~3–8 minutes |
| Isolation Forest training | < 2 seconds |
| FP-Growth mining | ~5–15 seconds |
| Sustainability footprint build | < 100ms |
| **Total startup (cold)** | **~10–15 minutes** |
| **Total startup (cached)** | **< 5 seconds** |

> Models are cached to disk (`models_cache/`) keyed by an MD5 hash of dataset modification times. If datasets haven't changed, all 7 models are loaded from pickle — skipping retraining entirely.

---

## 12. Model Storage and Serving

### Global Model Registry

All trained models are stored in a module-level dict (`app/utils/store.py`):

```python
model_store = {
    "demand": {
        "linear":        <DemandLinearModel instance>,
        "xgboost":       <DemandXGBoostModel instance>,
        "scaler":        <StandardScaler instance>,
        "feature_names": [...13 feature names...],
        "metrics": {
            "linear":   {mae, rmse, r2, directional_accuracy},
            "xgboost":  {mae, rmse, r2, directional_accuracy},
        },
    },
    "waste": {
        "logistic":      <WasteLogisticModel instance>,
        "tabnet":        <WasteTabNetModel instance>,
        "scaler":        <StandardScaler instance>,
        "feature_names": [
            # base (10)
            "expiry_days", "shelf_life", "expiry_risk", "consumption_rate", "quantity",
            "price", "household_size_proxy", "nutrition_score", "is_perishable", "category_encoded",
            # engineered (10)
            "consumption_to_expiry_ratio", "quantity_per_household", "price_per_unit",
            "perishability_score", "waste_risk_interaction", "category_risk_avg",
            "rolling_waste_rate", "normalized_quantity", "seasonal_waste_factor",
            "price_sensitivity_score",
            # Indian context (4)
            "is_summer_month", "is_monsoon_month", "monsoon_perishable_flag", "price_variation_index",
        ],
        "feature_stats": {
            "category_risk":   {category_name: float, ...},
            "item_waste_rate": {item_name: float, ...},
            "quantity_mean":   float,
            "quantity_std":    float,
        },
        "metrics": {
            "logistic": {accuracy, precision, recall, f1, roc_auc, confusion_matrix},
            "tabnet":   {accuracy, precision, recall, f1, roc_auc, confusion_matrix},
        },
    },
    "anomaly": {
        "model":      <OverspendingDetector instance>,
        "is_trained": True,
    },
    "recommendation": {
        "model":      <GroceryRecommender instance>,
        "is_trained": True,
    },
    "sustainability": {
        "tracker":        <SustainabilityTracker instance>,
        "item_footprint": {item_name: {eco_score, co2_per_unit_g, ...}, ...},
        "is_ready":       True,
    },
    "item_stats":    {item_name: {13 inference features}, ...},
    "initialized":   True,
}
```

### Inference Flow

```
HTTP Request → Route Handler
                    │
                    ├── Retrieve item_stats from model_store
                    │
                    ├── Construct feature row [13 values (demand) / 24 values (waste)]
                    │
                    ├── scaler.transform(row)
                    │
                    ├── model.predict(scaled_row) OR
                    │   model.predict_proba(scaled_row)
                    │
                    └── Format JSON response
```

**No model loading from disk per request.** Models live in process memory after startup.

---

## 13. Evaluation Metrics Explained

### Regression Metrics (Demand Models)

**MAE (Mean Absolute Error)**
```
MAE = (1/n) × Σ|yᵢ - ŷᵢ|
```
Interpretable as "average error in kg/units". MAE = 0.26 means predictions are off by ~0.26 units on average. Lower is better.

**RMSE (Root Mean Squared Error)**
```
RMSE = √[(1/n) × Σ(yᵢ - ŷᵢ)²]
```
Penalises large errors more than MAE. RMSE = 0.42 means typical error is ~0.42 units. Lower is better.

**R² Score (Coefficient of Determination)**
```
R² = 1 - SS_residual / SS_total = 1 - Σ(yᵢ-ŷᵢ)² / Σ(yᵢ-ȳ)²
```
Proportion of variance explained. R² = 0.864 means the model explains 86.4% of quantity variance. Higher is better (max = 1.0).

**Directional Accuracy**
```
dir_acc = mean(sign(diff(y_true)) == sign(diff(y_pred)))
```
Proportion of times the model correctly predicts whether quantity goes up or down from one purchase to the next. Directional accuracy of 0.916 = correct 91.6% of the time.

### Classification Metrics (Waste Models)

**Accuracy**
```
Accuracy = (TP + TN) / (TP + TN + FP + FN)
```
Overall correctness. Less informative with class imbalance.

**Precision**
```
Precision = TP / (TP + FP)
```
"Of items we predicted as wasted, what fraction actually was?" High precision = few false alarms.

**Recall (Sensitivity)**
```
Recall = TP / (TP + FN)
```
"Of all items that were actually wasted, what fraction did we catch?" High recall = few missed waste events.

**F1 Score**
```
F1 = 2 × (Precision × Recall) / (Precision + Recall)
```
Harmonic mean of Precision and Recall. The primary metric for imbalanced classification. Higher is better.

**ROC-AUC**
```
AUC = Area under the ROC curve
```
Probability that the model ranks a random positive above a random negative. AUC = 0.65 means 65% of the time the model gives higher waste probability to a wasted item than a non-wasted one. AUC = 0.5 = random; AUC = 1.0 = perfect.

---

## 14. Why These Seven Models?

### The Legacy–Modern Pairing Philosophy

The supervised model pairs were chosen to demonstrate a clear **"interpretable, simple baseline" vs "powerful, flexible modern approach"** contrast:

| Dimension | Legacy Choice | Modern Choice |
|-----------|--------------|---------------|
| Interpretability | High (read coefficients) | Medium (feature importance) |
| Training speed | Very fast (< 100ms) | Moderate (seconds to minutes) |
| Handles non-linearity | No | Yes |
| Handles feature interactions | No | Yes |
| Requires tuning | Minimal | Moderate |
| Production usage | Common baseline | Industry standard |
| Explanation to stakeholders | Easy | Moderate |

### Waste Task: Legacy vs Modern Comparison

| Dimension | Legacy (Logistic) | Modern (TabNet) |
|---|---|---|
| Interpretability | High — log-odds coefficients | Medium — attention masks |
| Training speed | < 5 seconds | ~3–8 minutes |
| Handles non-linearity | No | Yes (multi-step attention) |
| Handles interactions | No | Yes (feature selection per step) |
| Requires tuning | Minimal | Moderate |
| Dataset size needed | Small OK | Benefits from 10k+ rows |

### Why Not Neural Networks?

With 120,000 waste records and 24 engineered features, a deep learning approach is now fully justified. **TabNet is specifically designed for tabular data** and bridges the gap between interpretable models and deep learning. Unlike standard MLPs which treat all features equally at every layer, TabNet's sparse attention mechanism provides feature importance analogous to tree-based models.

For the demand task (13 features, predominantly linear data generation), Ridge Regression and XGBoost remain the better choices — the linear structure of the demand data does not benefit from the additional complexity of deep learning.

### Why Ridge Over LASSO?

With 13 features that are all domain-meaningful, we don't want any feature weights set to zero. Ridge (L2) shrinks all weights proportionally while keeping all features active. LASSO (L1) would eliminate features (potentially removing `is_festival_month` or `is_monsoon_month` which have small but real effects).

### Why TabNet Over Gradient Boosting (for Waste)?

Both are powerful non-linear approaches, but for the waste task with 120k rows and 24 features:
- **TabNet provides attention-based feature importance** across all 24 features — each decision step's attention mask shows which features drove that step's output
- **With 120k rows, TabNet's deep learning capacity is fully leveraged**
- **The 24 features benefit from non-linear interactions** (e.g., `monsoon_perishable_flag × expiry_risk`, `rolling_waste_rate × consumption_to_expiry_ratio`) that TabNet discovers automatically via sequential attention
- **Provides a clear deep-learning vs. linear contrast** across the system's three supervised paradigms: linear, gradient boosting, and deep learning

### Why Isolation Forest for Overspending?

Overspending is an **unsupervised** problem — there are no labelled "overspending" months in the training data. Isolation Forest is ideal because: (1) it requires no labels, (2) it scales well to per-user 5-feature monthly profiles, and (3) its `contamination` parameter provides a tunable anomaly rate that matches domain intuition (~10% of months are anomalous).

### Why FP-Growth for Recommendations?

Association rule mining directly models the co-purchase structure of grocery baskets. FP-Growth is more memory-efficient than Apriori for large itemsets and produces **lift-ranked rules** that are directly interpretable ("if Atta → then Sugar with lift=3.4"). Unlike collaborative filtering, it requires no user embeddings and degrades gracefully with a hardcoded heuristic fallback when basket data is sparse.

### Why a Rule-Based Sustainability Tracker?

Sustainability scoring requires **domain knowledge** (CO₂ lifecycle estimates, plastic packaging classifications) that cannot be learned from grocery transaction data alone. A rule-based system using curated eco-scores and CO₂ estimates is more accurate and transparent than any model trained on the available data. It also requires zero training time and produces interpretable, auditable outputs.
