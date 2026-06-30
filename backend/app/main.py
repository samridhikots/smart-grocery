import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.database.db import create_tables
from app.services.evaluator import train_all_models
from app.routes import grocery, prediction, optimization, comparison
from app.routes import insights, sustainability, auth as auth_routes
from app.routes import catalog, coins, datasets
from app.utils.limiter import limiter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _background_init():
    try:
        from app.data_pipeline.pipeline import kaggle_data_available, run_kaggle_pipeline
        from app.utils.helpers import ensure_data_dir
        ensure_data_dir()

        if kaggle_data_available():
            logger.info("[startup] Kaggle datasets found — running ingestion pipeline...")
            run_kaggle_pipeline()
        else:
            logger.info("[startup] Kaggle datasets not found — using India-specific synthetic data...")
            from app.datasets.generator import generate_all_datasets
            generate_all_datasets()

        train_all_models()
        logger.info("=== System ready (7 models active) ===")
    except Exception:
        logger.exception("[startup] Background initialization failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== Smart Grocery System (India) — Startup ===")
    create_tables()

    # Run data generation and model training in the background so the port
    # binds immediately (required for Render's port-scan health check).
    t = threading.Thread(target=_background_init, daemon=True)
    t.start()

    yield
    logger.info("=== Shutting down ===")


app = FastAPI(
    title="Smart Grocery Management System — India",
    description=(
        "AI-powered grocery management for Indian households. "
        "Demand prediction, waste reduction, overspending detection, "
        "smart recommendations, and sustainability tracking."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_extra_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://smart-grocery-six.vercel.app",
        *_extra_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router,    prefix="/api", tags=["Auth"])
app.include_router(grocery.router,        prefix="/api", tags=["Grocery"])
app.include_router(prediction.router,     prefix="/api", tags=["Prediction"])
app.include_router(optimization.router,   prefix="/api", tags=["Optimization"])
app.include_router(comparison.router,     prefix="/api", tags=["Comparison"])
app.include_router(insights.router,       prefix="/api", tags=["Insights"])
app.include_router(sustainability.router, prefix="/api", tags=["Sustainability"])
app.include_router(catalog.router,        prefix="/api", tags=["Catalog"])
app.include_router(coins.router,          prefix="/api", tags=["GreenCoins"])
app.include_router(datasets.router,       prefix="/api", tags=["Datasets"])


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": "Smart Grocery Management System — India",
        "version": "2.0.0",
        "models":  ["Ridge", "XGBoost", "Logistic", "TabNet", "IsolationForest", "FP-Growth", "Sustainability"],
        "docs":    "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    from app.utils.store import model_store
    initialized = model_store["initialized"]
    models = {
        "demand_linear":  model_store["demand"]["linear"] is not None,
        "demand_xgboost": model_store["demand"]["xgboost"] is not None,
        "waste_logistic": model_store["waste"]["logistic"] is not None,
        "waste_tabnet":   model_store["waste"]["tabnet"] is not None,
        "anomaly":        model_store["anomaly"]["is_trained"],
        "recommender":    model_store["recommendation"]["is_trained"],
        "sustainability": model_store["sustainability"]["is_ready"],
    }
    return {
        "status":       "ready" if initialized else "initializing",
        "models_ready": initialized,
        "models":       models,
    }
