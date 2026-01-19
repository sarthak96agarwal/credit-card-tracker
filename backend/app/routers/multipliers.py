from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import PointMultiplier
from app.schemas import PointMultiplierCreate, PointMultiplierUpdate, PointMultiplierResponse

router = APIRouter(prefix="/multipliers", tags=["multipliers"])


@router.get("/", response_model=List[PointMultiplierResponse])
def get_multipliers(
    card_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(PointMultiplier)
    if card_id:
        query = query.filter(PointMultiplier.card_id == card_id)
    return query.all()


@router.post("/", response_model=PointMultiplierResponse)
def create_multiplier(multiplier: PointMultiplierCreate, db: Session = Depends(get_db)):
    db_multiplier = PointMultiplier(**multiplier.model_dump())
    db.add(db_multiplier)
    db.commit()
    db.refresh(db_multiplier)
    return db_multiplier


@router.put("/{multiplier_id}", response_model=PointMultiplierResponse)
def update_multiplier(multiplier_id: str, multiplier: PointMultiplierUpdate, db: Session = Depends(get_db)):
    db_multiplier = db.query(PointMultiplier).filter(PointMultiplier.id == multiplier_id).first()
    if not db_multiplier:
        raise HTTPException(status_code=404, detail="Multiplier not found")

    update_data = multiplier.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_multiplier, key, value)

    db.commit()
    db.refresh(db_multiplier)
    return db_multiplier


@router.delete("/{multiplier_id}")
def delete_multiplier(multiplier_id: str, db: Session = Depends(get_db)):
    multiplier = db.query(PointMultiplier).filter(PointMultiplier.id == multiplier_id).first()
    if not multiplier:
        raise HTTPException(status_code=404, detail="Multiplier not found")
    db.delete(multiplier)
    db.commit()
    return {"message": "Multiplier deleted"}
