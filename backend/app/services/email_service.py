"""Email service using SendGrid for sending notifications."""
import os
import logging
from typing import List, Optional
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via SendGrid."""

    def __init__(self):
        self.api_key = os.getenv("SENDGRID_API_KEY")
        self.from_email = os.getenv("FROM_EMAIL", "noreply@cardtracker.com")
        self.from_name = os.getenv("FROM_NAME", "Card Benefits Tracker")
        self.client = SendGridAPIClient(self.api_key) if self.api_key else None

    def is_configured(self) -> bool:
        """Check if SendGrid is properly configured."""
        return self.api_key is not None

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        plain_content: Optional[str] = None
    ) -> bool:
        """
        Send an email via SendGrid.

        Returns True if email was sent successfully, False otherwise.
        """
        if not self.is_configured():
            logger.warning("SendGrid not configured. Email not sent.")
            return False

        try:
            message = Mail(
                from_email=Email(self.from_email, self.from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )

            if plain_content:
                message.add_content(Content("text/plain", plain_content))

            response = self.client.send(message)

            if response.status_code in (200, 201, 202):
                logger.info(f"Email sent successfully to {to_email}")
                return True
            else:
                logger.error(f"Failed to send email: {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Error sending email to {to_email}: {str(e)}")
            return False

    def _build_card_tile(self, card_data: dict) -> str:
        """Build HTML for a single card tile with its benefits."""
        card_name = card_data["card_name"]
        card_color = card_data.get("card_color", "#1f2937")
        benefits = card_data["benefits"]

        # Calculate total for this card
        card_total = sum(b["remaining"] for b in benefits)

        # Build benefits rows
        benefits_rows = ""
        for b in benefits:
            expiry = b.get("expiry_date", "")
            period_label = {
                "MONTHLY": "Monthly",
                "QUARTERLY": "Quarterly",
                "SEMI_ANNUAL": "Semi-Annual",
                "ANNUAL": "Annual"
            }.get(b["period"], b["period"])

            benefits_rows += f"""
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
                    <div style="font-weight: 500; color: #374151;">{b['name']}</div>
                    <div style="font-size: 12px; color: #9ca3af;">{period_label} · Expires {expiry}</div>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
                    <span style="font-weight: 600; color: #10b981;">${b['remaining']:.2f}</span>
                </td>
            </tr>
            """

        return f"""
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 16px;">
            <!-- Card Header -->
            <div style="background: {card_color}; padding: 16px; display: flex; align-items: center;">
                <div style="flex: 1;">
                    <h3 style="margin: 0; color: white; font-size: 16px; font-weight: 600;">{card_name}</h3>
                    <p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.8); font-size: 13px;">{len(benefits)} benefit{'s' if len(benefits) != 1 else ''} · ${card_total:.2f} remaining</p>
                </div>
            </div>
            <!-- Benefits List -->
            <div style="padding: 16px;">
                <table style="width: 100%; border-collapse: collapse;">
                    {benefits_rows}
                </table>
            </div>
        </div>
        """

    def send_monthly_reminder(
        self,
        to_email: str,
        owner_name: str,
        benefits_data: dict
    ) -> bool:
        """Send monthly reminder email with pending benefits grouped by card."""
        monthly_cards = benefits_data.get("monthly", [])
        yearly_cards = benefits_data.get("yearly", [])

        # Count totals
        monthly_count = sum(len(c["benefits"]) for c in monthly_cards)
        yearly_count = sum(len(c["benefits"]) for c in yearly_cards)
        total_count = monthly_count + yearly_count

        monthly_value = sum(
            sum(b["remaining"] for b in c["benefits"])
            for c in monthly_cards
        )
        yearly_value = sum(
            sum(b["remaining"] for b in c["benefits"])
            for c in yearly_cards
        )
        total_value = monthly_value + yearly_value

        subject = f"Benefits Reminder: ${total_value:.0f} waiting to be used"

        # Build monthly section
        monthly_section = ""
        if monthly_cards:
            monthly_tiles = "".join(self._build_card_tile(c) for c in monthly_cards)
            monthly_section = f"""
            <div style="margin-bottom: 32px;">
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                    <div style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                        EXPIRING THIS MONTH
                    </div>
                    <div style="margin-left: 12px; color: #6b7280; font-size: 14px;">
                        {monthly_count} benefit{'s' if monthly_count != 1 else ''} · ${monthly_value:.2f}
                    </div>
                </div>
                {monthly_tiles}
            </div>
            """

        # Build yearly section
        yearly_section = ""
        if yearly_cards:
            yearly_tiles = "".join(self._build_card_tile(c) for c in yearly_cards)
            yearly_section = f"""
            <div>
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                    <div style="background: #8b5cf6; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                        REMAINING THIS YEAR
                    </div>
                    <div style="margin-left: 12px; color: #6b7280; font-size: 14px;">
                        {yearly_count} benefit{'s' if yearly_count != 1 else ''} · ${yearly_value:.2f}
                    </div>
                </div>
                {yearly_tiles}
            </div>
            """

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #1e1b4b, #312e81); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
                    <h1 style="color: white; margin: 0 0 8px 0; font-size: 28px;">Benefits Reminder</h1>
                    <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 16px;">
                        Hi {owner_name}, you have <strong style="color: #34d399;">${total_value:.2f}</strong> in unused benefits
                    </p>
                </div>

                <!-- Summary Stats -->
                <div style="display: flex; gap: 12px; margin-bottom: 24px;">
                    <div style="flex: 1; background: white; border-radius: 12px; padding: 16px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: #ef4444;">{monthly_count}</div>
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Monthly</div>
                    </div>
                    <div style="flex: 1; background: white; border-radius: 12px; padding: 16px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: #8b5cf6;">{yearly_count}</div>
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Yearly</div>
                    </div>
                    <div style="flex: 1; background: white; border-radius: 12px; padding: 16px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: #10b981;">${total_value:.0f}</div>
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Total</div>
                    </div>
                </div>

                <!-- Benefits by Section -->
                {monthly_section}
                {yearly_section}

                <!-- Footer -->
                <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px;">
                    <p style="margin: 0;">Don't let your benefits go to waste!</p>
                    <p style="margin: 8px 0 0 0;">Card Benefits Tracker</p>
                </div>
            </div>
        </body>
        </html>
        """

        return self.send_email(to_email, subject, html_content)

    def send_expiry_warning(
        self,
        to_email: str,
        owner_name: str,
        benefits: List[dict],
        days_remaining: int
    ) -> bool:
        """Send expiry warning email for benefits about to expire."""
        urgency = "FINAL DAY" if days_remaining <= 1 else f"{days_remaining} DAYS LEFT"
        subject = f"[{urgency}] {len(benefits)} benefits expiring soon!"

        # Build benefits list HTML
        benefits_html = ""
        total_value = 0
        for b in benefits:
            remaining = b.get("remaining", b.get("value", 0))
            total_value += remaining
            benefits_html += f"""
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">
                    <strong>{b['name']}</strong><br>
                    <span style="color: #666; font-size: 14px;">{b['card_name']}</span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
                    <strong style="color: #ef4444;">${remaining:.2f}</strong>
                </td>
            </tr>
            """

        urgency_color = "#ef4444" if days_remaining <= 1 else "#f59e0b"
        urgency_text = "TODAY!" if days_remaining <= 1 else f"in {days_remaining} days"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background: {urgency_color}; padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">Benefits Expiring {urgency_text}</h1>
                </div>

                <div style="padding: 30px;">
                    <p style="font-size: 16px; color: #374151;">Hi {owner_name},</p>

                    <p style="font-size: 16px; color: #374151;">
                        <strong style="color: {urgency_color};">Urgent:</strong> You have
                        <strong>{len(benefits)} benefits</strong> worth
                        <strong style="color: {urgency_color};">${total_value:.2f}</strong> expiring {urgency_text}!
                    </p>

                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <thead>
                            <tr style="background: #fef2f2;">
                                <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Benefit</th>
                                <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280;">Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {benefits_html}
                        </tbody>
                    </table>

                    <div style="background: #fef2f2; border-left: 4px solid {urgency_color}; padding: 15px; margin: 20px 0;">
                        <p style="color: #991b1b; margin: 0; font-weight: 600;">
                            Act now! These benefits will expire {urgency_text} and cannot be recovered.
                        </p>
                    </div>
                </div>

                <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                        Card Benefits Tracker
                    </p>
                </div>
            </div>
        </body>
        </html>
        """

        return self.send_email(to_email, subject, html_content)


# Singleton instance
email_service = EmailService()
