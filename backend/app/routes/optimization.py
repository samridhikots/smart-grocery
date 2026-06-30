from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import List, Optional

from app.services.budget_optimizer import optimize_user_budget, generate_weekly_plan
from app.utils.store import model_store
from app.utils.auth import get_current_user_id
from app.database.db import get_db

router = APIRouter()


class BudgetRequest(BaseModel):
    budget: float = Field(gt=0, description="Total budget in Indian Rupees (₹)")
    household_size: int = Field(default=3, ge=1, le=10)
    preferred_categories: Optional[List[str]] = None


@router.post("/optimize-budget")
def optimize(
    req: BudgetRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    try:
        result = optimize_user_budget(
            user_id=user_id,
            budget=req.budget,
            db=db,
            household_size=req.household_size,
            preferred_categories=req.preferred_categories if req.preferred_categories else None,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/generate-plan")
def get_plan(household_size: int = 3):
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    plan = generate_weekly_plan(household_size=household_size)
    plan["currency"] = "INR"
    return plan
