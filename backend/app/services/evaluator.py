"""
Model training orchestrator.
Trains all 7 models and populates model_store:
  Demand:         Ridge Regression + XGBoost
  Waste:          Logistic Regression + TabNet
  Overspending:   Isolation Forest
  Recommendation: FP-Growth (association rules)
  Sustainability: Rule-based tracker (no training needed)
"""
import numpy as np
from sklearn.model_selection import train_test_split

from app.services.feature_engineering import build_demand_features, build_waste_features, compute_item_stats
from app.services.data_processing import scale_features
from app.models.demand.linear_model import DemandLinearModel
from app.models.demand.xgboost_model import DemandXGBoostModel
from app.models.waste.logistic_model import WasteLogisticModel
from app.models.waste.tabnet_model import WasteTabNetModel
from app.models.anomaly.isolation_forest_model import OverspendingDetector
from app.models.recommendation.fpgrowth_model import GroceryRecommender
from app.models.sustainability.tracker import SustainabilityTracker
from app.datasets.loader import load_all
from app.utils.store import model_store


def train_all_models() -> None:
    print("[evaluator] Building demand features (13 features)...")
    X_demand, y_demand = build_demand_features()

    print("[evaluator] Building waste features (24 features)...")
    X_waste, y_waste = build_waste_features()

    demand_feature_names = list(X_demand.columns)
    waste_feature_names  = list(X_waste.columns)

    # --- Demand models (80/20 split) ---
    X_d_train, X_d_test, y_d_train, y_d_test = train_test_split(
        X_demand, y_demand, test_size=0.2, random_state=42
    )
    X_d_train_sc, X_d_test_sc, d_scaler = scale_features(X_d_train, X_d_test)

    print("[evaluator] Training Ridge Regression (demand)...")
    linear = DemandLinearModel()
    linear.train(X_d_train_sc, y_d_train.values)
    linear_metrics = linear.evaluate(X_d_test_sc, y_d_test.values)

    print("[evaluator] Training XGBoost Regressor (demand)...")
    xgb = DemandXGBoostModel()
    xgb.train(X_d_train_sc, y_d_train.values)
    xgb_metrics = xgb.evaluate(X_d_test_sc, y_d_test.values)

    # --- Waste models (80/20 stratified split) ---
    X_w_train, X_w_test, y_w_train, y_w_test = train_test_split(
        X_waste, y_waste, test_size=0.2, random_state=42, stratify=y_waste
    )
    X_w_train_sc, X_w_test_sc, w_scaler = scale_features(X_w_train, X_w_test)

    print("[evaluator] Training Logistic Regression (waste)...")
    logistic = WasteLogisticModel()
    logistic.train(X_w_train_sc, y_w_train.values)
    logistic_metrics = logistic.evaluate(X_w_test_sc, y_w_test.values)

    print("[evaluator] Training TabNet (waste)...")
    tabnet = WasteTabNetModel()
    tabnet.train(X_w_train_sc, y_w_train.values)
    tabnet_metrics = tabnet.evaluate(X_w_test_sc, y_w_test.values)

    # --- Isolation Forest (overspending) ---
    print("[evaluator] Training Isolation Forest (overspending)...")
    datasets = load_all()
    anomaly_detector = OverspendingDetector()
    anomaly_result = anomaly_detector.train(datasets["purchases"])
    print(f"  Anomaly: {anomaly_result}")

    # --- FP-Growth (recommendations) ---
    print("[evaluator] Training FP-Growth (recommendations)...")
    recommender = GroceryRecommender(min_support=0.005, min_confidence=0.20)
    rec_result = recommender.train(datasets["purchases"])
    print(f"  FP-Growth: {rec_result}")

    # --- Sustainability tracker (no training — just pre-computation) ---
    print("[evaluator] Building sustainability footprint metadata...")
    sustainability = SustainabilityTracker()
    sustainability.build_item_footprint()

    # --- Populate model_store ---
    model_store["demand"]["linear"]           = linear
    model_store["demand"]["xgboost"]          = xgb
    model_store["demand"]["scaler"]           = d_scaler
    model_store["demand"]["feature_names"]    = demand_feature_names
    model_store["demand"]["metrics"]["linear"]   = linear_metrics
    model_store["demand"]["metrics"]["xgboost"]  = xgb_metrics

    model_store["waste"]["logistic"]          = logistic
    model_store["waste"]["tabnet"]            = tabnet
    model_store["waste"]["scaler"]            = w_scaler
    model_store["waste"]["feature_names"]     = waste_feature_names
    model_store["waste"]["metrics"]["logistic"] = logistic_metrics
    model_store["waste"]["metrics"]["tabnet"]   = tabnet_metrics

    waste_raw = datasets["waste"]
    model_store["waste"]["feature_stats"] = {
        "category_risk":  waste_raw.groupby("category")["wasted"].mean().to_dict(),
        "item_waste_rate": waste_raw.groupby("item")["wasted"].mean().to_dict(),
        "quantity_mean":  float(waste_raw["quantity"].mean()),
        "quantity_std":   float(waste_raw["quantity"].std()) or 1.0,
    }

    model_store["anomaly"]["model"]      = anomaly_detector
    model_store["anomaly"]["is_trained"] = anomaly_detector.is_trained

    model_store["recommendation"]["model"]      = recommender
    model_store["recommendation"]["is_trained"] = recommender.is_trained

    model_store["sustainability"]["item_footprint"] = sustainability.item_footprint
    model_store["sustainability"]["tracker"]        = sustainability
    model_store["sustainability"]["is_ready"]       = sustainability.is_ready

    item_stats = compute_item_stats(
        datasets["purchases"],
        datasets["metadata"],
        datasets["seasonal"],
    )
    model_store["item_stats"] = item_stats
    model_store["initialized"] = True

    print("[evaluator] All 7 models ready.")
    print(f"  Demand  — Linear R²: {linear_metrics['r2']:.3f} | XGBoost R²: {xgb_metrics['r2']:.3f}")
    print(f"  Waste   — Logistic F1: {logistic_metrics['f1']:.3f} | TabNet F1: {tabnet_metrics['f1']:.3f}")
    print(f"  Anomaly detector: {anomaly_result.get('status')} | "
          f"Recommender: {rec_result.get('status')}")
