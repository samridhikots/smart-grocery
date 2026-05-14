"""Shared fixtures for all tests.

Uses an in-memory SQLite DB and patches model_store so routes that check
`model_store["initialized"]` work without triggering real ML training.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from unittest.mock import MagicMock, patch

from app.database.db import Base, get_db
from app.utils.store import model_store


# ── in-memory test database ─────────────────────────────────────────────────

# StaticPool forces all connections to reuse one underlying connection, so
# tables created by create_all() are visible to subsequent sessions.

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def fresh_db():
    """Re-create tables before each test and drop them after."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


# ── minimal model_store stub ─────────────────────────────────────────────────

_mock_model = MagicMock()
_mock_model.predict.return_value = [1.0]
_mock_model.predict_proba.return_value = [0.2]
_mock_model.is_trained = True

@pytest.fixture(autouse=True)
def no_background_init():
    """Prevent the lifespan background thread from training models during tests.
    Without this the thread races with stub_model_store and overwrites its patches."""
    with patch("app.main._background_init"):
        yield


@pytest.fixture(autouse=True)
def disable_rate_limit():
    """Turn off slowapi counting so tests don't throttle each other."""
    from app.utils.limiter import limiter
    limiter.enabled = False
    yield
    limiter.enabled = True
    limiter.reset()  # clear accumulated counts


@pytest.fixture(autouse=True)
def stub_model_store():
    """Patch model_store so routes don't 503 during tests."""
    original = dict(model_store)
    model_store.update({
        "initialized": True,
        "demand":  {"linear": _mock_model, "xgboost": _mock_model,
                    "scaler": MagicMock(), "feature_names": [],
                    "metrics": {"linear": {"r2": 0.8}, "xgboost": {"r2": 0.85}}},
        "waste":   {"logistic": _mock_model, "tabnet": _mock_model,
                    "scaler": MagicMock(), "feature_names": [],
                    "feature_stats": {}, "metrics": {"logistic": {}, "tabnet": {}}},
        "anomaly":        {"model": None, "scaler": None, "is_trained": False},
        "recommendation": {"model": None, "is_trained": False},
        "sustainability": {"item_footprint": {}, "tracker": None, "is_ready": False},
        "item_stats": {},
    })
    yield
    model_store.clear()
    model_store.update(original)


# ── test client ──────────────────────────────────────────────────────────────

@pytest.fixture()
def client():
    from app.main import app
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client):
    """Register a test user and return Bearer headers."""
    resp = client.post("/api/auth/signup", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "password123",
    })
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
