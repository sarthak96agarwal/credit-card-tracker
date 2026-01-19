from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from app.database import get_db
from app.models import Benefit
from app.schemas import BenefitCreate, BenefitUpdate, BenefitResponse, BenefitWithUsage

router = APIRouter(prefix="/benefits", tags=["benefits"])


@router.get("/", response_model=List[BenefitWithUsage])
def get_benefits(
    card_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Benefit).options(
        joinedload(Benefit.usages),
        joinedload(Benefit.card)
    )
    if card_id:
        query = query.filter(Benefit.card_id == card_id)
    return query.all()


@router.get("/{benefit_id}", response_model=BenefitWithUsage)
def get_benefit(benefit_id: str, db: Session = Depends(get_db)):
    benefit = db.query(Benefit).options(
        joinedload(Benefit.usages),
        joinedload(Benefit.card)
    ).filter(Benefit.id == benefit_id).first()
    if not benefit:
        raise HTTPException(status_code=404, detail="Benefit not found")
    return benefit


@router.post("/", response_model=BenefitResponse)
def create_benefit(benefit: BenefitCreate, db: Session = Depends(get_db)):
    db_benefit = Benefit(**benefit.model_dump())
    db.add(db_benefit)
    db.commit()
    db.refresh(db_benefit)
    return db_benefit


@router.put("/{benefit_id}", response_model=BenefitResponse)
def update_benefit(benefit_id: str, benefit: BenefitUpdate, db: Session = Depends(get_db)):
    db_benefit = db.query(Benefit).filter(Benefit.id == benefit_id).first()
    if not db_benefit:
        raise HTTPException(status_code=404, detail="Benefit not found")

    update_data = benefit.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_benefit, key, value)

    db.commit()
    db.refresh(db_benefit)
    return db_benefit


@router.delete("/{benefit_id}")
def delete_benefit(benefit_id: str, db: Session = Depends(get_db)):
    benefit = db.query(Benefit).filter(Benefit.id == benefit_id).first()
    if not benefit:
        raise HTTPException(status_code=404, detail="Benefit not found")
    db.delete(benefit)
    db.commit()
    return {"message": "Benefit deleted"}
