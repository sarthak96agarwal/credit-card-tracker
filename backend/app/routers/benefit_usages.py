from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import BenefitUsage
from app.schemas import BenefitUsageCreate, BenefitUsageResponse

router = APIRouter(prefix="/benefit-usages", tags=["benefit-usages"])


@router.get("/", response_model=List[BenefitUsageResponse])
def get_benefit_usages(
    benefit_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(BenefitUsage)
    if benefit_id:
        query = query.filter(BenefitUsage.benefit_id == benefit_id)
    return query.all()


@router.post("/", response_model=BenefitUsageResponse)
def create_benefit_usage(usage: BenefitUsageCreate, db: Session = Depends(get_db)):
    db_usage = BenefitUsage(**usage.model_dump())
    db.add(db_usage)
    db.commit()
    db.refresh(db_usage)
    return db_usage


@router.delete("/{usage_id}")
def delete_benefit_usage(usage_id: str, db: Session = Depends(get_db)):
    usage = db.query(BenefitUsage).filter(BenefitUsage.id == usage_id).first()
    if not usage:
        raise HTTPException(status_code=404, detail="Usage not found")
    db.delete(usage)
    db.commit()
    return {"message": "Usage deleted"}
