import os
import uuid

import aiofiles
from fastapi import APIRouter, Depends, File, Form, Header, UploadFile, status
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.bug_report import BugReport

router = APIRouter()

UPLOAD_DIR = "/app/uploads/bugs"
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_SIZE = 5 * 1024 * 1024


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_bug_report(
    description: str = Form(...),
    page_url: str | None = Form(None),
    user_agent: str | None = Form(None),
    reporter_name: str | None = Form(None),
    screenshot: UploadFile | None = File(None),
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Submit a bug report. Auth is optional — if token present, links to user."""
    reporter_id = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            reporter_id = uuid.UUID(payload["sub"])
        except Exception:
            pass

    screenshot_url = None
    if screenshot and screenshot.filename:
        ext = os.path.splitext(screenshot.filename)[1].lower()
        if ext in ALLOWED_EXT:
            content = await screenshot.read()
            if len(content) <= MAX_SIZE:
                os.makedirs(UPLOAD_DIR, exist_ok=True)
                filename = f"{uuid.uuid4()}{ext}"
                async with aiofiles.open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
                    await f.write(content)
                screenshot_url = f"/uploads/bugs/{filename}"

    report = BugReport(
        description=description.strip(),
        screenshot_url=screenshot_url,
        page_url=page_url,
        user_agent=user_agent,
        reporter_name=reporter_name,
        reporter_id=reporter_id,
    )
    db.add(report)
    await db.flush()

    # Telegram notification
    try:
        from app.api.admin import _notify_bug_telegram
        await _notify_bug_telegram(db, report)
    except Exception:
        pass

    return {"id": str(report.id), "message": "Спасибо! Баг-репорт отправлен."}
