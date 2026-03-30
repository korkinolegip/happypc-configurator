"""Async email service for HappyPC verification emails."""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)


async def get_smtp_config(db: AsyncSession | None = None) -> dict:
    """Get SMTP config from app_settings DB, fallback to .env."""
    db_vals: dict[str, str] = {}
    if db:
        from app.models.settings import AppSettings
        result = await db.execute(
            select(AppSettings).where(AppSettings.key.like("smtp_%"))
        )
        db_vals = {s.key: s.value for s in result.scalars().all()}

    return {
        "host": db_vals.get("smtp_host") or settings.SMTP_HOST,
        "port": int(db_vals.get("smtp_port") or settings.SMTP_PORT or 465),
        "user": db_vals.get("smtp_user") or settings.SMTP_USER,
        "password": db_vals.get("smtp_password") or settings.SMTP_PASSWORD,
        "from_email": db_vals.get("smtp_from_email") or settings.SMTP_FROM_EMAIL,
        "from_name": db_vals.get("smtp_from_name") or settings.SMTP_FROM_NAME or "HappyPC",
    }


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


async def _send_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str,
    smtp_cfg: dict | None = None,
) -> bool:
    """Low-level send via SMTP. Returns True on success."""
    try:
        cfg = smtp_cfg or await get_smtp_config()
        if not all([cfg["host"], cfg["user"], cfg["password"]]):
            logger.warning("SMTP not configured, skipping email to %s", to_email)
            return False

        message = MIMEMultipart("alternative")
        message["From"] = f"{cfg['from_name']} <{cfg['from_email']}>"
        message["To"] = to_email
        message["Subject"] = subject
        message.attach(MIMEText(text_body, "plain", "utf-8"))
        message.attach(MIMEText(html_body, "html", "utf-8"))

        await aiosmtplib.send(
            message,
            hostname=cfg["host"],
            port=cfg["port"],
            username=cfg["user"],
            password=cfg["password"],
            use_tls=True,
        )
        logger.info("Email sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
        return False


async def send_verification_email(
    to_email: str, code: str, user_name: str, smtp_cfg: dict | None = None,
) -> bool:
    """Send email verification code. Returns True on success, False on failure."""
    subject = f"Подтверждение email — HappyPC (код: {code})"
    text_body = (
        f"Привет, {user_name}!\n\n"
        f"Ваш код подтверждения email на HappyPC: {code}\n\n"
        f"Код действителен в течение 24 часов.\n"
        f"Если вы не регистрировались, проигнорируйте это письмо."
    )
    html_body = _build_verification_html(code, user_name)
    return await _send_email(to_email, subject, html_body, text_body, smtp_cfg)


async def send_test_email(to_email: str, smtp_cfg: dict | None = None) -> bool:
    """Send a test email to verify SMTP configuration."""
    subject = "Тестовое письмо — HappyPC"
    from_name = (smtp_cfg or {}).get("from_name", "HappyPC")
    text_body = f"Это тестовое письмо от {from_name}. Если вы его видите — SMTP настроен корректно."
    html_body = f"""\
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#1a1a2e;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0"
             style="background-color:#16213e;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.3);">
        <tr><td style="background:linear-gradient(135deg,#FF6B00,#FF8C33);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">HappyPC</h1>
        </td></tr>
        <tr><td style="padding:40px;text-align:center;">
          <p style="color:#4CAF50;font-size:20px;font-weight:600;margin:0 0 16px;">SMTP работает!</p>
          <p style="color:#b0b0b0;font-size:14px;margin:0;">
            Это тестовое письмо. Если вы его видите — почта настроена корректно.
          </p>
        </td></tr>
        <tr><td style="background-color:#0f3460;padding:16px 40px;text-align:center;border-top:1px solid #1a1a4e;">
          <p style="margin:0;color:#606080;font-size:12px;">&copy; {from_name}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    return await _send_email(to_email, subject, html_body, text_body, smtp_cfg)
