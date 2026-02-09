from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class CurrencyWallet(Base):
    """Wallet for tracking currency balances like Bilt Cash."""
    __tablename__ = "currency_wallets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String, ForeignKey("owners.id", ondelete="CASCADE"), nullable=False)
    card_id = Column(String, ForeignKey("credit_cards.id", ondelete="CASCADE"), nullable=False)
    currency_name = Column(String(100), nullable=False)  # e.g., "Bilt Cash"
    carryover_limit = Column(Numeric(10, 2), nullable=True)  # Max that carries to next year
    redemption_channels = Column(JSON, nullable=True)  # Monthly limits per category
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("Owner", back_populates="wallets")
    card = relationship("CreditCard", back_populates="wallets")
    transactions = relationship("CurrencyTransaction", back_populates="wallet", cascade="all, delete-orphan")

    @property
    def current_balance(self):
        """Calculate balance from transactions."""
        return sum(t.amount for t in self.transactions)
