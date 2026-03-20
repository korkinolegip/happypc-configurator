"""
Role-based permissions system.
Stored as key-value pairs per role in DB.
Defaults applied if not set.
"""
from sqlalchemy import Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    permission: Mapped[str] = mapped_column(String(64), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# All available permissions with defaults per role
DEFAULT_PERMISSIONS = {
    "can_create_builds":    {"user": True,  "master": True,  "admin": True, "superadmin": True},
    "can_see_labor":        {"user": False, "master": True,  "admin": True, "superadmin": True},
    "can_see_turnkey":      {"user": False, "master": True,  "admin": True, "superadmin": True},
    "can_set_turnkey_price":{"user": False, "master": True,  "admin": True, "superadmin": True},
    "can_set_os":           {"user": False, "master": True,  "admin": True, "superadmin": True},
    "can_set_color":        {"user": True,  "master": True,  "admin": True, "superadmin": True},
    "can_print":            {"user": True,  "master": True,  "admin": True, "superadmin": True},
    "can_download_pdf":     {"user": True,  "master": True,  "admin": True, "superadmin": True},
    "can_copy_build":       {"user": True,  "master": True,  "admin": True, "superadmin": True},
    "can_comment":          {"user": True,  "master": True,  "admin": True, "superadmin": True},
    "can_like":             {"user": True,  "master": True,  "admin": True, "superadmin": True},
}

PERMISSION_LABELS = {
    "can_create_builds":    "Создание сборок",
    "can_see_labor":        "Видеть стоимость работы",
    "can_see_turnkey":      "Видеть цену «под ключ»",
    "can_set_turnkey_price":"Устанавливать фикс. цену",
    "can_set_os":           "Установка Windows (toggle)",
    "can_set_color":        "Выбор цвета корпуса",
    "can_print":            "Печать сборки",
    "can_download_pdf":     "Скачивание PDF",
    "can_copy_build":       "Копирование сборки",
    "can_comment":          "Комментарии",
    "can_like":             "Лайки",
}
