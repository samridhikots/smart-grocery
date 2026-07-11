from datetime import datetime

from app.database.db import (
    GreenCoinRecord,
    PurchaseRecord,
    SessionLocal,
    UserRecord,
)
from app.utils.auth import hash_password

COIN_RATES = {
    "Vegetables": 25,
    "Fruits": 25,
    "Dairy": 15,
    "Grains": 15,
    "Protein": 10,
    "Beverages": 10,
}


def _green_coin_amount(category: str) -> int:
    return COIN_RATES.get(category, 10)


def _seed_users() -> list[dict]:
    now = datetime.now().isoformat(timespec="seconds")
    return [
        {
            "name": "Asha Patel",
            "email": "asha.patel@example.com",
            "password": "DemoPass123",
            "household_size": 4,
            "monthly_budget": 12000.0,
            "dietary_prefs": "vegetarian",
            "onboarding_complete": 1,
            "created_at": now,
        },
        {
            "name": "Ravi Mehta",
            "email": "ravi.mehta@example.com",
            "password": "DemoPass123",
            "household_size": 3,
            "monthly_budget": 10000.0,
            "dietary_prefs": "",
            "onboarding_complete": 1,
            "created_at": now,
        },
        {
            "name": "Sita Sharma",
            "email": "sita.sharma@example.com",
            "password": "DemoPass123",
            "household_size": 3,
            "monthly_budget": 8000.0,
            "dietary_prefs": "no-dairy",
            "onboarding_complete": 1,
            "created_at": now,
        },
        {
            "name": "Neha Singh",
            "email": "neha.singh@example.com",
            "password": "DemoPass123",
            "household_size": 2,
            "monthly_budget": 6000.0,
            "dietary_prefs": "",
            "onboarding_complete": 1,
            "created_at": now,
        },
        {
            "name": "Rahul Kapoor",
            "email": "rahul.kapoor@example.com",
            "password": "DemoPass123",
            "household_size": 5,
            "monthly_budget": 15000.0,
            "dietary_prefs": "",
            "onboarding_complete": 1,
            "created_at": now,
        },
    ]


