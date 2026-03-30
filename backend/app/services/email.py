"""Async email service for HappyPC verification emails."""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


def _build_verification_html(code: str, user_name: str) -> str:
    """Build HappyPC-branded HTML email with verification code."""
    return f"""\
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#1a1a2e;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0"
               style="background-color:#16213e;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.3);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#FF6B00,#FF8C33);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px;">
                HappyPC
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">
                Конфигуратор сборок
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#e0e0e0;font-size:16px;line-height:1.6;">
                Привет, <strong style="color:#FF6B00;">{user_name}</strong>!
              </p>
              <p style="margin:0 0 24px;color:#b0b0b0;font-size:15px;line-height:1.6;">
                Для подтверждения вашего email-адреса введите код:
              </p>
              <!-- Code block -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:16px 0;">
                    <div style="display:inline-block;background-color:#0f3460;border:2px solid #FF6B00;border-radius:12px;padding:20px 48px;">
                      <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#FF6B00;font-family:'Courier New',monospace;">
                        {code}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#808080;font-size:13px;line-height:1.5;text-align:center;">
                Код действителен в течение 24 часов.<br>
                Если вы не регистрировались на HappyPC, проигнорируйте это письмо.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#0f3460;padding:20px 40px;text-align:center;border-top:1px solid #1a1a4e;">
              <p style="margin:0;color:#606080;font-size:12px;">
                &copy; HappyPC &mdash; профессиональная сборка компьютеров
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


async def send_verification_email(to_email: str, code: str, user_name: str) -> bool:
    """
    Send email verification code via SMTP.

    Returns True on success, False on failure (never raises).
    """
    try:
        smtp_host = settings.SMTP_HOST
        smtp_port = settings.SMTP_PORT
        smtp_user = settings.SMTP_USER
        smtp_password = settings.SMTP_PASSWORD
        from_email = settings.SMTP_FROM_EMAIL
        from_name = settings.SMTP_FROM_NAME

        if not all([smtp_host, smtp_user, smtp_password]):
            logger.warning("SMTP not configured, skipping verification email")
            return False

        message = MIMEMultipart("alternative")
        message["From"] = f"{from_name} <{from_email}>"
        message["To"] = to_email
        message["Subject"] = f"Подтверждение email — HappyPC (код: {code})"

        # Plain text fallback
        text_body = (
            f"Привет, {user_name}!\n\n"
            f"Ваш код подтверждения email на HappyPC: {code}\n\n"
            f"Код действителен в течение 24 часов.\n"
            f"Если вы не регистрировались, проигнорируйте это письмо."
        )
        message.attach(MIMEText(text_body, "plain", "utf-8"))

        # HTML body
        html_body = _build_verification_html(code, user_name)
        message.attach(MIMEText(html_body, "html", "utf-8"))

        # Yandex SMTP uses SSL on port 465
        await aiosmtplib.send(
            message,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_password,
            use_tls=True,  # SSL for port 465
        )
        logger.info(f"Verification email sent to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send verification email to {to_email}: {e}")
        return False
