from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel

from app.database import get_db
from app.models import Owner, CreditCard, Benefit, BenefitUsage
from app.models.benefit import BenefitPeriod

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def get_period_dates(period: BenefitPeriod) -> tuple:
    now = datetime.now()
    year = now.year
    month = now.month

    if period == BenefitPeriod.MONTHLY:
        start = datetime(year, month, 1)
        if month == 12:
            end = datetime(year + 1, 1, 1)
        else:
            end = datetime(year, month + 1, 1)
    elif period == BenefitPeriod.QUARTERLY:
        quarter = (month - 1) // 3
        start = datetime(year, quarter * 3 + 1, 1)
        end_month = quarter * 3 + 4
        if end_month > 12:
            end = datetime(year + 1, 1, 1)
        else:
            end = datetime(year, end_month, 1)
    elif period == BenefitPeriod.SEMI_ANNUAL:
        half = (month - 1) // 6
        start = datetime(year, half * 6 + 1, 1)
        end_month = half * 6 + 7
        if end_month > 12:
            end = datetime(year + 1, 1, 1)
        else:
            end = datetime(year, end_month, 1)
    else:  # ANNUAL
        start = datetime(year, 1, 1)
        end = datetime(year + 1, 1, 1)

    return start, end


def get_annual_value(value: Decimal, period: BenefitPeriod) -> Decimal:
    multipliers = {
        BenefitPeriod.MONTHLY: 12,
        BenefitPeriod.QUARTERLY: 4,
        BenefitPeriod.SEMI_ANNUAL: 2,
        BenefitPeriod.ANNUAL: 1
    }
    return value * multipliers[period]


class DashboardStats(BaseModel):
    total_cards: int
    total_annual_fees: Decimal
    total_benefits_value: Decimal
    benefits_used_this_period: Decimal
    utilization_rate: float


class ExpiringBenefit(BaseModel):
    id: str
    name: str
    value: Decimal
    period: str
    days_remaining: int
    card_name: str
    card_color: str
    owner_name: str


class CardAnalysis(BaseModel):
    id: str
    name: str
    issuer: str
    color: str
    owner_name: str
    annual_fee: Decimal
    total_benefits_value: Decimal
    benefits_used: Decimal
    utilization_rate: float
    net_value: Decimal


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    owner_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(CreditCard).options(
        joinedload(CreditCard.benefits).joinedload(Benefit.usages)
    )
    if owner_id:
        query = query.filter(CreditCard.owner_id == owner_id)

    cards = query.all()

    total_cards = len(cards)
    total_annual_fees = sum(card.annual_fee or Decimal(0) for card in cards)
    total_benefits_value = Decimal(0)
    benefits_used_this_period = Decimal(0)

    for card in cards:
        for benefit in card.benefits:
            annual_value = get_annual_value(benefit.value, benefit.period)
            total_benefits_value += annual_value

            period_start, period_end = get_period_dates(benefit.period)
            for usage in benefit.usages:
                if period_start <= usage.period_start < period_end:
                    benefits_used_this_period += usage.used_amount

    utilization_rate = 0.0
    if total_benefits_value > 0:
        utilization_rate = float(benefits_used_this_period / total_benefits_value * 100)

    return DashboardStats(
        total_cards=total_cards,
        total_annual_fees=total_annual_fees,
        total_benefits_value=total_benefits_value,
        benefits_used_this_period=benefits_used_this_period,
        utilization_rate=round(utilization_rate, 1)
    )


@router.get("/expiring-benefits", response_model=List[ExpiringBenefit])
def get_expiring_benefits(
    owner_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Benefit).options(
        joinedload(Benefit.card).joinedload(CreditCard.owner),
        joinedload(Benefit.usages)
    )
    if owner_id:
        query = query.join(CreditCard).filter(CreditCard.owner_id == owner_id)

    benefits = query.all()
    now = datetime.now()
    expiring = []

    for benefit in benefits:
        period_start, period_end = get_period_dates(benefit.period)

        # Check if benefit is used this period
        used_amount = sum(
            usage.used_amount for usage in benefit.usages
            if period_start <= usage.period_start < period_end
        )

        if used_amount < benefit.value:
            days_remaining = (period_end - now).days
            if days_remaining <= 30 and days_remaining >= 0:
                expiring.append(ExpiringBenefit(
                    id=benefit.id,
                    name=benefit.name,
                    value=benefit.value - used_amount,
                    period=benefit.period.value,
                    days_remaining=days_remaining,
                    card_name=benefit.card.name,
                    card_color=benefit.card.color,
                    owner_name=benefit.card.owner.name
                ))

    return sorted(expiring, key=lambda x: x.days_remaining)


@router.get("/card-analysis", response_model=List[CardAnalysis])
def get_card_analysis(
    owner_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(CreditCard).options(
        joinedload(CreditCard.owner),
        joinedload(CreditCard.benefits).joinedload(Benefit.usages)
    )
    if owner_id:
        query = query.filter(CreditCard.owner_id == owner_id)

    cards = query.all()
    now = datetime.now()
    year_start = datetime(now.year, 1, 1)
    year_end = datetime(now.year + 1, 1, 1)

    analysis = []
    for card in cards:
        total_benefits_value = Decimal(0)
        benefits_used = Decimal(0)

        for benefit in card.benefits:
            annual_value = get_annual_value(benefit.value, benefit.period)
            total_benefits_value += annual_value

            for usage in benefit.usages:
                if year_start <= usage.used_at < year_end:
                    benefits_used += usage.used_amount

        utilization_rate = 0.0
        if total_benefits_value > 0:
            utilization_rate = float(benefits_used / total_benefits_value * 100)

        net_value = total_benefits_value - (card.annual_fee or Decimal(0))

        analysis.append(CardAnalysis(
            id=card.id,
            name=card.name,
            issuer=card.issuer,
            color=card.color,
            owner_name=card.owner.name,
            annual_fee=card.annual_fee or Decimal(0),
            total_benefits_value=total_benefits_value,
            benefits_used=benefits_used,
            utilization_rate=round(utilization_rate, 1),
            net_value=net_value
        ))

    return sorted(analysis, key=lambda x: x.net_value, reverse=True)
