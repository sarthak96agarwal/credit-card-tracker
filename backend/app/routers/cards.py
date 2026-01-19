from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from decimal import Decimal

from app.database import get_db
from app.models import CreditCard, CardTemplate, Benefit, PointMultiplier
from app.schemas import CreditCardCreate, CreditCardUpdate, CreditCardResponse, CreditCardWithDetails

router = APIRouter(prefix="/cards", tags=["cards"])


def card_to_response(card: CreditCard) -> dict:
    """Convert a CreditCard to a response dict with template info."""
    return {
        "id": card.id,
        "owner_id": card.owner_id,
        "template_id": card.template_id,
        "last_four": card.last_four,
        "annual_fee_date": card.annual_fee_date,
        "created_at": card.created_at,
        "name": card.template.name,
        "issuer": card.template.issuer,
        "annual_fee": card.template.annual_fee,
        "color": card.template.color,
        "owner": card.owner,
        "template": card.template,
        "benefits": card.benefits,
        "multipliers": card.multipliers,
    }


@router.get("/", response_model=List[CreditCardWithDetails])
def get_cards(
    owner_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get all cards, optionally filtered by owner."""
    query = db.query(CreditCard).options(
        joinedload(CreditCard.owner),
        joinedload(CreditCard.template),
        joinedload(CreditCard.benefits),
        joinedload(CreditCard.multipliers)
    )
    if owner_id:
        query = query.filter(CreditCard.owner_id == owner_id)
    cards = query.all()
    return [card_to_response(card) for card in cards]


@router.get("/{card_id}", response_model=CreditCardWithDetails)
def get_card(card_id: str, db: Session = Depends(get_db)):
    """Get a specific card by ID."""
    card = db.query(CreditCard).options(
        joinedload(CreditCard.owner),
        joinedload(CreditCard.template),
        joinedload(CreditCard.benefits),
        joinedload(CreditCard.multipliers)
    ).filter(CreditCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card_to_response(card)


@router.post("/", response_model=CreditCardWithDetails)
def assign_card_to_owner(card_data: CreditCardCreate, db: Session = Depends(get_db)):
    """Assign a card template to an owner (creates a new card instance)."""
    # Verify template exists
    template = db.query(CardTemplate).options(
        joinedload(CardTemplate.template_benefits),
        joinedload(CardTemplate.template_multipliers)
    ).filter(CardTemplate.id == card_data.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Card template not found")

    # Check if owner already has this card
    existing = db.query(CreditCard).filter(
        CreditCard.owner_id == card_data.owner_id,
        CreditCard.template_id == card_data.template_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Owner already has this card")

    # Create the card instance
    card = CreditCard(
        owner_id=card_data.owner_id,
        template_id=card_data.template_id,
        last_four=card_data.last_four,
        annual_fee_date=card_data.annual_fee_date,
    )
    db.add(card)
    db.commit()
    db.refresh(card)

    # Copy benefits from template
    for tb in template.template_benefits:
        benefit = Benefit(
            card_id=card.id,
            name=tb.name,
            value=tb.value,
            period=tb.period,
            category=tb.category,
            description=tb.description,
            is_skipped=False,
            is_auto_use=False,
        )
        db.add(benefit)

    # Copy multipliers from template
    for tm in template.template_multipliers:
        multiplier = PointMultiplier(
            card_id=card.id,
            category=tm.category,
            multiplier=tm.multiplier,
            notes=tm.notes,
        )
        db.add(multiplier)

    db.commit()

    # Reload with all relationships
    card = db.query(CreditCard).options(
        joinedload(CreditCard.owner),
        joinedload(CreditCard.template),
        joinedload(CreditCard.benefits),
        joinedload(CreditCard.multipliers)
    ).filter(CreditCard.id == card.id).first()

    return card_to_response(card)


@router.put("/{card_id}", response_model=CreditCardWithDetails)
def update_card(card_id: str, card_data: CreditCardUpdate, db: Session = Depends(get_db)):
    """Update a card's personal details (last_four, annual_fee_date)."""
    card = db.query(CreditCard).options(
        joinedload(CreditCard.owner),
        joinedload(CreditCard.template),
        joinedload(CreditCard.benefits),
        joinedload(CreditCard.multipliers)
    ).filter(CreditCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    update_data = card_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(card, key, value)

    db.commit()
    db.refresh(card)
    return card_to_response(card)


@router.delete("/{card_id}")
def remove_card_from_owner(card_id: str, db: Session = Depends(get_db)):
    """Remove a card from an owner (unassign)."""
    card = db.query(CreditCard).filter(CreditCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()
    return {"message": "Card removed from owner"}
