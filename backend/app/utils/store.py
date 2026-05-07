"""Global model registry shared across all routes."""

model_store = {
    "demand": {
        "linear": None,
        "xgboost": None,
        "scaler": None,
        "feature_names": [],
        "metrics": {
            "linear": {},
            "xgboost": {},
        },
    },
    "waste": {
        "logistic": None,
        "tabnet": None,
        "scaler": None,
        "feature_names": [],
        "feature_stats": {},
        "metrics": {
            "logistic": {},
            "tabnet": {},
        },
    },
    # Isolation Forest — detects overspending anomalies per user per month
    "anomaly": {
        "model": None,
        "scaler": None,
        "is_trained": False,
    },
    # FP-Growth — market basket association rules for recommendations
    "recommendation": {
        "model": None,
        "is_trained": False,
    },
    # Sustainability metadata — per-item plastic/non-biodegradable flags
    "sustainability": {
        "item_footprint": {},   # item → {plastic_packaging, non_biodegradable, eco_score}
        "is_ready": False,
    },
    "item_stats": {},
    "initialized": False,
}
