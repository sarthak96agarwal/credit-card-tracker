from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Date
from sqlalchemy.orm import relationship
from datetime import datetime, date
import uuid

from app.database import Base


class CurrencyTransaction(Base):
    """Transaction record for currency wallet (credits and redemptions)."""
    __tablename__ = "currency_transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    wallet_id = Column(String, ForeignKey("currency_wallets.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)  # Positive = credit, Negative = redemption
    transaction_type = Column(String(20), nullable=False)  # 'grant', 'bonus', 'redemption'
    category = Column(String(50), nullable=True)  # For redemptions: 'Hotel', 'Dining', etc.
    description = Column(String(255), nullable=True)
    transaction_date = Column(Date, nullable=False, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)

    wallet = relationship("CurrencyWallet", back_populates="transactions")
