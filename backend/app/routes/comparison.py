from fastapi import APIRouter, HTTPException
from app.utils.store import model_store

router = APIRouter()


@router.get("/compare-models")
def compare_models():
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    demand_metrics = model_store["demand"]["metrics"]
    waste_metrics  = model_store["waste"]["metrics"]

    d_linear = demand_metrics["linear"]
    d_xgb    = demand_metrics["xgboost"]
    w_log    = waste_metrics["logistic"]
    w_tab    = waste_metrics["tabnet"]

    demand_winner = "XGBoost" if d_xgb["r2"] > d_linear["r2"] else "Ridge Regression"
    waste_winner  = "TabNet"  if w_tab["f1"] > w_log["f1"]    else "Logistic Regression"

    # Anomaly model info
    anomaly = model_store["anomaly"]
    rec     = model_store["recommendation"]

    return {
        "demand_prediction": {
            "task":               "Regression — predict next purchase quantity",
            "metric_description": "Lower MAE/RMSE is better; Higher R² is better",
            "features_count":     len(model_store["demand"]["feature_names"]),
            "feature_names":      model_store["demand"]["feature_names"],
            "legacy": {
                "name": "Ridge Linear Regression",
                "type": "Legacy",
                **d_linear,
            },
            "modern": {
                "name": "XGBoost Regressor",
                "type": "Modern",
                **d_xgb,
            },
            "winner": demand_winner,
            "improvement": {
                "mae_reduction": round(d_linear["mae"] - d_xgb["mae"], 4),
                "r2_gain":       round(d_xgb["r2"] - d_linear["r2"], 4),
            },
        },
        "waste_prediction": {
            "task":               "Classification — predict if item will be wasted",
            "metric_description": "Higher accuracy/F1/AUC is better",
            "features_count":     len(model_store["waste"]["feature_names"]),
            "feature_names":      model_store["waste"]["feature_names"],
            "legacy": {
                "name": "Logistic Regression",
                "type": "Legacy",
                **w_log,
            },
            "modern": {
                "name": "TabNet Classifier",
                "type": "Modern",
                **w_tab,
            },
            "winner": waste_winner,
            "improvement": {
                "f1_gain":  round(w_tab["f1"] - w_log["f1"], 4),
                "auc_gain": round(w_tab["roc_auc"] - w_log["roc_auc"], 4),
            },
        },
        "anomaly_detection": {
            "task":    "Unsupervised — detect overspending months per user",
            "model":   "Isolation Forest",
            "trained": anomaly["is_trained"],
            "params":  {"n_estimators": 150, "contamination": 0.1},
        },
        "recommendation": {
            "task":    "Association rules — suggest co-purchased items",
            "model":   "FP-Growth",
            "trained": rec["is_trained"],
            "top_rules": (
                rec["model"].top_rules(n=5)
                if rec.get("model") and rec["is_trained"]
                else []
            ),
        },
        "feature_importance": {
            "demand_xgboost": (
                model_store["demand"]["xgboost"].feature_importance(
                    model_store["demand"]["feature_names"]
                ) if model_store["demand"]["xgboost"] else {}
            ),
            "waste_tabnet": (
                model_store["waste"]["tabnet"].feature_importance(
                    model_store["waste"]["feature_names"]
                ) if model_store["waste"]["tabnet"] else {}
            ),
        },
    }
