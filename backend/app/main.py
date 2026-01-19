from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Credit Card Tracker API",
    description="API for tracking credit card benefits and maximizing value",
    version="1.0.0"
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


@app.get("/")
def root():
    return {"message": "Credit Card Tracker API", "docs": "/docs"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
