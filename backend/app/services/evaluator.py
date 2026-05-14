"""
Model training orchestrator.
Trains all 7 models and populates model_store:
  Demand:         Ridge Regression + XGBoost
  Waste:          Logistic Regression + TabNet
  Overspending:   Isolation Forest
  Recommendation: FP-Growth (association rules)
  Sustainability: Rule-based tracker (no training needed)

On cold start, checks models_cache/ before training.  If datasets haven't
changed (hash match) all models are loaded from pickle — skipping retraining.
"""
import logging

import numpy as np
from sklearn.model_selection import train_test_split

from app.services.feature_engineering import build_demand_features, build_waste_features, compute_item_stats
from app.services.data_processing import scale_features
from app.services.model_cache import dataset_hash, load as load_cache, save as save_cache
from app.models.demand.linear_model import DemandLinearModel
from app.models.demand.xgboost_model import DemandXGBoostModel
from app.models.waste.logistic_model import WasteLogisticModel
from app.models.waste.tabnet_model import WasteTabNetModel
from app.models.anomaly.isolation_forest_model import OverspendingDetector
from app.models.recommendation.fpgrowth_model import GroceryRecommender
from app.models.sustainability.tracker import SustainabilityTracker
from app.datasets.loader import load_all
from app.utils.store import model_store, mark_initialized

logger = logging.getLogger(__name__)


def _populate_store(
    linear, xgb, d_scaler, d_feature_names, d_metrics,
    logistic, tabnet, w_scaler, w_feature_names, w_metrics, w_feature_stats,
    anomaly_detector, recommender, sustainability,
    item_stats,
) -> None:
    model_store["demand"]["linear"]            = linear
    model_store["demand"]["xgboost"]           = xgb
    model_store["demand"]["scaler"]            = d_scaler
    model_store["demand"]["feature_names"]     = d_feature_names
    model_store["demand"]["metrics"]["linear"]  = d_metrics["linear"]
    model_store["demand"]["metrics"]["xgboost"] = d_metrics["xgboost"]

    model_store["waste"]["logistic"]           = logistic
    model_store["waste"]["tabnet"]             = tabnet
    model_store["waste"]["scaler"]             = w_scaler
    model_store["waste"]["feature_names"]      = w_feature_names
    model_store["waste"]["metrics"]["logistic"] = w_metrics["logistic"]
    model_store["waste"]["metrics"]["tabnet"]   = w_metrics["tabnet"]
    model_store["waste"]["feature_stats"]      = w_feature_stats

    model_store["anomaly"]["model"]            = anomaly_detector
    model_store["anomaly"]["is_trained"]       = anomaly_detector.is_trained

    model_store["recommendation"]["model"]     = recommender
    model_store["recommendation"]["is_trained"] = recommender.is_trained

    model_store["sustainability"]["item_footprint"] = sustainability.item_footprint
    model_store["sustainability"]["tracker"]        = sustainability
    model_store["sustainability"]["is_ready"]       = sustainability.is_ready

    model_store["item_stats"] = item_stats
    mark_initialized()


