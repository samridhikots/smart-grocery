"""Green Coins reward system — balance, history, and award endpoint."""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import GreenCoinRecord, get_db
from app.utils.auth import get_current_user_id

router = APIRouter()

# Coins earned per purchase by category
COIN_RATES = {
    "Vegetables": 25,
    "Fruits":     25,
    "Dairy":      15,
    "Grains":     15,
    "Protein":    10,
    "Beverages":  10,
}

# (min_balance, level_name, emoji)
_LEVELS = [
    (0,    "Seedling", "🌱"),
    (100,  "Sprout",   "🌿"),
    (300,  "Leaf",     "🍃"),
    (700,  "Tree",     "🌳"),
    (1500, "Forest",   "🌲"),
]


def _level_info(balance: int):
    name, icon = "Seedling", "🌱"
    for threshold, lvl_name, lvl_icon in _LEVELS:
        if balance >= threshold:
            name, icon = lvl_name, lvl_icon
    next_at = balance  # already at max
    for threshold, _, __ in _LEVELS:
        if threshold > balance:
            next_at = threshold
            break
    return name, icon, next_at


def award_coins(user_id: int, item: str, category: str, db: Session) -> int:
    """Create a GreenCoinRecord. Caller must commit the session."""
    amount = COIN_RATES.get(category, 10)
    record = GreenCoinRecord(
        user_id=user_id,
        amount=amount,
        action="purchase",
        item=item,
        created_at=datetime.now().isoformat(timespec="seconds"),
    )
    db.add(record)
    return amount


@router.get("/green-coins")
def get_green_coins(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    records = (
        db.query(GreenCoinRecord)
        .filter(GreenCoinRecord.user_id == user_id)
        .order_by(GreenCoinRecord.id.desc())
        .all()
    )
    balance = sum(r.amount for r in records)
    level_name, level_icon, next_at = _level_info(balance)

    return {
        "balance":       balance,
        "level":         level_name,
        "level_icon":    level_icon,
        "next_level_at": next_at,
        "total_purchases": len(records),
        "history": [
            {
                "id":         r.id,
                "amount":     r.amount,
                "action":     r.action,
                "item":       r.item,
                "created_at": r.created_at,
            }
            for r in records[:10]
        ],
    }
