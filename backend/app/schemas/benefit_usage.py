from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from decimal import Decimal


class BenefitUsageCreate(BaseModel):
    benefit_id: str
    period_start: datetime
    period_end: datetime
    used_amount: Decimal
    notes: Optional[str] = None


class BenefitUsageResponse(BaseModel):
    id: str
    benefit_id: str
    period_start: datetime
    period_end: datetime
    used_amount: Decimal
    used_at: datetime
    notes: Optional[str]

    class Config:
        from_attributes = True
