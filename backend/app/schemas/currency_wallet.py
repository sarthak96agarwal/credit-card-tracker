from pydantic import BaseModel
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from decimal import Decimal


class RedemptionChannel(BaseModel):
    category: str
    monthly_limit: Decimal
    description: Optional[str] = None


class TransactionCreate(BaseModel):
    amount: Decimal  # Positive = credit, Negative = redemption
    transaction_type: str  # 'grant', 'bonus', 'redemption'
    category: Optional[str] = None  # Required for redemptions
    description: Optional[str] = None
    transaction_date: Optional[date] = None


class TransactionResponse(BaseModel):
    id: str
    wallet_id: str
    amount: Decimal
    transaction_type: str
    category: Optional[str]
    description: Optional[str]
    transaction_date: date
    created_at: datetime

    class Config:
        from_attributes = True


class WalletCreate(BaseModel):
    owner_id: str
    card_id: str
    currency_name: str
    carryover_limit: Optional[Decimal] = None
    redemption_channels: Optional[List[Dict[str, Any]]] = None
    initial_balance: Optional[Decimal] = None  # Will create initial grant transaction


class WalletResponse(BaseModel):
    id: str
    owner_id: str
    card_id: str
    currency_name: str
    carryover_limit: Optional[Decimal]
    redemption_channels: Optional[List[Dict[str, Any]]]
    current_balance: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class CardBasicForWallet(BaseModel):
    id: str
    name: str
    color: str

    class Config:
        from_attributes = True


class MonthlyUsage(BaseModel):
    month: int  # 1-12
    month_name: str  # Jan, Feb, etc.
    used: Decimal
    is_current: bool
    is_past: bool
    is_completed: bool


class ChannelStatus(BaseModel):
    category: str
    monthly_limit: Decimal
    description: Optional[str]
    used_this_month: Decimal
    remaining: Decimal
    monthly_history: List[MonthlyUsage] = []  # Usage for each month of the year


class WalletWithDetails(WalletResponse):
    card: CardBasicForWallet
    transactions: List[TransactionResponse] = []
    monthly_channel_status: List[ChannelStatus] = []
    must_spend_by_year_end: Decimal = Decimal(0)
    months_remaining: int = 0
    max_spendable_this_year: Decimal = Decimal(0)
    on_track: bool = True
