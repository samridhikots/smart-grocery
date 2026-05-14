"""Global model registry shared across all routes."""
import threading

# Written once by the background training thread; read by request handlers.
# _init_lock ensures all model_store keys are visible to other threads
# before `initialized` is set to True.
_init_lock = threading.Lock()

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


def mark_initialized() -> None:
    """Acquire the lock, then flip the flag — guarantees all prior writes are visible."""
    with _init_lock:
        model_store["initialized"] = True
