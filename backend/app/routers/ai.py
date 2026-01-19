"""API endpoints for AI-powered features."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.database import get_db
from app.models import Owner, CreditCard
from app.services.ai_service import ai_service
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/ai", tags=["AI"])


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    owner_id: str
    message: str
    history: Optional[List[ChatMessage]] = None


class ChatResponse(BaseModel):
    response: str
    configured: bool


class CardRecommendationRequest(BaseModel):
    owner_id: str
    category: str  # e.g., "groceries", "dining", "travel"


class InsightsRequest(BaseModel):
    owner_id: str


class InsightsResponse(BaseModel):
    insights: Optional[str]
    configured: bool


@router.get("/status")
def get_ai_status():
    """Check if AI service is configured."""
    return {
        "configured": ai_service.is_configured(),
        "model": ai_service.model_name if ai_service.is_configured() else None
    }


@router.post("/chat", response_model=ChatResponse)
def chat_with_ai(request: ChatRequest, db: Session = Depends(get_db)):
    """Chat with the AI assistant about your benefits."""
    # Verify owner exists
    owner = db.query(Owner).filter(Owner.id == request.owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    # Get benefits data for context
    notification_service = NotificationService(db)
    benefits_data = notification_service.get_unused_benefits_for_owner(request.owner_id)

    # Get cards with multipliers for context
    cards = db.query(CreditCard).filter(CreditCard.owner_id == request.owner_id).all()
    cards_data = []
    for card in cards:
        card_info = {
            "name": card.name,
            "multipliers": [
                {
                    "category": m.category,
                    "multiplier": float(m.multiplier),
                }
                for m in card.multipliers
            ]
        }
        cards_data.append(card_info)

    # Convert history to expected format
    history = None
    if request.history:
        history = [{"role": msg.role, "content": msg.content} for msg in request.history]

    # Generate response
    response = ai_service.chat(
        message=request.message,
        benefits_data=benefits_data,
        owner_name=owner.name,
        cards_data=cards_data,
        chat_history=history
    )

    return ChatResponse(
        response=response,
        configured=ai_service.is_configured()
    )


@router.post("/insights", response_model=InsightsResponse)
def get_insights(request: InsightsRequest, db: Session = Depends(get_db)):
    """Get AI-generated insights about your benefits."""
    # Verify owner exists
    owner = db.query(Owner).filter(Owner.id == request.owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    # Get benefits data
    notification_service = NotificationService(db)
    benefits_data = notification_service.get_unused_benefits_for_owner(request.owner_id)

    # Generate insights
    insights = ai_service.generate_email_insights(
        benefits_data=benefits_data,
        owner_name=owner.name
    )

    return InsightsResponse(
        insights=insights,
        configured=ai_service.is_configured()
    )


@router.post("/recommend-card")
def recommend_card(request: CardRecommendationRequest, db: Session = Depends(get_db)):
    """Get a recommendation for which card to use for a purchase category."""
    # Verify owner exists
    owner = db.query(Owner).filter(Owner.id == request.owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    # Get cards with multipliers
    cards = db.query(CreditCard).filter(CreditCard.owner_id == request.owner_id).all()

    cards_data = []
    for card in cards:
        card_info = {
            "name": card.name,
            "multipliers": [
                {
                    "category": m.category,
                    "multiplier": float(m.multiplier),
                    "notes": m.notes
                }
                for m in card.multipliers
            ]
        }
        cards_data.append(card_info)

    recommendation = ai_service.get_card_recommendation(
        purchase_category=request.category,
        cards_data=cards_data
    )

    return {
        "category": request.category,
        "recommendation": recommendation,
        "configured": ai_service.is_configured()
    }
