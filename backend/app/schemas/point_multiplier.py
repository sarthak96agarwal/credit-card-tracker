from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from decimal import Decimal


class PointMultiplierCreate(BaseModel):
    card_id: str
    category: str
    multiplier: Decimal
    notes: Optional[str] = None


class PointMultiplierUpdate(BaseModel):
    category: Optional[str] = None
    multiplier: Optional[Decimal] = None
    notes: Optional[str] = None


class PointMultiplierResponse(BaseModel):
    id: str
    card_id: str
    category: str
    multiplier: Decimal
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
