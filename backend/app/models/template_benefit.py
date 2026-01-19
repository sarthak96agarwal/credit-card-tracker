from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base
from app.models.benefit import BenefitPeriod


class TemplateBenefit(Base):
    """Benefit definition for a card template."""
    __tablename__ = "template_benefits"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey("card_templates.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    value = Column(Numeric(10, 2), nullable=False)
    period = Column(Enum(BenefitPeriod), nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    template = relationship("CardTemplate", back_populates="template_benefits")
