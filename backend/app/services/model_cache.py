"""Pickle-based model cache.

Saves all trained model objects to backend/models_cache/ after training.
On the next cold start, checks whether the dataset files have changed
(via MD5 of their mtimes). If unchanged, loads from cache — skipping the
~15-second TabNet retraining entirely.
"""
import hashlib
import logging
import os
import pickle

from app.utils.helpers import DATA_DIR

logger = logging.getLogger(__name__)

_BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE_DIR = os.path.join(_BASE, "models_cache")

_DATASET_FILES = [
    "grocery_purchases.csv",
    "food_waste.csv",
    "retail_transactions.csv",
    "product_metadata.csv",
    "household_consumption.csv",
    "seasonal_data.csv",
]

# Keys that must all be present for the cache to be considered valid
_REQUIRED_KEYS = [
    "linear", "xgboost", "d_scaler", "d_feature_names", "d_metrics",
    "logistic", "tabnet", "w_scaler", "w_feature_names", "w_metrics", "w_feature_stats",
    "anomaly", "recommender", "sustainability", "item_stats",
]


def dataset_hash() -> str:
    """MD5 of every dataset file's mtime — changes when any CSV is regenerated."""
    h = hashlib.md5()
    for fname in _DATASET_FILES:
        path = os.path.join(DATA_DIR, fname)
        if os.path.exists(path):
            h.update(f"{fname}:{os.path.getmtime(path):.3f}".encode())
    return h.hexdigest()


def _key_path(key: str) -> str:
    return os.path.join(CACHE_DIR, f"{key}.pkl")


def save(payload: dict, data_hash: str) -> None:
    """Pickle each model object. Only writes the hash file if ALL saves succeed."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    failed = []
    for key, obj in payload.items():
        try:
            with open(_key_path(key), "wb") as fh:
                pickle.dump(obj, fh, protocol=pickle.HIGHEST_PROTOCOL)
        except Exception as exc:
            failed.append(key)
            logger.warning("[model_cache] Could not save '%s': %s", key, exc)

    if not failed:
        with open(os.path.join(CACHE_DIR, "hash.txt"), "w") as fh:
            fh.write(data_hash)
        logger.info("[model_cache] Saved %d model objects to %s", len(payload), CACHE_DIR)
    else:
        logger.warning(
            "[model_cache] %d key(s) failed to save (%s); skipping hash write — "
            "will retrain on next restart",
            len(failed), ", ".join(failed),
        )


def load(data_hash: str) -> dict | None:
    """Return cached models if the hash matches and every required key is loadable."""
    hash_path = os.path.join(CACHE_DIR, "hash.txt")
    if not os.path.exists(hash_path):
        logger.info("[model_cache] No cache found — will train from scratch")
        return None

    with open(hash_path) as fh:
        cached_hash = fh.read().strip()

    if cached_hash != data_hash:
        logger.info("[model_cache] Dataset changed (hash mismatch) — invalidating cache")
        return None

    payload = {}
    for key in _REQUIRED_KEYS:
        path = _key_path(key)
        if not os.path.exists(path):
            logger.info("[model_cache] Missing cache file for '%s' — full retrain", key)
            return None
        try:
            with open(path, "rb") as fh:
                payload[key] = pickle.load(fh)
        except Exception as exc:
            logger.warning("[model_cache] Failed to load '%s': %s — full retrain", key, exc)
            return None

    logger.info("[model_cache] Loaded %d model objects from cache", len(payload))
    return payload
