from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class Owner(Base):
    __tablename__ = "owners"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    email = Column(String, nullable=True)
    notifications_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    cards = relationship("CreditCard", back_populates="owner", cascade="all, delete-orphan")
    notification_preferences = relationship("NotificationPreference", back_populates="owner", uselist=False, cascade="all, delete-orphan")
    notification_history = relationship("NotificationHistory", back_populates="owner", cascade="all, delete-orphan")
    wallets = relationship("CurrencyWallet", back_populates="owner", cascade="all, delete-orphan")
