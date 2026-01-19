"""Pydantic schemas for notifications."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, time


class NotificationPreferenceBase(BaseModel):
    email_enabled: bool = True
    push_enabled: bool = True
    monthly_reminder: bool = True
    expiry_3day_warning: bool = True
    expiry_final_day: bool = True
    quiet_hours_start: Optional[time] = None
    quiet_hours_end: Optional[time] = None


class NotificationPreferenceUpdate(BaseModel):
    email_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    monthly_reminder: Optional[bool] = None
    expiry_3day_warning: Optional[bool] = None
    expiry_final_day: Optional[bool] = None
    quiet_hours_start: Optional[time] = None
    quiet_hours_end: Optional[time] = None


class NotificationPreferenceResponse(NotificationPreferenceBase):
    id: str
    owner_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NotificationHistoryResponse(BaseModel):
    id: str
    owner_id: str
    benefit_id: Optional[str]
    notification_type: str
    channel: str
    status: str
    scheduled_for: datetime
    sent_at: Optional[datetime]
    error_message: Optional[str]
    extra_data: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationTriggerRequest(BaseModel):
    type: str  # 'monthly_reminder' or 'expiry_check'
    owner_id: Optional[str] = None  # If None, send to all eligible owners


class NotificationStatsResponse(BaseModel):
    sent: int
    skipped: int
    failed: int


class ExpiringBenefitInfo(BaseModel):
    benefit_id: str
    name: str
    value: float
    remaining: float
    period: str
    days_remaining: int
    card_name: str
    card_color: str
    owner_id: str
    owner_name: str
