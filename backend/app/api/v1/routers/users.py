from __future__ import annotations

from fastapi import APIRouter, File, UploadFile, status

from app.core.deps import CurrentUser, DbSession, StaffUser
from app.models.system import MediaAsset
from app.schemas.auth import UserRead, UserUpdate
from app.services.storage import get_storage

router = APIRouter(tags=["Users"])


@router.get("/users/me", response_model=UserRead)
async def read_profile(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)


@router.put("/users/me", response_model=UserRead)
async def update_profile(
    payload: UserUpdate, user: CurrentUser, db: DbSession
) -> UserRead:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.post("/media", status_code=status.HTTP_201_CREATED, tags=["Admin"])
async def upload_media(
    db: DbSession, _: StaffUser, file: UploadFile = File(...)
) -> dict[str, str | int]:
    """Store a file in object storage and record only its pointer in Postgres."""
    data = await file.read()
    stored = await get_storage().save(
        file.filename or "upload", data, file.content_type or ""
    )
    asset = MediaAsset(
        file_key=stored.key,
        url=stored.url,
        file_type=stored.content_type,
        file_size=stored.size,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return {"id": str(asset.id), "url": asset.url, "size": asset.file_size}
