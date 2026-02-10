from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from decimal import Decimal
from app.models.benefit import BenefitPeriod, BenefitType


class BenefitCreate(BaseModel):
    card_id: str
    name: str
    value: Decimal
    period: BenefitPeriod
    category: str
    description: Optional[str] = None
    benefit_type: BenefitType = BenefitType.PERIOD_CAPPED
    is_skipped: bool = False
    is_auto_use: bool = False


class BenefitUpdate(BaseModel):
    name: Optional[str] = None
    value: Optional[Decimal] = None
    period: Optional[BenefitPeriod] = None
    category: Optional[str] = None
    description: Optional[str] = None
    benefit_type: Optional[BenefitType] = None
    is_skipped: Optional[bool] = None
    is_auto_use: Optional[bool] = None


class BenefitResponse(BaseModel):
    id: str
    card_id: str
    name: str
    value: Decimal
    period: BenefitPeriod
    category: str
    description: Optional[str]
    benefit_type: BenefitType
    is_skipped: bool
    is_auto_use: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UsageBasic(BaseModel):
    id: str
    period_start: datetime
    period_end: datetime
    used_amount: Decimal
    used_at: datetime

    class Config:
        from_attributes = True


class CardBasic(BaseModel):
    id: str
    name: str
    issuer: str
    color: str

    class Config:
        from_attributes = True


class BenefitWithUsage(BenefitResponse):
    usages: List[UsageBasic] = []
    card: CardBasic
