from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from datetime import date

from app.database.db import get_db, PurchaseRecord
from app.utils.helpers import ITEMS
from app.utils.auth import get_current_user_id

router = APIRouter()


class PurchaseCreate(BaseModel):
    item: str
    category: str
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)
    purchase_date: str


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
    if purchase.item not in ITEMS and purchase.category not in [
        "Vegetables", "Fruits", "Dairy", "Grains", "Protein", "Beverages"
    ]:
        raise HTTPException(status_code=400, detail=f"Unknown item: {purchase.item}")

    record = PurchaseRecord(
        user_id=user_id,
        item=purchase.item,
        category=purchase.category,
        quantity=purchase.quantity,
        price=purchase.price,
        purchase_date=purchase.purchase_date,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/purchases")
def get_purchases(
    limit: int = 50,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    purchases = (
        db.query(PurchaseRecord)
        .filter(PurchaseRecord.user_id == user_id)
        .order_by(PurchaseRecord.id.desc())
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



@router.get("/items")
def list_items():
    return [
        {
            "item": item,
            "category": props["category"],
            "avg_price": props["avg_price"],
            "shelf_life": props["shelf_life"],
            "priority": props["priority"],
        }
        for item, props in ITEMS.items()
    ]
