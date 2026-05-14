"""Compute per-user item statistics from real purchase history.

Falls back to global synthetic stats for new users with no purchases.
Shared by the prediction and insights routes.
"""
import logging

import pandas as pd

from app.services.feature_engineering import compute_item_stats

logger = logging.getLogger(__name__)


def get_user_item_stats(user_id: int, db, fallback_stats: dict) -> dict:
    """Return item stats derived from the user's real DB purchases.

    Strategy:
      - Query the user's PurchaseRecord rows.
      - If empty (new user), return fallback_stats unchanged.
      - Otherwise compute per-user averages and merge on top of fallback_stats
        so items the user has never bought still have sensible defaults.
    """
    from app.database.db import PurchaseRecord, UserRecord

    records = (
        db.query(PurchaseRecord)
        .filter(PurchaseRecord.user_id == user_id)
        .all()
    )
    if not records:
        return fallback_stats

    user = db.query(UserRecord).filter(UserRecord.id == user_id).first()
    household_size = float(user.household_size) if user else 3.0

    try:
        df = pd.DataFrame([
            {
                "item": r.item,
                "category": r.category,
                "quantity": r.quantity,
                "price": r.price,
                "purchase_date": pd.to_datetime(r.purchase_date),
            }
            for r in records
        ])

        from app.datasets.loader import load_product_metadata, load_seasonal_data
        metadata = load_product_metadata()
        seasonal = load_seasonal_data()

        user_stats = compute_item_stats(df, metadata, seasonal, household_size=household_size)

        # Merge: user's real data overrides catalog defaults
        merged = dict(fallback_stats)
        merged.update(user_stats)
        return merged

    except Exception as exc:
        logger.warning("[user_stats] Failed to build stats for user %d: %s", user_id, exc)
        return fallback_stats
