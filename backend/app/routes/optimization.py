from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from app.services.budget_optimizer import optimize_budget, generate_weekly_plan
from app.utils.store import model_store

router = APIRouter()


class BudgetRequest(BaseModel):
    budget: float = Field(gt=0, description="Total budget in Indian Rupees (₹)")
    household_size: int = Field(default=3, ge=1, le=10)
    preferred_categories: Optional[List[str]] = None


@router.post("/optimize-budget")
def optimize(req: BudgetRequest):
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    result = optimize_budget(
        budget=req.budget,
        household_size=req.household_size,
        preferred_categories=req.preferred_categories,
    )
    result["currency"] = "INR"
    return result


@router.get("/generate-plan")
def get_plan(household_size: int = 3):
    if not model_store["initialized"]:
        raise HTTPException(status_code=503, detail="Models not yet initialized")

    plan = generate_weekly_plan(household_size=household_size)
    plan["currency"] = "INR"
    return plan
