from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class TemplateMultiplier(Base):
    """Multiplier definition for a card template."""
    __tablename__ = "template_multipliers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey("card_templates.id", ondelete="CASCADE"), nullable=False)
    category = Column(String, nullable=False)
    multiplier = Column(Numeric(5, 2), nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    template = relationship("CardTemplate", back_populates="template_multipliers")
