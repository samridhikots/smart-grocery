import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.db import create_tables
from app.services.evaluator import train_all_models
from app.routes import grocery, prediction, optimization, comparison
from app.routes import insights, sustainability

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== Smart Grocery System (India) — Startup ===")
    create_tables()

    # Choose data source: Kaggle → pipeline, else → India-specific synthetic
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(grocery.router,        prefix="/api", tags=["Grocery"])
app.include_router(prediction.router,     prefix="/api", tags=["Prediction"])
app.include_router(optimization.router,   prefix="/api", tags=["Optimization"])
app.include_router(comparison.router,     prefix="/api", tags=["Comparison"])
app.include_router(insights.router,       prefix="/api", tags=["Insights"])
app.include_router(sustainability.router, prefix="/api", tags=["Sustainability"])


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
    return {
        "status":          "healthy",
        "models_ready":    model_store["initialized"],
        "anomaly_trained": model_store["anomaly"]["is_trained"],
        "recommender_trained": model_store["recommendation"]["is_trained"],
        "sustainability_ready": model_store["sustainability"]["is_ready"],
    }