def _seed_purchases() -> list[dict]:
    return [
        # Asha Patel
        {"user_email": "asha.patel@example.com", "item": "Tomato", "category": "Vegetables", "quantity": 1.5, "price": 40.0, "purchase_date": "2025-01-04"},
        {"user_email": "asha.patel@example.com", "item": "Milk", "category": "Dairy", "quantity": 2.0, "price": 65.0, "purchase_date": "2025-01-06"},
        {"user_email": "asha.patel@example.com", "item": "Rice", "category": "Grains", "quantity": 5.0, "price": 330.0, "purchase_date": "2025-01-08"},
        {"user_email": "asha.patel@example.com", "item": "Onion", "category": "Vegetables", "quantity": 2.0, "price": 70.0, "purchase_date": "2025-01-10"},
        {"user_email": "asha.patel@example.com", "item": "Banana", "category": "Fruits", "quantity": 1.0, "price": 50.0, "purchase_date": "2025-01-12"},
        {"user_email": "asha.patel@example.com", "item": "Paneer", "category": "Dairy", "quantity": 0.5, "price": 90.0, "purchase_date": "2025-02-05"},
        {"user_email": "asha.patel@example.com", "item": "Spinach", "category": "Vegetables", "quantity": 0.5, "price": 30.0, "purchase_date": "2025-02-10"},
        {"user_email": "asha.patel@example.com", "item": "Atta", "category": "Grains", "quantity": 5.0, "price": 275.0, "purchase_date": "2025-03-01"},
        {"user_email": "asha.patel@example.com", "item": "Apple", "category": "Fruits", "quantity": 0.5, "price": 100.0, "purchase_date": "2025-03-05"},
        {"user_email": "asha.patel@example.com", "item": "Ghee", "category": "Dairy", "quantity": 0.05, "price": 28.0, "purchase_date": "2025-04-07"},
        {"user_email": "asha.patel@example.com", "item": "Tomato", "category": "Vegetables", "quantity": 1.0, "price": 40.0, "purchase_date": "2025-04-15"},
        {"user_email": "asha.patel@example.com", "item": "Cauliflower", "category": "Vegetables", "quantity": 1.0, "price": 40.0, "purchase_date": "2025-05-08"},
        {"user_email": "asha.patel@example.com", "item": "Mango", "category": "Fruits", "quantity": 1.0, "price": 120.0, "purchase_date": "2025-05-12"},
        {"user_email": "asha.patel@example.com", "item": "Tea", "category": "Beverages", "quantity": 0.25, "price": 70.0, "purchase_date": "2025-06-03"},
        {"user_email": "asha.patel@example.com", "item": "Curd", "category": "Dairy", "quantity": 0.5, "price": 45.0, "purchase_date": "2025-06-20"},
        # Ravi Mehta
        {"user_email": "ravi.mehta@example.com", "item": "Chicken", "category": "Protein", "quantity": 0.5, "price": 220.0, "purchase_date": "2025-01-08"},
        {"user_email": "ravi.mehta@example.com", "item": "Rice", "category": "Grains", "quantity": 5.0, "price": 325.0, "purchase_date": "2025-01-10"},
        {"user_email": "ravi.mehta@example.com", "item": "Milk", "category": "Dairy", "quantity": 2.0, "price": 65.0, "purchase_date": "2025-01-12"},
        {"user_email": "ravi.mehta@example.com", "item": "Potato", "category": "Vegetables", "quantity": 2.0, "price": 60.0, "purchase_date": "2025-01-15"},
        {"user_email": "ravi.mehta@example.com", "item": "Orange", "category": "Fruits", "quantity": 0.5, "price": 40.0, "purchase_date": "2025-02-05"},
        {"user_email": "ravi.mehta@example.com", "item": "Eggs", "category": "Protein", "quantity": 12.0, "price": 84.0, "purchase_date": "2025-02-10"},
        {"user_email": "ravi.mehta@example.com", "item": "Atta", "category": "Grains", "quantity": 5.0, "price": 275.0, "purchase_date": "2025-03-02"},
        {"user_email": "ravi.mehta@example.com", "item": "Tomato", "category": "Vegetables", "quantity": 1.0, "price": 40.0, "purchase_date": "2025-03-05"},
        {"user_email": "ravi.mehta@example.com", "item": "Coffee", "category": "Beverages", "quantity": 0.1, "price": 45.0, "purchase_date": "2025-03-18"},
        {"user_email": "ravi.mehta@example.com", "item": "Chicken", "category": "Protein", "quantity": 0.5, "price": 220.0, "purchase_date": "2025-04-02"},
        {"user_email": "ravi.mehta@example.com", "item": "Onion", "category": "Vegetables", "quantity": 2.0, "price": 70.0, "purchase_date": "2025-04-10"},
        {"user_email": "ravi.mehta@example.com", "item": "Banana", "category": "Fruits", "quantity": 1.0, "price": 50.0, "purchase_date": "2025-04-18"},
        {"user_email": "ravi.mehta@example.com", "item": "Butter", "category": "Dairy", "quantity": 0.1, "price": 55.0, "purchase_date": "2025-05-12"},
        {"user_email": "ravi.mehta@example.com", "item": "Tea", "category": "Beverages", "quantity": 0.25, "price": 70.0, "purchase_date": "2025-05-20"},
        {"user_email": "ravi.mehta@example.com", "item": "Sugar", "category": "Grains", "quantity": 1.0, "price": 45.0, "purchase_date": "2025-06-12"},
        {"user_email": "ravi.mehta@example.com", "item": "Fish", "category": "Protein", "quantity": 0.5, "price": 280.0, "purchase_date": "2025-06-15"},
        # Sita Sharma
        {"user_email": "sita.sharma@example.com", "item": "Rice", "category": "Grains", "quantity": 5.0, "price": 330.0, "purchase_date": "2025-01-05"},
        {"user_email": "sita.sharma@example.com", "item": "Moong Dal", "category": "Protein", "quantity": 0.5, "price": 55.0, "purchase_date": "2025-01-08"},
        {"user_email": "sita.sharma@example.com", "item": "Potato", "category": "Vegetables", "quantity": 2.0, "price": 60.0, "purchase_date": "2025-01-09"},
        {"user_email": "sita.sharma@example.com", "item": "Banana", "category": "Fruits", "quantity": 1.0, "price": 50.0, "purchase_date": "2025-01-15"},
        {"user_email": "sita.sharma@example.com", "item": "Atta", "category": "Grains", "quantity": 5.0, "price": 275.0, "purchase_date": "2025-02-03"},
        {"user_email": "sita.sharma@example.com", "item": "Spinach", "category": "Vegetables", "quantity": 0.5, "price": 30.0, "purchase_date": "2025-02-10"},
        {"user_email": "sita.sharma@example.com", "item": "Eggs", "category": "Protein", "quantity": 12.0, "price": 84.0, "purchase_date": "2025-02-14"},
        {"user_email": "sita.sharma@example.com", "item": "Orange", "category": "Fruits", "quantity": 0.5, "price": 40.0, "purchase_date": "2025-03-03"},
        {"user_email": "sita.sharma@example.com", "item": "Chicken", "category": "Protein", "quantity": 0.5, "price": 220.0, "purchase_date": "2025-03-05"},
        {"user_email": "sita.sharma@example.com", "item": "Tomato", "category": "Vegetables", "quantity": 1.0, "price": 40.0, "purchase_date": "2025-04-01"},
        {"user_email": "sita.sharma@example.com", "item": "Sugar", "category": "Grains", "quantity": 1.0, "price": 45.0, "purchase_date": "2025-04-12"},
        {"user_email": "sita.sharma@example.com", "item": "Grapes", "category": "Fruits", "quantity": 0.5, "price": 50.0, "purchase_date": "2025-04-20"},
        {"user_email": "sita.sharma@example.com", "item": "Mustard Oil", "category": "Beverages", "quantity": 1.0, "price": 180.0, "purchase_date": "2025-05-04"},
        {"user_email": "sita.sharma@example.com", "item": "Onion", "category": "Vegetables", "quantity": 2.0, "price": 70.0, "purchase_date": "2025-05-18"},
        {"user_email": "sita.sharma@example.com", "item": "Rice", "category": "Grains", "quantity": 5.0, "price": 330.0, "purchase_date": "2025-06-08"},
        {"user_email": "sita.sharma@example.com", "item": "Tea", "category": "Beverages", "quantity": 0.25, "price": 70.0, "purchase_date": "2025-06-15"},
        # Neha Singh
        {"user_email": "neha.singh@example.com", "item": "Apple", "category": "Fruits", "quantity": 0.5, "price": 100.0, "purchase_date": "2025-01-03"},
        {"user_email": "neha.singh@example.com", "item": "Tomato", "category": "Vegetables", "quantity": 1.0, "price": 40.0, "purchase_date": "2025-01-06"},
        {"user_email": "neha.singh@example.com", "item": "Milk", "category": "Dairy", "quantity": 2.0, "price": 65.0, "purchase_date": "2025-01-09"},
        {"user_email": "neha.singh@example.com", "item": "Cauliflower", "category": "Vegetables", "quantity": 1.0, "price": 40.0, "purchase_date": "2025-02-12"},
        {"user_email": "neha.singh@example.com", "item": "Banana", "category": "Fruits", "quantity": 1.0, "price": 50.0, "purchase_date": "2025-02-16"},
        {"user_email": "neha.singh@example.com", "item": "Atta", "category": "Grains", "quantity": 5.0, "price": 275.0, "purchase_date": "2025-03-10"},
        {"user_email": "neha.singh@example.com", "item": "Curd", "category": "Dairy", "quantity": 0.5, "price": 45.0, "purchase_date": "2025-03-14"},
        {"user_email": "neha.singh@example.com", "item": "Sugar", "category": "Grains", "quantity": 1.0, "price": 45.0, "purchase_date": "2025-04-05"},
        {"user_email": "neha.singh@example.com", "item": "Orange", "category": "Fruits", "quantity": 0.5, "price": 40.0, "purchase_date": "2025-04-12"},
        {"user_email": "neha.singh@example.com", "item": "Paneer", "category": "Dairy", "quantity": 0.25, "price": 90.0, "purchase_date": "2025-05-08"},
        {"user_email": "neha.singh@example.com", "item": "Spinach", "category": "Vegetables", "quantity": 0.5, "price": 30.0, "purchase_date": "2025-05-18"},
        {"user_email": "neha.singh@example.com", "item": "Tea", "category": "Beverages", "quantity": 0.25, "price": 70.0, "purchase_date": "2025-06-08"},
        {"user_email": "neha.singh@example.com", "item": "Ghee", "category": "Dairy", "quantity": 0.05, "price": 28.0, "purchase_date": "2025-06-20"},
        {"user_email": "neha.singh@example.com", "item": "Apple", "category": "Fruits", "quantity": 0.5, "price": 100.0, "purchase_date": "2025-06-24"},
        # Rahul Kapoor
        {"user_email": "rahul.kapoor@example.com", "item": "Atta", "category": "Grains", "quantity": 10.0, "price": 550.0, "purchase_date": "2025-01-02"},
        {"user_email": "rahul.kapoor@example.com", "item": "Rice", "category": "Grains", "quantity": 10.0, "price": 650.0, "purchase_date": "2025-01-05"},
        {"user_email": "rahul.kapoor@example.com", "item": "Chicken", "category": "Protein", "quantity": 1.0, "price": 440.0, "purchase_date": "2025-01-07"},
        {"user_email": "rahul.kapoor@example.com", "item": "Milk", "category": "Dairy", "quantity": 5.0, "price": 162.5, "purchase_date": "2025-01-10"},
        {"user_email": "rahul.kapoor@example.com", "item": "Tomato", "category": "Vegetables", "quantity": 2.0, "price": 80.0, "purchase_date": "2025-01-14"},
        {"user_email": "rahul.kapoor@example.com", "item": "Onion", "category": "Vegetables", "quantity": 4.0, "price": 140.0, "purchase_date": "2025-01-18"},
        {"user_email": "rahul.kapoor@example.com", "item": "Eggs", "category": "Protein", "quantity": 24.0, "price": 168.0, "purchase_date": "2025-02-03"},
        {"user_email": "rahul.kapoor@example.com", "item": "Sugar", "category": "Grains", "quantity": 2.0, "price": 90.0, "purchase_date": "2025-02-08"},
        {"user_email": "rahul.kapoor@example.com", "item": "Butter", "category": "Dairy", "quantity": 0.2, "price": 110.0, "purchase_date": "2025-02-12"},
        {"user_email": "rahul.kapoor@example.com", "item": "Mustard Oil", "category": "Beverages", "quantity": 2.0, "price": 360.0, "purchase_date": "2025-02-17"},
        {"user_email": "rahul.kapoor@example.com", "item": "Fish", "category": "Protein", "quantity": 1.0, "price": 560.0, "purchase_date": "2025-03-05"},
        {"user_email": "rahul.kapoor@example.com", "item": "Ghee", "category": "Dairy", "quantity": 0.1, "price": 56.0, "purchase_date": "2025-03-12"},
        {"user_email": "rahul.kapoor@example.com", "item": "Banana", "category": "Fruits", "quantity": 2.0, "price": 100.0, "purchase_date": "2025-03-20"},
        {"user_email": "rahul.kapoor@example.com", "item": "Potato", "category": "Vegetables", "quantity": 5.0, "price": 150.0, "purchase_date": "2025-04-01"},
        {"user_email": "rahul.kapoor@example.com", "item": "Tea", "category": "Beverages", "quantity": 0.5, "price": 140.0, "purchase_date": "2025-04-06"},
        {"user_email": "rahul.kapoor@example.com", "item": "Paneer", "category": "Dairy", "quantity": 0.5, "price": 180.0, "purchase_date": "2025-05-10"},
        {"user_email": "rahul.kapoor@example.com", "item": "Mango", "category": "Fruits", "quantity": 2.0, "price": 240.0, "purchase_date": "2025-05-14"},
        {"user_email": "rahul.kapoor@example.com", "item": "Tomato", "category": "Vegetables", "quantity": 3.0, "price": 120.0, "purchase_date": "2025-05-20"},
        {"user_email": "rahul.kapoor@example.com", "item": "Rice", "category": "Grains", "quantity": 10.0, "price": 650.0, "purchase_date": "2025-06-04"},
        {"user_email": "rahul.kapoor@example.com", "item": "Chicken", "category": "Protein", "quantity": 1.0, "price": 440.0, "purchase_date": "2025-06-10"},
    ]


