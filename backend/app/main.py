from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.database import engine, Base
from app.routers import (
    owners_router,
    cards_router,
    card_templates_router,
    benefits_router,
    benefit_usages_router,
    multipliers_router,
    dashboard_router,
)
from app.routers.notifications import router as notifications_router
from app.routers.ai import router as ai_router
from app.workers.scheduler import start_scheduler, shutdown_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Create database tables
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - start/stop scheduler."""
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(
    title="Credit Card Tracker API",
    description="API for tracking credit card benefits and maximizing value",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(owners_router)
app.include_router(cards_router)
app.include_router(card_templates_router)
app.include_router(benefits_router)
app.include_router(benefit_usages_router)
app.include_router(multipliers_router)
app.include_router(dashboard_router)
app.include_router(notifications_router)
app.include_router(ai_router)


@app.get("/")
def root():
    return {"message": "Credit Card Tracker API", "docs": "/docs"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
