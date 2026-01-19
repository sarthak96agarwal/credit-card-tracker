from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Owner
from app.schemas import OwnerCreate, OwnerUpdate, OwnerResponse, OwnerWithCards

router = APIRouter(prefix="/owners", tags=["owners"])


@router.get("/", response_model=List[OwnerWithCards])
def get_owners(db: Session = Depends(get_db)):
    owners = db.query(Owner).all()
    return owners


@router.get("/{owner_id}", response_model=OwnerWithCards)
def get_owner(owner_id: str, db: Session = Depends(get_db)):
    owner = db.query(Owner).filter(Owner.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")
    return owner


@router.post("/", response_model=OwnerResponse)
def create_owner(owner: OwnerCreate, db: Session = Depends(get_db)):
    db_owner = Owner(name=owner.name)
    db.add(db_owner)
    db.commit()
    db.refresh(db_owner)
    return db_owner


@router.put("/{owner_id}", response_model=OwnerResponse)
def update_owner(owner_id: str, update: OwnerUpdate, db: Session = Depends(get_db)):
    owner = db.query(Owner).filter(Owner.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(owner, field, value)

    db.commit()
    db.refresh(owner)
    return owner


@router.delete("/{owner_id}")
def delete_owner(owner_id: str, db: Session = Depends(get_db)):
    owner = db.query(Owner).filter(Owner.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")
    db.delete(owner)
    db.commit()
    return {"message": "Owner deleted"}
