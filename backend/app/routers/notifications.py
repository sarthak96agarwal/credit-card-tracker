"""API endpoints for notifications."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import Owner, NotificationPreference, NotificationHistory
from app.schemas import (
    NotificationPreferenceUpdate,
    NotificationPreferenceResponse,
    NotificationHistoryResponse,
    NotificationTriggerRequest,
    NotificationStatsResponse,
    ExpiringBenefitInfo
)
from app.services.notification_service import NotificationService
from app.workers.scheduler import run_job_now

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/preferences/{owner_id}", response_model=NotificationPreferenceResponse)
def get_notification_preferences(owner_id: str, db: Session = Depends(get_db)):
    """Get notification preferences for an owner."""
    prefs = db.query(NotificationPreference).filter(
        NotificationPreference.owner_id == owner_id
    ).first()

    if not prefs:
        # Check if owner exists
        owner = db.query(Owner).filter(Owner.id == owner_id).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Owner not found")

        # Create default preferences
        prefs = NotificationPreference(
            owner_id=owner_id,
            email_enabled=True,
            push_enabled=True,
            monthly_reminder=True,
            expiry_3day_warning=True,
            expiry_final_day=True
        )
        db.add(prefs)
        db.commit()
        db.refresh(prefs)

    return prefs


@router.put("/preferences/{owner_id}", response_model=NotificationPreferenceResponse)
def update_notification_preferences(
    owner_id: str,
    update: NotificationPreferenceUpdate,
    db: Session = Depends(get_db)
):
    """Update notification preferences for an owner."""
    prefs = db.query(NotificationPreference).filter(
        NotificationPreference.owner_id == owner_id
    ).first()

    if not prefs:
        # Check if owner exists
        owner = db.query(Owner).filter(Owner.id == owner_id).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Owner not found")

        # Create with updates
        prefs = NotificationPreference(owner_id=owner_id)
        db.add(prefs)

    # Apply updates
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prefs, field, value)

    db.commit()
    db.refresh(prefs)
    return prefs


@router.get("/history/{owner_id}", response_model=List[NotificationHistoryResponse])
def get_notification_history(
    owner_id: str,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get notification history for an owner."""
    owner = db.query(Owner).filter(Owner.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    history = db.query(NotificationHistory).filter(
        NotificationHistory.owner_id == owner_id
    ).order_by(
        NotificationHistory.created_at.desc()
    ).limit(limit).all()

    return history


@router.get("/expiring", response_model=List[ExpiringBenefitInfo])
def get_expiring_benefits(
    owner_id: Optional[str] = None,
    days: int = 7,
    db: Session = Depends(get_db)
):
    """Get benefits expiring within the specified days."""
    service = NotificationService(db)
    expiring = service.get_expiring_benefits(
        owner_id=owner_id,
        days_threshold=days
    )
    return expiring


@router.post("/trigger", response_model=NotificationStatsResponse)
def trigger_notifications(
    request: NotificationTriggerRequest,
    db: Session = Depends(get_db)
):
    """
    Manually trigger notifications for testing.

    type can be: 'monthly_reminder' or 'expiry_check'
    """
    service = NotificationService(db)

    if request.type == "monthly_reminder":
        stats = service.send_monthly_reminders()
    elif request.type == "expiry_check":
        # Check both 3-day and final-day warnings
        stats_3day = service.send_expiry_warnings(days_threshold=3)
        stats_final = service.send_expiry_warnings(days_threshold=1)
        stats = {
            "sent": stats_3day["sent"] + stats_final["sent"],
            "skipped": stats_3day["skipped"] + stats_final["skipped"],
            "failed": stats_3day["failed"] + stats_final["failed"]
        }
    elif request.type == "3_day_warning":
        stats = service.send_expiry_warnings(days_threshold=3)
    elif request.type == "final_day":
        stats = service.send_expiry_warnings(days_threshold=1)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown notification type: {request.type}. "
                   f"Use 'monthly_reminder', 'expiry_check', '3_day_warning', or 'final_day'"
        )

    return stats


@router.post("/send/{owner_id}")
def send_notification_to_owner(
    owner_id: str,
    notification_type: str = "monthly_reminder",
    db: Session = Depends(get_db)
):
    """Send a notification to a specific owner."""
    owner = db.query(Owner).filter(Owner.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    if not owner.email:
        raise HTTPException(status_code=400, detail="Owner has no email address")

    service = NotificationService(db)

    if notification_type == "monthly_reminder":
        benefits_data = service.get_unused_benefits_for_owner(owner_id)
        has_benefits = bool(benefits_data.get("monthly")) or bool(benefits_data.get("yearly"))

        if not has_benefits:
            return {"success": False, "message": "No unused benefits to remind about"}

        # Generate AI insights
        from app.services.ai_service import ai_service
        ai_insights = None
        if ai_service.is_configured():
            try:
                ai_insights = ai_service.generate_email_insights(
                    benefits_data=benefits_data,
                    owner_name=owner.name
                )
            except Exception:
                pass

        from app.services.email_service import email_service
        success = email_service.send_monthly_reminder(
            to_email=owner.email,
            owner_name=owner.name,
            benefits_data=benefits_data,
            ai_insights=ai_insights
        )

        if success:
            return {"success": True, "message": f"Email sent to {owner.email}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send email")
    else:
        raise HTTPException(status_code=400, detail=f"Unknown notification type: {notification_type}")


@router.get("/status")
def get_notification_status(db: Session = Depends(get_db)):
    """Get notification system status."""
    from app.services.email_service import email_service

    # Count owners with email configured
    owners_with_email = db.query(Owner).filter(Owner.email != None).count()
    owners_enabled = db.query(Owner).filter(
        Owner.email != None,
        Owner.notifications_enabled == True
    ).count()

    # Recent notification stats
    from datetime import datetime, timedelta
    last_24h = datetime.utcnow() - timedelta(hours=24)
    recent_sent = db.query(NotificationHistory).filter(
        NotificationHistory.status == "sent",
        NotificationHistory.created_at >= last_24h
    ).count()
    recent_failed = db.query(NotificationHistory).filter(
        NotificationHistory.status == "failed",
        NotificationHistory.created_at >= last_24h
    ).count()

    return {
        "email_configured": email_service.is_configured(),
        "owners_with_email": owners_with_email,
        "owners_notifications_enabled": owners_enabled,
        "notifications_sent_24h": recent_sent,
        "notifications_failed_24h": recent_failed
    }
