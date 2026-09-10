"""Media storage abstraction.

Binaries live in object storage; Postgres only keeps the pointer + metadata
(see `MediaAsset`). The local adapter is a development convenience only.
"""

from __future__ import annotations

import mimetypes
import uuid
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app.core.config import settings
from app.core.errors import ValidationFailedError

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/svg+xml",
    "application/pdf",
}
LOCAL_UPLOAD_DIR = Path("uploads")


@dataclass(slots=True)
class StoredFile:
    key: str
    url: str
    content_type: str
    size: int


class StorageBackend(Protocol):
    async def save(self, filename: str, data: bytes, content_type: str) -> StoredFile: ...
    async def delete(self, key: str) -> None: ...


def validate_upload(filename: str, data: bytes, content_type: str) -> None:
    if not filename:
        raise ValidationFailedError("A file name is required.")
    if len(data) == 0:
        raise ValidationFailedError("The uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValidationFailedError("Files must be 10 MB or smaller.")
    guessed = content_type or mimetypes.guess_type(filename)[0] or ""
    if guessed not in ALLOWED_CONTENT_TYPES:
        raise ValidationFailedError(
            "Unsupported file type. Allowed: JPEG, PNG, WebP, AVIF, SVG, PDF."
        )


def _build_key(filename: str) -> str:
    suffix = Path(filename).suffix.lower()[:10]
    return f"media/{uuid.uuid4().hex}{suffix}"


class LocalStorage:
    def __init__(self, root: Path = LOCAL_UPLOAD_DIR) -> None:
        self.root = root

    async def save(self, filename: str, data: bytes, content_type: str) -> StoredFile:
        validate_upload(filename, data, content_type)
        key = _build_key(filename)
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        base = settings.storage_public_base_url or "/media"
        return StoredFile(
            key=key,
            url=f"{base.rstrip('/')}/{key.split('/', 1)[1]}",
            content_type=content_type,
            size=len(data),
        )

    async def delete(self, key: str) -> None:
        path = self.root / key
        if path.is_file():
            path.unlink()


class S3Storage:
    """S3-compatible adapter.

    Intentionally dependency-free until credentials exist: it validates and
    reports configuration state so the rest of the app can be written against
    the final interface today.
    """

    def __init__(self) -> None:
        self.configured = bool(
            settings.storage_bucket
            and settings.storage_access_key
            and settings.storage_secret_key
        )

    async def save(self, filename: str, data: bytes, content_type: str) -> StoredFile:
        validate_upload(filename, data, content_type)
        if not self.configured:
            raise ValidationFailedError("Object storage is not configured.")
        raise NotImplementedError(
            "Install boto3 and implement put_object here when S3 is provisioned."
        )

    async def delete(self, key: str) -> None:
        if not self.configured:
            return
        raise NotImplementedError


@lru_cache
def get_storage() -> StorageBackend:
    if settings.storage_provider == "s3":
        return S3Storage()
    return LocalStorage()