def seed_demo_data() -> None:
    db = SessionLocal()
    try:
        users = _seed_users()
        emails = [user["email"] for user in users]

        existing_users = db.query(UserRecord).filter(UserRecord.email.in_(emails)).all()
        existing_emails = {user.email for user in existing_users}

        for user in users:
            if user["email"] in existing_emails:
                continue
            db.add(
                UserRecord(
                    name=user["name"],
                    email=user["email"],
                    password_hash=hash_password(user["password"]),
                    household_size=user["household_size"],
                    monthly_budget=user["monthly_budget"],
                    dietary_prefs=user["dietary_prefs"],
                    onboarding_complete=user["onboarding_complete"],
                    created_at=user["created_at"],
                )
            )

        db.flush()

        users_by_email = {
            user.email: user.id
            for user in db.query(UserRecord).filter(UserRecord.email.in_(emails)).all()
        }

        for purchase in _seed_purchases():
            user_email = purchase["user_email"]
            user_id = users_by_email.get(user_email)
            if user_id is None:
                continue

            # Only seed purchase history once per demo user.
            if db.query(PurchaseRecord).filter(PurchaseRecord.user_id == user_id).first():
                continue

            db.add(
                PurchaseRecord(
                    user_id=user_id,
                    item=purchase["item"],
                    category=purchase["category"],
                    quantity=purchase["quantity"],
                    price=purchase["price"],
                    purchase_date=purchase["purchase_date"],
                )
            )
            db.add(
                GreenCoinRecord(
                    user_id=user_id,
                    amount=_green_coin_amount(purchase["category"]),
                    action="purchase",
                    item=purchase["item"],
                    created_at=datetime.now().isoformat(timespec="seconds"),
                )
            )

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