def train_all_models() -> None:
    data_hash = dataset_hash()
    cached = load_cache(data_hash)

    if cached:
        logger.info("[evaluator] Restoring models from cache (skipping training)")
        _populate_store(
            linear=cached["linear"],
            xgb=cached["xgboost"],
            d_scaler=cached["d_scaler"],
            d_feature_names=cached["d_feature_names"],
            d_metrics=cached["d_metrics"],
            logistic=cached["logistic"],
            tabnet=cached["tabnet"],
            w_scaler=cached["w_scaler"],
            w_feature_names=cached["w_feature_names"],
            w_metrics=cached["w_metrics"],
            w_feature_stats=cached["w_feature_stats"],
            anomaly_detector=cached["anomaly"],
            recommender=cached["recommender"],
            sustainability=cached["sustainability"],
            item_stats=cached["item_stats"],
        )
        logger.info("[evaluator] All 7 models restored from cache.")
        return

    # --- Load datasets once ---
    logger.info("[evaluator] Loading datasets...")
    datasets = load_all()

    # --- Demand features (13) ---
    logger.info("[evaluator] Building demand features (13 features)...")
    X_demand, y_demand = build_demand_features(datasets)

    # --- Waste features (24) ---
    logger.info("[evaluator] Building waste features (24 features)...")
    X_waste, y_waste = build_waste_features(datasets)

    demand_feature_names = list(X_demand.columns)
    waste_feature_names  = list(X_waste.columns)

    # --- Demand models (80/20 split) ---
    X_d_train, X_d_test, y_d_train, y_d_test = train_test_split(
        X_demand, y_demand, test_size=0.2, random_state=42
    )
    X_d_train_sc, X_d_test_sc, d_scaler = scale_features(X_d_train, X_d_test)

    logger.info("[evaluator] Training Ridge Regression (demand)...")
    linear = DemandLinearModel()
    linear.train(X_d_train_sc, y_d_train.values)
    linear_metrics = linear.evaluate(X_d_test_sc, y_d_test.values)

    logger.info("[evaluator] Training XGBoost Regressor (demand)...")
    xgb = DemandXGBoostModel()
    xgb.train(X_d_train_sc, y_d_train.values)
    xgb_metrics = xgb.evaluate(X_d_test_sc, y_d_test.values)

    # --- Waste models (80/20 stratified split) ---
    X_w_train, X_w_test, y_w_train, y_w_test = train_test_split(
        X_waste, y_waste, test_size=0.2, random_state=42, stratify=y_waste
    )
    X_w_train_sc, X_w_test_sc, w_scaler = scale_features(X_w_train, X_w_test)

    logger.info("[evaluator] Training Logistic Regression (waste)...")
    logistic = WasteLogisticModel()
    logistic.train(X_w_train_sc, y_w_train.values)
    logistic_metrics = logistic.evaluate(X_w_test_sc, y_w_test.values)

    logger.info("[evaluator] Training TabNet (waste)...")
    tabnet = WasteTabNetModel()
    tabnet.train(X_w_train_sc, y_w_train.values)
    tabnet_metrics = tabnet.evaluate(X_w_test_sc, y_w_test.values)

    # --- Isolation Forest (overspending) ---
    logger.info("[evaluator] Training Isolation Forest (overspending)...")
    anomaly_detector = OverspendingDetector()
    anomaly_result = anomaly_detector.train(datasets["purchases"])
    logger.info("  Anomaly: %s", anomaly_result)

    # --- FP-Growth (recommendations) ---
    logger.info("[evaluator] Training FP-Growth (recommendations)...")
    recommender = GroceryRecommender(min_support=0.005, min_confidence=0.20)
    rec_result = recommender.train(datasets["purchases"])
    logger.info("  FP-Growth: %s", rec_result)

    # --- Sustainability tracker ---
    logger.info("[evaluator] Building sustainability footprint metadata...")
    sustainability = SustainabilityTracker()
    sustainability.build_item_footprint()

    # --- Item stats for inference ---
    item_stats = compute_item_stats(
        datasets["purchases"],
        datasets["metadata"],
        datasets["seasonal"],
    )

    # --- Feature stats for waste inference ---
    waste_raw = datasets["waste"]
    w_feature_stats = {
        "category_risk":   waste_raw.groupby("category")["wasted"].mean().to_dict(),
        "item_waste_rate": waste_raw.groupby("item")["wasted"].mean().to_dict(),
        "quantity_mean":   float(waste_raw["quantity"].mean()),
        "quantity_std":    float(waste_raw["quantity"].std()) or 1.0,
    }

    d_metrics = {"linear": linear_metrics, "xgboost": xgb_metrics}
    w_metrics = {"logistic": logistic_metrics, "tabnet": tabnet_metrics}

    _populate_store(
        linear=linear, xgb=xgb, d_scaler=d_scaler,
        d_feature_names=demand_feature_names, d_metrics=d_metrics,
        logistic=logistic, tabnet=tabnet, w_scaler=w_scaler,
        w_feature_names=waste_feature_names, w_metrics=w_metrics,
        w_feature_stats=w_feature_stats,
        anomaly_detector=anomaly_detector, recommender=recommender,
        sustainability=sustainability, item_stats=item_stats,
    )

    logger.info("[evaluator] All 7 models ready.")
    logger.info(
        "  Demand  — Linear R²: %.3f | XGBoost R²: %.3f",
        linear_metrics["r2"], xgb_metrics["r2"],
    )
    logger.info(
        "  Waste   — Logistic F1: %.3f | TabNet F1: %.3f",
        logistic_metrics["f1"], tabnet_metrics["f1"],
    )

    # --- Persist to cache ---
    save_cache(
        {
            "linear": linear, "xgboost": xgb, "d_scaler": d_scaler,
            "d_feature_names": demand_feature_names, "d_metrics": d_metrics,
            "logistic": logistic, "tabnet": tabnet, "w_scaler": w_scaler,
            "w_feature_names": waste_feature_names, "w_metrics": w_metrics,
            "w_feature_stats": w_feature_stats,
            "anomaly": anomaly_detector, "recommender": recommender,
            "sustainability": sustainability, "item_stats": item_stats,
        },
        data_hash,
    )
