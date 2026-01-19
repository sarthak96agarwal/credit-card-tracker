"""Scheduler for notification jobs using APScheduler."""
import os
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED

from app.database import SessionLocal
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = BackgroundScheduler()


def job_listener(event):
    """Log job execution events."""
    if event.exception:
        logger.error(f"Job {event.job_id} failed with exception: {event.exception}")
    else:
        logger.info(f"Job {event.job_id} executed successfully")


def monthly_reminder_job():
    """Job to send monthly reminder emails on the 15th."""
    logger.info("Running monthly reminder job...")
    db = SessionLocal()
    try:
        service = NotificationService(db)
        stats = service.send_monthly_reminders()
        logger.info(f"Monthly reminder stats: {stats}")
    except Exception as e:
        logger.error(f"Monthly reminder job failed: {e}")
    finally:
        db.close()


def expiry_check_job():
    """Job to check for expiring benefits and send warnings."""
    logger.info("Running expiry check job...")
    db = SessionLocal()
    try:
        service = NotificationService(db)

        # Check for benefits expiring in 3 days
        stats_3day = service.send_expiry_warnings(days_threshold=3)
        logger.info(f"3-day warning stats: {stats_3day}")

        # Check for benefits expiring today (final day)
        stats_final = service.send_expiry_warnings(days_threshold=1)
        logger.info(f"Final day warning stats: {stats_final}")

    except Exception as e:
        logger.error(f"Expiry check job failed: {e}")
    finally:
        db.close()


def start_scheduler():
    """Start the background scheduler with notification jobs."""
    # Get configuration from environment
    timezone = os.getenv("NOTIFICATION_TIMEZONE", "America/Los_Angeles")
    notification_hour = int(os.getenv("NOTIFICATION_HOUR", "9"))

    # Add job listener for logging
    scheduler.add_listener(job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)

    # Monthly reminder - runs on 15th of each month at configured hour
    scheduler.add_job(
        monthly_reminder_job,
        CronTrigger(day=15, hour=notification_hour, minute=0, timezone=timezone),
        id="monthly_reminder",
        name="Monthly Benefit Reminder",
        replace_existing=True
    )

    # Expiry check - runs daily at configured hour
    scheduler.add_job(
        expiry_check_job,
        CronTrigger(hour=notification_hour, minute=0, timezone=timezone),
        id="expiry_check",
        name="Expiry Check",
        replace_existing=True
    )

    scheduler.start()
    logger.info(f"Scheduler started with timezone={timezone}, hour={notification_hour}")
    logger.info(f"Jobs scheduled: {[job.id for job in scheduler.get_jobs()]}")


def shutdown_scheduler():
    """Shutdown the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")


def run_job_now(job_id: str):
    """Manually trigger a job for testing."""
    if job_id == "monthly_reminder":
        monthly_reminder_job()
    elif job_id == "expiry_check":
        expiry_check_job()
    else:
        raise ValueError(f"Unknown job: {job_id}")
