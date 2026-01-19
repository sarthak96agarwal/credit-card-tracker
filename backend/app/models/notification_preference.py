from sqlalchemy import Column, String, DateTime, Boolean, Time, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String, ForeignKey("owners.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Channel preferences
    email_enabled = Column(Boolean, default=True)
    push_enabled = Column(Boolean, default=True)

    # Notification type preferences
    monthly_reminder = Column(Boolean, default=True)       # 15th of month
    expiry_3day_warning = Column(Boolean, default=True)    # 3 days before
    expiry_final_day = Column(Boolean, default=True)       # Last day

    # Quiet hours (optional)
    quiet_hours_start = Column(Time, nullable=True)        # e.g., 22:00
    quiet_hours_end = Column(Time, nullable=True)          # e.g., 08:00

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("Owner", back_populates="notification_preferences")
