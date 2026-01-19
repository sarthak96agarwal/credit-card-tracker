from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class CreditCard(Base):
    """An owner's instance of a card template."""
    __tablename__ = "credit_cards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String, ForeignKey("owners.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(String, ForeignKey("card_templates.id", ondelete="CASCADE"), nullable=False)
    last_four = Column(String(4), nullable=True)
    annual_fee_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("Owner", back_populates="cards")
    template = relationship("CardTemplate", back_populates="cards")
    benefits = relationship("Benefit", back_populates="card", cascade="all, delete-orphan")
    multipliers = relationship("PointMultiplier", back_populates="card", cascade="all, delete-orphan")

    # Convenience properties to access template data
    @property
    def name(self):
        return self.template.name if self.template else None

    @property
    def issuer(self):
        return self.template.issuer if self.template else None

    @property
    def annual_fee(self):
        return self.template.annual_fee if self.template else None

    @property
    def color(self):
        return self.template.color if self.template else "#1f2937"

    @property
    def image(self):
        return self.template.image if self.template else None
