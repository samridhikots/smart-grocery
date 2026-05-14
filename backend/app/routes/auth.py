from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import UserRecord, get_db
from app.utils.auth import (
    create_access_token,
    get_current_user_id,
    hash_password,
    verify_password,
)
from app.utils.limiter import limiter

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class OnboardingRequest(BaseModel):
    household_size: int = 3
    monthly_budget: float = 3000.0
    dietary_prefs: str = ""  # comma-separated e.g. "vegetarian,no-onion"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_response(user: UserRecord) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "household_size": user.household_size,
        "monthly_budget": user.monthly_budget,
        "dietary_prefs": user.dietary_prefs or "",
        "onboarding_complete": bool(user.onboarding_complete),
    }


def _auth_response(user: UserRecord) -> dict:
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": _user_response(user),
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/auth/signup", status_code=201)
@limiter.limit("5/minute")
def signup(request: Request, req: SignupRequest, db: Session = Depends(get_db)):
    if not req.name.strip() or not req.email.strip() or not req.password:
        raise HTTPException(status_code=400, detail="All fields are required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if db.query(UserRecord).filter(UserRecord.email == req.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = UserRecord(
        name=req.name.strip(),
        email=req.email.lower().strip(),
        password_hash=hash_password(req.password),
        household_size=3,
        monthly_budget=3000.0,
        dietary_prefs="",
        onboarding_complete=0,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _auth_response(user)


@router.post("/auth/login")
@limiter.limit("10/minute")
def login(request: Request, req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(UserRecord).filter(UserRecord.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _auth_response(user)


@router.get("/auth/me")
def get_me(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    user = db.query(UserRecord).filter(UserRecord.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_response(user)


@router.put("/auth/onboarding")
def complete_onboarding(
    req: OnboardingRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = db.query(UserRecord).filter(UserRecord.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.household_size = max(1, min(req.household_size, 15))
    user.monthly_budget = max(500.0, req.monthly_budget)
    user.dietary_prefs = req.dietary_prefs
    user.onboarding_complete = 1
    db.commit()
    db.refresh(user)
    return _user_response(user)
