from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.db import get_db, PurchaseRecord
from app.utils.auth import get_current_user_id
from app.routes.coins import award_coins

router = APIRouter()


class PurchaseCreate(BaseModel):
    item: str
    category: str
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)
    purchase_date: date  # validated as YYYY-MM-DD; rejects free-text strings


class PurchaseResponse(BaseModel):
    id: int
    user_id: int
    item: str
    category: str
    quantity: float
    price: float
    purchase_date: str


@router.post("/add-purchase", response_model=PurchaseResponse, status_code=201)
def add_purchase(
    purchase: PurchaseCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _VALID_CATEGORIES = {"Vegetables", "Fruits", "Dairy", "Grains", "Protein", "Beverages"}
    if purchase.category not in _VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {purchase.category}")

    record = PurchaseRecord(
        user_id=user_id,
        item=purchase.item,
        category=purchase.category,
        quantity=purchase.quantity,
        price=purchase.price,
        purchase_date=purchase.purchase_date.isoformat(),
    )
    db.add(record)
    award_coins(user_id, purchase.item, purchase.category, db)
    db.commit()
    db.refresh(record)
    return record


@router.get("/purchases")
def get_purchases(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    purchases = (
        db.query(PurchaseRecord)
        .filter(PurchaseRecord.user_id == user_id)
        .order_by(PurchaseRecord.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": p.id,
            "user_id": p.user_id,
            "item": p.item,
            "category": p.category,
            "quantity": p.quantity,
            "price": p.price,
            "purchase_date": p.purchase_date,
        }
        for p in purchases
    ]


@router.delete("/purchases/{purchase_id}", status_code=204)
def delete_purchase(
    purchase_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    record = (
        db.query(PurchaseRecord)
        .filter(PurchaseRecord.id == purchase_id, PurchaseRecord.user_id == user_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Purchase not found")
    db.delete(record)
    db.commit()


@router.get("/items")
def list_items():
    from app.utils.helpers import ITEMS
    return [
        {
            "item":      item,
            "category":  props["category"],
            "avg_price": props["avg_price"],
            "shelf_life": props["shelf_life"],
            "priority":  props["priority"],
        }
        for item, props in ITEMS.items()
    ]
