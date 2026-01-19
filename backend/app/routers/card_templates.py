from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.database import get_db
from app.models import CardTemplate
from app.schemas import CardTemplateResponse, CardTemplateWithDetails

router = APIRouter(prefix="/card-templates", tags=["card-templates"])


@router.get("/", response_model=List[CardTemplateWithDetails])
def get_card_templates(db: Session = Depends(get_db)):
    """Get all supported card templates."""
    templates = db.query(CardTemplate).options(
        joinedload(CardTemplate.template_benefits),
        joinedload(CardTemplate.template_multipliers)
    ).order_by(CardTemplate.name).all()
    return templates


@router.get("/{template_id}", response_model=CardTemplateWithDetails)
def get_card_template(template_id: str, db: Session = Depends(get_db)):
    """Get a specific card template by ID."""
    template = db.query(CardTemplate).options(
        joinedload(CardTemplate.template_benefits),
        joinedload(CardTemplate.template_multipliers)
    ).filter(CardTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Card template not found")
    return template


@router.get("/by-slug/{slug}", response_model=CardTemplateWithDetails)
def get_card_template_by_slug(slug: str, db: Session = Depends(get_db)):
    """Get a specific card template by slug."""
    template = db.query(CardTemplate).options(
        joinedload(CardTemplate.template_benefits),
        joinedload(CardTemplate.template_multipliers)
    ).filter(CardTemplate.slug == slug).first()
    if not template:
        raise HTTPException(status_code=404, detail="Card template not found")
    return template
