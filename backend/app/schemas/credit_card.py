from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from decimal import Decimal


class OwnerBasic(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class TemplateBasic(BaseModel):
    id: str
    slug: str
    name: str
    issuer: str
    annual_fee: Decimal
    color: str

    class Config:
        from_attributes = True


class BenefitBasic(BaseModel):
    id: str
    name: str
    value: Decimal
    period: str
    category: str
    is_skipped: bool = False
    is_auto_use: bool = False

    class Config:
        from_attributes = True


class MultiplierBasic(BaseModel):
    id: str
    category: str
    multiplier: Decimal
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class CreditCardCreate(BaseModel):
    """Create a new card by assigning a template to an owner."""
    owner_id: str
    template_id: str
    last_four: Optional[str] = None
    annual_fee_date: Optional[datetime] = None


class CreditCardUpdate(BaseModel):
    last_four: Optional[str] = None
    annual_fee_date: Optional[datetime] = None


class CreditCardResponse(BaseModel):
    id: str
    owner_id: str
    template_id: str
    last_four: Optional[str]
    annual_fee_date: Optional[datetime]
    created_at: datetime
    # Include template fields for convenience
    name: Optional[str] = None
    issuer: Optional[str] = None
    annual_fee: Optional[Decimal] = None
    color: Optional[str] = None

    class Config:
        from_attributes = True


class CreditCardWithDetails(BaseModel):
    id: str
    owner_id: str
    template_id: str
    last_four: Optional[str]
    annual_fee_date: Optional[datetime]
    created_at: datetime
    # Template info
    name: str
    issuer: str
    annual_fee: Decimal
    color: str
    # Related objects
    owner: OwnerBasic
    template: TemplateBasic
    benefits: List[BenefitBasic] = []
    multipliers: List[MultiplierBasic] = []

    class Config:
        from_attributes = True
