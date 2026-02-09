"""Utility functions for the application."""
import os
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from typing import List

from app.models.benefit import Benefit, BenefitPeriod
from app.models.benefit_usage import BenefitUsage


def get_current_date() -> date:
    """Get current date, supporting simulated dates for testing.

    Set SIMULATED_DATE environment variable to override (format: YYYY-MM-DD).
    """
    simulated = os.getenv("SIMULATED_DATE")
    if simulated:
        try:
            return datetime.strptime(simulated, "%Y-%m-%d").date()
        except ValueError:
            pass
    return date.today()


def get_period_dates(period: BenefitPeriod, reference_date: date = None) -> List[tuple[date, date]]:
    """Get all period start/end dates for a benefit period type in the current year.
    
    Args:
        period: The benefit period type (MONTHLY, QUARTERLY, etc)
        reference_date: The date to use as reference (defaults to today)
        
    Returns:
        List of (start_date, end_date) tuples for each period up to current period
    """
    if reference_date is None:
        reference_date = date.today()
    
    year = reference_date.year
    periods = []
    
    if period == BenefitPeriod.MONTHLY:
        # Generate all months up to current month
        for month in range(1, reference_date.month + 1):
            start = date(year, month, 1)
            end = (start + relativedelta(months=1)) - relativedelta(days=1)
            periods.append((start, end))
            
    elif period == BenefitPeriod.QUARTERLY:
        # Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
        current_quarter = (reference_date.month - 1) // 3 + 1
        for q in range(1, current_quarter + 1):
            start_month = (q - 1) * 3 + 1
            start = date(year, start_month, 1)
            end = (start + relativedelta(months=3)) - relativedelta(days=1)
            periods.append((start, end))
            
    elif period == BenefitPeriod.SEMI_ANNUAL:
        # H1: Jan-Jun, H2: Jul-Dec
        current_half = 1 if reference_date.month <= 6 else 2
        for h in range(1, current_half + 1):
            start_month = (h - 1) * 6 + 1
            start = date(year, start_month, 1)
            end = (start + relativedelta(months=6)) - relativedelta(days=1)
            periods.append((start, end))
            
    elif period == BenefitPeriod.ANNUAL:
        # Only include if we're in the current year
        start = date(year, 1, 1)
        end = date(year, 12, 31)
        periods.append((start, end))
    
    return periods


def sync_auto_use_benefits(db: Session) -> dict:
    """Check all auto-use benefits and create missing usage records.
    
    This should be called on app startup or when fetching benefits to ensure
    that all auto-use benefits have usage records for current and past periods.
    
    Args:
        db: Database session
        
    Returns:
        Dictionary with stats about created records
    """
    # Find all auto-use benefits
    auto_benefits = db.query(Benefit).filter(Benefit.is_auto_use == True).all()
    
    created_count = 0
    skipped_count = 0
    
    for benefit in auto_benefits:
        # Get all periods that should exist for this benefit
        periods = get_period_dates(benefit.period)
        
        for period_start, period_end in periods:
            # Check if a usage record already exists for this period
            existing = db.query(BenefitUsage).filter(
                BenefitUsage.benefit_id == benefit.id,
                BenefitUsage.period_start == period_start,
                BenefitUsage.period_end == period_end
            ).first()
            
            if not existing:
                # Create new usage record
                usage = BenefitUsage(
                    benefit_id=benefit.id,
                    period_start=period_start,
                    period_end=period_end,
                    used_amount=benefit.value,
                    used_at=datetime.utcnow(),
                    notes="Auto-created on app sync"
                )
                db.add(usage)
                created_count += 1
            else:
                skipped_count += 1
    
    db.commit()
    
    return {
        "created": created_count,
        "skipped": skipped_count,
        "total_auto_benefits": len(auto_benefits)
    }
