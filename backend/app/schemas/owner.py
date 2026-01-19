from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class OwnerCreate(BaseModel):
    name: str


class OwnerResponse(BaseModel):
    id: str
    name: str
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
