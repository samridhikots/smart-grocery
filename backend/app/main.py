import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.db import create_tables
from app.services.evaluator import train_all_models
from app.routes import grocery, optimization, auth as auth_routes

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
        logger.info("=== System ready ===")
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://smart-grocery-six.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router,  prefix="/api", tags=["Auth"])
app.include_router(grocery.router,      prefix="/api", tags=["Grocery"])
app.include_router(optimization.router, prefix="/api", tags=["Optimization"])


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": "Smart Grocery Management System — India",
        "version": "2.0.0",
        "models":  [],
        "docs":    "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
