from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from decimal import Decimal


class TemplateBenefitResponse(BaseModel):
    id: str
    name: str
    value: Decimal
    period: str
    category: str
    description: Optional[str]

    class Config:
        from_attributes = True


class TemplateMultiplierResponse(BaseModel):
    id: str
    category: str
    multiplier: Decimal
    notes: Optional[str]

    class Config:
        from_attributes = True


class CardTemplateResponse(BaseModel):
    id: str
    slug: str
    name: str
    issuer: str
    annual_fee: Decimal
    color: str
    created_at: datetime

    class Config:
        from_attributes = True


class CardTemplateWithDetails(CardTemplateResponse):
    template_benefits: List[TemplateBenefitResponse] = []
    template_multipliers: List[TemplateMultiplierResponse] = []
