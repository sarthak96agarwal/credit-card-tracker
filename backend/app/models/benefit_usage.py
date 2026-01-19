from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class BenefitUsage(Base):
    __tablename__ = "benefit_usages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    benefit_id = Column(String, ForeignKey("benefits.id", ondelete="CASCADE"), nullable=False)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    used_amount = Column(Numeric(10, 2), nullable=False)
    used_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(String, nullable=True)

    benefit = relationship("Benefit", back_populates="usages")
