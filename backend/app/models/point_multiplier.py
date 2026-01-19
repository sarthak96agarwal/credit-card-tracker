from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class PointMultiplier(Base):
    __tablename__ = "point_multipliers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    card_id = Column(String, ForeignKey("credit_cards.id", ondelete="CASCADE"), nullable=False)
    category = Column(String, nullable=False)
    multiplier = Column(Numeric(4, 2), nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    card = relationship("CreditCard", back_populates="multipliers")
