"""Agent-optimized endpoints for the credit card AI agent.

Each endpoint returns {summary, items, metadata} where summary is a
pre-formatted string the agent can use directly without extra LLM calls.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import CreditCard, Benefit, CurrencyWallet, CurrencyTransaction
from app.models.benefit import BenefitPeriod, BenefitType
from app.routers.dashboard import get_period_dates, get_annual_value

router = APIRouter(prefix="/agent", tags=["agent"])


@router.get("/benefit-status")
def get_benefit_status(
    owner_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Return current benefit usage, remaining balances, and expiring benefits."""
    now = datetime.now()

    benefits = (
        db.query(Benefit)
        .join(CreditCard)
        .options(
            joinedload(Benefit.card),
            joinedload(Benefit.usages),
        )
        .filter(CreditCard.owner_id == owner_id)
        .all()
    )

    items = []
    total_value = Decimal(0)
    total_used = Decimal(0)
    expiring_soon = 0  # within 7 days

    for benefit in benefits:
        if benefit.benefit_type == BenefitType.UNLIMITED_USE:
            continue

        period_start, period_end = get_period_dates(benefit.period)
        used = sum(
            u.used_amount for u in benefit.usages
            if period_start <= u.period_start < period_end
        )
        remaining = benefit.value - used
        days_until_expiry = (period_end - now).days
        expires_on = period_end.date().isoformat()

        total_value += benefit.value
        total_used += used
        if days_until_expiry <= 7 and remaining > 0:
            expiring_soon += 1

        items.append({
            "card": benefit.card.name,
            "benefit": benefit.name,
            "period": benefit.period.value,
            "remaining": float(remaining),
            "total": float(benefit.value),
            "used": float(used),
            "expires_on": expires_on,
            "days_until_expiry": days_until_expiry,
            "is_skipped": benefit.is_skipped,
        })

    # Sort by days_until_expiry so the most urgent appear first
    items.sort(key=lambda x: x["days_until_expiry"])

    utilization = float(total_used / total_value) if total_value > 0 else 0.0
    used_fmt = f"${total_used:,.2f}"
    total_fmt = f"${total_value:,.2f}"
    pct = round(utilization * 100)
    expiring_str = (
        f"{expiring_soon} benefit{'s' if expiring_soon != 1 else ''} expire in the next 7 days. "
        if expiring_soon > 0 else "No benefits expiring in the next 7 days. "
    )
    summary = (
        f"{expiring_str}"
        f"You've used {used_fmt} of {total_fmt} this period ({pct}%)."
    )

    return {
        "summary": summary,
        "items": items,
        "metadata": {
            "owner_id": owner_id,
            "as_of": now.isoformat(),
            "total_benefits_tracked": len(items),
            "utilization_rate": round(utilization, 4),
        },
    }


@router.get("/cards")
def get_cards(
    owner_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Return cards owned with annual fees, benefits value, and point multipliers."""
    now = datetime.now()

    cards = (
        db.query(CreditCard)
        .options(
            joinedload(CreditCard.benefits).joinedload(Benefit.usages),
            joinedload(CreditCard.multipliers),
        )
        .filter(CreditCard.owner_id == owner_id)
        .all()
    )

    items = []
    total_fees = Decimal(0)
    total_benefits = Decimal(0)

    for card in cards:
        annual_benefits = Decimal(0)
        for benefit in card.benefits:
            if benefit.benefit_type == BenefitType.UNLIMITED_USE:
                continue
            annual_benefits += get_annual_value(benefit.value, benefit.period)

        fee = card.annual_fee or Decimal(0)
        net = annual_benefits - fee
        total_fees += fee
        total_benefits += annual_benefits

        multipliers = [
            {"category": m.category, "multiplier": f"{m.multiplier}x"}
            for m in card.multipliers
        ]

        items.append({
            "card_id": card.id,
            "name": card.name,
            "issuer": card.issuer,
            "annual_fee": float(fee),
            "benefits_value": float(annual_benefits),
            "net_value": float(net),
            "multipliers": multipliers,
        })

    items.sort(key=lambda x: x["net_value"], reverse=True)

    n = len(items)
    summary = (
        f"You have {n} card{'s' if n != 1 else ''} "
        f"totalling ${total_fees:,.2f} in annual fees "
        f"and ${total_benefits:,.2f} in tracked benefits."
    )

    return {
        "summary": summary,
        "items": items,
        "metadata": {
            "owner_id": owner_id,
            "as_of": now.isoformat(),
            "total_cards": n,
            "total_annual_fees": float(total_fees),
        },
    }


@router.get("/wallet-status")
def get_wallet_status(
    owner_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Return currency wallet balances and year-end spending pace."""
    now = datetime.now()
    current_year = now.year
    current_month = now.month

    wallets = (
        db.query(CurrencyWallet)
        .options(joinedload(CurrencyWallet.card))
        .filter(CurrencyWallet.owner_id == owner_id)
        .all()
    )

    items = []

    for wallet in wallets:
        transactions = (
            db.query(CurrencyTransaction)
            .filter(CurrencyTransaction.wallet_id == wallet.id)
            .all()
        )

        balance = sum(t.amount for t in transactions)
        carryover_limit = wallet.carryover_limit or Decimal(0)
        must_spend = max(Decimal(0), balance - carryover_limit)
        months_remaining = 12 - current_month + 1

        monthly_capacity = sum(
            Decimal(str(c.get("monthly_limit", 0)))
            for c in (wallet.redemption_channels or [])
        )
        max_spendable = monthly_capacity * months_remaining
        on_track = max_spendable >= must_spend

        card_name = wallet.card.name if wallet.card else "Unknown"

        items.append({
            "card": card_name,
            "currency": wallet.currency_name,
            "balance": float(balance),
            "on_track": on_track,
            "must_spend_by_year_end": float(must_spend),
            "months_remaining": months_remaining,
        })

    n = len(items)
    if n == 0:
        summary = "You have no currency wallets."
    else:
        wallet_strs = [
            f"{w['card']} {w['currency']} balance is ${w['balance']:,.2f}"
            for w in items
        ]
        on_track_count = sum(1 for w in items if w["on_track"])
        summary = (
            f"You have {n} wallet{'s' if n != 1 else ''}. "
            + "; ".join(wallet_strs)
            + f". {on_track_count} of {n} on track to spend by year end."
        )

    return {
        "summary": summary,
        "items": items,
        "metadata": {
            "owner_id": owner_id,
            "as_of": now.isoformat(),
        },
    }
