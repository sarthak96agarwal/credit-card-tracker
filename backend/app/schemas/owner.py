from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class OwnerCreate(BaseModel):
    name: str
    email: Optional[str] = None


class OwnerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    notifications_enabled: Optional[bool] = None


class OwnerResponse(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    notifications_enabled: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


class CreditCardBasic(BaseModel):
    id: str
    name: str
    issuer: str
    color: str

    class Config:
        from_attributes = True


class OwnerWithCards(OwnerResponse):
    cards: List[CreditCardBasic] = []
