from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationFailedError
from app.models.system import ContactMessage
from app.repositories import misc_repo
from app.schemas.system import ContactCreate, ContactUpdate
from app.services import email as email_service


async def submit(
    db: AsyncSession, payload: ContactCreate, source_ip: str | None = None
) -> ContactMessage:
    if payload.website:
        # Honeypot tripped -- almost certainly a bot.
        raise ValidationFailedError("Your message could not be sent.")

    message = ContactMessage(
        name=payload.name.strip(),
        email=str(payload.email).strip().lower(),
        subject=payload.subject.strip(),
        message=payload.message.strip(),
        source_ip=source_ip,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    subject, body = email_service.contact_confirmation_email(message.name, message.subject)
    await email_service.send_email(message.email, subject, body)
    return message


async def update_message(
    db: AsyncSession, message_id: uuid.UUID, payload: ContactUpdate
) -> ContactMessage:
    message = await misc_repo.get_contact_message(db, message_id)
    if message is None:
        raise NotFoundError("Message not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(message, field, value)
    await db.commit()
    await db.refresh(message)
    return message


async def delete_message(db: AsyncSession, message_id: uuid.UUID) -> None:
    message = await misc_repo.get_contact_message(db, message_id)
    if message is None:
        raise NotFoundError("Message not found.")
    await db.delete(message)
    await db.commit()
