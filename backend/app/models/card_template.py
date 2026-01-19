from sqlalchemy import Column, String, DateTime, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class CardTemplate(Base):
    """Generic card definition - represents a credit card product (e.g., Amex Platinum)."""
    __tablename__ = "card_templates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    slug = Column(String, unique=True, nullable=False)  # e.g., "amex_platinum" - matches JSON filename
    name = Column(String, nullable=False)  # e.g., "American Express Platinum"
    issuer = Column(String, nullable=False)  # e.g., "American Express"
    annual_fee = Column(Numeric(10, 2), default=0)
    color = Column(String, default="#1f2937")
    image = Column(String, nullable=True)  # Path to card image, e.g., "/cards/amex-platinum.png"
    created_at = Column(DateTime, default=datetime.utcnow)

    # Template benefits and multipliers
    template_benefits = relationship("TemplateBenefit", back_populates="template", cascade="all, delete-orphan")
    template_multipliers = relationship("TemplateMultiplier", back_populates="template", cascade="all, delete-orphan")

    # Cards created from this template
    cards = relationship("CreditCard", back_populates="template")
