"""Notification service for managing benefit reminders."""
import logging
from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from decimal import Decimal

from app.models import (
    Owner,
    Benefit,
    BenefitUsage,
    CreditCard,
    NotificationPreference,
    NotificationHistory,
    BenefitPeriod,
    CurrencyWallet,
    CurrencyTransaction
)
from app.services.email_service import email_service
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for handling benefit notifications."""

    def __init__(self, db: Session):
        self.db = db

    def get_period_dates(self, period: BenefitPeriod, reference_date: date = None) -> Tuple[date, date]:
        """Get the start and end dates for a benefit period."""
        if reference_date is None:
            reference_date = date.today()

        year = reference_date.year
        month = reference_date.month

        if period == BenefitPeriod.MONTHLY:
            start = date(year, month, 1)
            if month == 12:
                end = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end = date(year, month + 1, 1) - timedelta(days=1)

        elif period == BenefitPeriod.QUARTERLY:
            quarter = (month - 1) // 3
            start_month = quarter * 3 + 1
            start = date(year, start_month, 1)
            end_month = start_month + 3
            if end_month > 12:
                end = date(year + 1, end_month - 12, 1) - timedelta(days=1)
            else:
                end = date(year, end_month, 1) - timedelta(days=1)

        elif period == BenefitPeriod.SEMI_ANNUAL:
            if month <= 6:
                start = date(year, 1, 1)
                end = date(year, 6, 30)
            else:
                start = date(year, 7, 1)
                end = date(year, 12, 31)

        else:  # ANNUAL
            start = date(year, 1, 1)
            end = date(year, 12, 31)

        return start, end

    def get_days_until_expiry(self, period: BenefitPeriod, reference_date: date = None) -> int:
        """Get days until the current period ends."""
        _, end = self.get_period_dates(period, reference_date)
        if reference_date is None:
            reference_date = date.today()
        return (end - reference_date).days

    def get_benefit_remaining_value(self, benefit: Benefit) -> Decimal:
        """Get the remaining value of a benefit for the current period."""
        start, end = self.get_period_dates(benefit.period)

        # Sum up usages that overlap with current period
        # A usage overlaps if: period_start <= end AND period_end >= start
        used = self.db.query(func.sum(BenefitUsage.used_amount)).filter(
            and_(
                BenefitUsage.benefit_id == benefit.id,
                BenefitUsage.period_start <= end,
                BenefitUsage.period_end >= start
            )
        ).scalar() or Decimal(0)

        return benefit.value - used

    def get_expiring_benefits(
        self,
        owner_id: Optional[str] = None,
        days_threshold: int = 3
    ) -> List[dict]:
        """
        Get benefits expiring within the threshold days.

        Returns list of benefit dicts with card info and remaining value.
        """
        query = self.db.query(Benefit).join(CreditCard).join(Owner)

        if owner_id:
            query = query.filter(Owner.id == owner_id)

        # Filter out skipped and auto-use benefits
        query = query.filter(
            and_(
                Benefit.is_skipped == False,
                Benefit.is_auto_use == False
            )
        )

        benefits = query.all()
        expiring_benefits = []

        for benefit in benefits:
            days_left = self.get_days_until_expiry(benefit.period)

            if days_left <= days_threshold:
                remaining = self.get_benefit_remaining_value(benefit)

                if remaining > 0:
                    expiring_benefits.append({
                        "benefit_id": benefit.id,
                        "name": benefit.name,
                        "value": float(benefit.value),
                        "remaining": float(remaining),
                        "period": benefit.period.value,
                        "days_remaining": days_left,
                        "card_id": benefit.card_id,
                        "card_name": benefit.card.name,
                        "card_color": benefit.card.color,
                        "owner_id": benefit.card.owner_id,
                        "owner_name": benefit.card.owner.name,
                        "owner_email": benefit.card.owner.email
                    })

        return expiring_benefits

    def get_wallet_data_for_owner(self, owner_id: str) -> list:
        """
        Get currency wallet data for an owner.
        Returns list of wallet dicts with balance and monthly redemption status.
        """
        today = date.today()
        current_year = today.year
        current_month = today.month

        wallets = self.db.query(CurrencyWallet).filter(
            CurrencyWallet.owner_id == owner_id
        ).all()

        wallet_data = []
        for wallet in wallets:
            # Get card info
            card = self.db.query(CreditCard).filter(CreditCard.id == wallet.card_id).first()
            if not card:
                continue

            # Get transactions
            transactions = self.db.query(CurrencyTransaction).filter(
                CurrencyTransaction.wallet_id == wallet.id
            ).all()

            # Calculate balance
            balance = sum(float(t.amount) for t in transactions)

            # Calculate year-end info
            carryover_limit = float(wallet.carryover_limit or 0)
            must_spend = max(0, balance - carryover_limit)
            months_remaining = 12 - current_month + 1

            # Calculate monthly channel status
            channels = []
            total_monthly_capacity = 0
            total_remaining_this_month = 0

            if wallet.redemption_channels:
                for channel in wallet.redemption_channels:
                    category = channel.get("category")
                    monthly_limit = float(channel.get("monthly_limit", 0))
                    total_monthly_capacity += monthly_limit

                    # Calculate used this month for this category
                    used_this_month = sum(
                        abs(float(t.amount)) for t in transactions
                        if t.category == category
                        and t.transaction_type == "redemption"
                        and t.transaction_date.year == current_year
                        and t.transaction_date.month == current_month
                    )

                    remaining = max(0, monthly_limit - used_this_month)
                    total_remaining_this_month += remaining

                    channels.append({
                        "category": category,
                        "monthly_limit": monthly_limit,
                        "used_this_month": used_this_month,
                        "remaining": remaining,
                        "is_maxed": remaining == 0
                    })

            # Only include if there's remaining capacity or balance needs attention
            if total_remaining_this_month > 0 or must_spend > 0:
                wallet_data.append({
                    "wallet_id": wallet.id,
                    "currency_name": wallet.currency_name,
                    "card_name": card.name,
                    "card_color": card.color,
                    "balance": balance,
                    "must_spend_by_year_end": must_spend,
                    "months_remaining": months_remaining,
                    "monthly_capacity": total_monthly_capacity,
                    "remaining_this_month": total_remaining_this_month,
                    "channels": channels
                })

        return wallet_data

    def get_unused_benefits_for_owner(self, owner_id: str) -> dict:
        """
        Get all unused benefits for an owner (for monthly reminder).
        Returns dict with 'monthly', 'yearly', and 'wallets' sections.
        """
        benefits = self.db.query(Benefit).join(CreditCard).filter(
            and_(
                CreditCard.owner_id == owner_id,
                Benefit.is_skipped == False,
                Benefit.is_auto_use == False
            )
        ).all()

        # Group benefits by period type and card
        monthly_by_card = {}  # card_id -> {card_info, benefits: []}
        yearly_by_card = {}   # card_id -> {card_info, benefits: []}

        for benefit in benefits:
            remaining = self.get_benefit_remaining_value(benefit)
            if remaining <= 0:
                continue

            _, period_end = self.get_period_dates(benefit.period)
            expiry_date = period_end.strftime("%m/%d")

            benefit_info = {
                "benefit_id": benefit.id,
                "name": benefit.name,
                "value": float(benefit.value),
                "remaining": float(remaining),
                "period": benefit.period.value,
                "expiry_date": expiry_date
            }

            card_id = benefit.card_id
            card_info = {
                "card_id": card_id,
                "card_name": benefit.card.name,
                "card_color": benefit.card.color,
                "card_image": benefit.card.image,
                "benefits": []
            }

            # Monthly benefits (MONTHLY period)
            if benefit.period == BenefitPeriod.MONTHLY:
                if card_id not in monthly_by_card:
                    monthly_by_card[card_id] = card_info.copy()
                monthly_by_card[card_id]["benefits"].append(benefit_info)
            # Yearly benefits (QUARTERLY, SEMI_ANNUAL, ANNUAL)
            else:
                if card_id not in yearly_by_card:
                    yearly_by_card[card_id] = card_info.copy()
                yearly_by_card[card_id]["benefits"].append(benefit_info)

        # Get wallet data
        wallets = self.get_wallet_data_for_owner(owner_id)

        return {
            "monthly": list(monthly_by_card.values()),
            "yearly": list(yearly_by_card.values()),
            "wallets": wallets
        }

    def should_send_notification(
        self,
        owner_id: str,
        notification_type: str,
        benefit_id: Optional[str] = None
    ) -> bool:
        """
        Check if a notification should be sent (duplicate prevention).

        Returns True if notification hasn't been sent today for this type.
        """
        today = date.today()

        query = self.db.query(NotificationHistory).filter(
            and_(
                NotificationHistory.owner_id == owner_id,
                NotificationHistory.notification_type == notification_type,
                NotificationHistory.status == "sent",
                func.date(NotificationHistory.scheduled_for) == today
            )
        )

        if benefit_id:
            query = query.filter(NotificationHistory.benefit_id == benefit_id)

        existing = query.first()
        return existing is None

    def record_notification(
        self,
        owner_id: str,
        notification_type: str,
        channel: str,
        status: str,
        benefit_id: Optional[str] = None,
        error_message: Optional[str] = None,
        extra_data: Optional[dict] = None
    ) -> NotificationHistory:
        """Record a notification in history."""
        record = NotificationHistory(
            owner_id=owner_id,
            benefit_id=benefit_id,
            notification_type=notification_type,
            channel=channel,
            status=status,
            scheduled_for=datetime.utcnow(),
            sent_at=datetime.utcnow() if status == "sent" else None,
            error_message=error_message,
            extra_data=extra_data
        )
        self.db.add(record)
        self.db.commit()
        return record

    def get_owner_preferences(self, owner_id: str) -> Optional[NotificationPreference]:
        """Get notification preferences for an owner."""
        return self.db.query(NotificationPreference).filter(
            NotificationPreference.owner_id == owner_id
        ).first()

    def send_monthly_reminders(self) -> dict:
        """
        Send monthly reminder emails to all owners with pending benefits.

        Returns stats on notifications sent.
        """
        stats = {"sent": 0, "skipped": 0, "failed": 0}

        owners = self.db.query(Owner).filter(
            and_(
                Owner.email != None,
                Owner.notifications_enabled == True
            )
        ).all()

        for owner in owners:
            prefs = self.get_owner_preferences(owner.id)
            if prefs and not prefs.monthly_reminder:
                stats["skipped"] += 1
                continue

            if not self.should_send_notification(owner.id, "monthly_reminder"):
                stats["skipped"] += 1
                continue

            benefits_data = self.get_unused_benefits_for_owner(owner.id)
            # Check if there are any benefits or wallets with remaining capacity
            has_monthly = bool(benefits_data.get("monthly"))
            has_yearly = bool(benefits_data.get("yearly"))
            has_wallets = bool(benefits_data.get("wallets"))
            if not has_monthly and not has_yearly and not has_wallets:
                stats["skipped"] += 1
                continue

            # Count total benefits for logging
            total_benefits = sum(
                len(card["benefits"]) for card in benefits_data.get("monthly", [])
            ) + sum(
                len(card["benefits"]) for card in benefits_data.get("yearly", [])
            )
            wallet_count = len(benefits_data.get("wallets", []))

            # Generate AI insights
            ai_insights = None
            if ai_service.is_configured():
                try:
                    ai_insights = ai_service.generate_email_insights(
                        benefits_data=benefits_data,
                        owner_name=owner.name
                    )
                except Exception as e:
                    logger.warning(f"Failed to generate AI insights for {owner.name}: {e}")

            success = email_service.send_monthly_reminder(
                to_email=owner.email,
                owner_name=owner.name,
                benefits_data=benefits_data,
                ai_insights=ai_insights
            )

            if success:
                self.record_notification(
                    owner_id=owner.id,
                    notification_type="monthly_reminder",
                    channel="email",
                    status="sent",
                    extra_data={"benefits_count": total_benefits, "wallet_count": wallet_count}
                )
                stats["sent"] += 1
            else:
                self.record_notification(
                    owner_id=owner.id,
                    notification_type="monthly_reminder",
                    channel="email",
                    status="failed",
                    error_message="Email send failed"
                )
                stats["failed"] += 1

        return stats

    def send_expiry_warnings(self, days_threshold: int = 3) -> dict:
        """
        Send expiry warning emails for benefits expiring soon.

        Returns stats on notifications sent.
        """
        notification_type = "final_day" if days_threshold <= 1 else "3_day_warning"
        stats = {"sent": 0, "skipped": 0, "failed": 0}

        # Group expiring benefits by owner
        expiring = self.get_expiring_benefits(days_threshold=days_threshold)
        by_owner = {}
        for b in expiring:
            owner_id = b["owner_id"]
            if owner_id not in by_owner:
                by_owner[owner_id] = {
                    "owner_name": b["owner_name"],
                    "owner_email": b["owner_email"],
                    "benefits": []
                }
            by_owner[owner_id]["benefits"].append(b)

        for owner_id, data in by_owner.items():
            owner = self.db.query(Owner).filter(Owner.id == owner_id).first()
            if not owner or not owner.email or not owner.notifications_enabled:
                stats["skipped"] += 1
                continue

            prefs = self.get_owner_preferences(owner_id)
            pref_key = "expiry_final_day" if notification_type == "final_day" else "expiry_3day_warning"
            if prefs and not getattr(prefs, pref_key):
                stats["skipped"] += 1
                continue

            if not self.should_send_notification(owner_id, notification_type):
                stats["skipped"] += 1
                continue

            success = email_service.send_expiry_warning(
                to_email=data["owner_email"],
                owner_name=data["owner_name"],
                benefits=data["benefits"],
                days_remaining=days_threshold
            )

            if success:
                self.record_notification(
                    owner_id=owner_id,
                    notification_type=notification_type,
                    channel="email",
                    status="sent",
                    extra_data={"benefits_count": len(data["benefits"])}
                )
                stats["sent"] += 1
            else:
                self.record_notification(
                    owner_id=owner_id,
                    notification_type=notification_type,
                    channel="email",
                    status="failed",
                    error_message="Email send failed"
                )
                stats["failed"] += 1

        return stats
