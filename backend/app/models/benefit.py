from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.database import Base


class BenefitPeriod(str, enum.Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    SEMI_ANNUAL = "SEMI_ANNUAL"
    ANNUAL = "ANNUAL"


class Benefit(Base):
    __tablename__ = "benefits"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    card_id = Column(String, ForeignKey("credit_cards.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    value = Column(Numeric(10, 2), nullable=False)
    period = Column(Enum(BenefitPeriod), nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_skipped = Column(Boolean, default=False, nullable=False)  # User doesn't use this benefit
    is_auto_use = Column(Boolean, default=False, nullable=False)  # Benefit is automatically used each period
    created_at = Column(DateTime, default=datetime.utcnow)

    card = relationship("CreditCard", back_populates="benefits")
    usages = relationship("BenefitUsage", back_populates="benefit", cascade="all, delete-orphan")
