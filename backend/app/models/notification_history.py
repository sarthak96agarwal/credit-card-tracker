from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class NotificationHistory(Base):
    __tablename__ = "notification_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String, ForeignKey("owners.id", ondelete="CASCADE"), nullable=False)
    benefit_id = Column(String, ForeignKey("benefits.id", ondelete="SET NULL"), nullable=True)

    # Notification details
    notification_type = Column(String(50), nullable=False)  # 'monthly_reminder', '3_day_warning', 'final_day'
    channel = Column(String(20), nullable=False)             # 'email', 'push'
    status = Column(String(20), nullable=False)              # 'pending', 'sent', 'failed', 'skipped'

    # Timing
    scheduled_for = Column(DateTime, nullable=False)
    sent_at = Column(DateTime, nullable=True)

    # Error tracking
    error_message = Column(Text, nullable=True)

    # Additional context
    extra_data = Column(JSONB, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("Owner", back_populates="notification_history")
    benefit = relationship("Benefit")

    __table_args__ = (
        Index('idx_notification_history_dedup', 'owner_id', 'benefit_id', 'notification_type'),
    )
