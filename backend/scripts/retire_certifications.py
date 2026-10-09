"""Take every certification except the two Google Cloud ones off a live catalogue.

`database/seed/certifications.json` now carries only Cloud Digital Leader and
Generative AI Leader, and the seeder deletes anything it no longer lists. That
is right for a development database and wrong for this one: the full seeder
must never run against production, so this script deals with the rows that are
already there.

It unpublishes rather than deletes. `is_published` gates the listing, the
detail page, featured, related, deals, search, the sitemap and the provider
pages, so unpublishing removes a certification from the public site
completely, while leaving the row -- and anything attached to it -- intact.
Deleting would cascade into saved items and challenge questions, and there is
no reason to take that risk for an outcome nobody can see the difference in.

Certifications are matched by exact slug against the keep list below, so
anything an admin has added since is reported before it is touched. A
certification somebody has saved, sat a challenge paper for, or booked is
reported too: nothing is destroyed either way, but a learner losing sight of
an exam they saved is worth knowing about.

Usage:

    DATABASE_URL="postgresql+asyncpg://..." python -m scripts.retire_certifications --dry-run
    DATABASE_URL="postgresql+asyncpg://..." python -m scripts.retire_certifications

    # or, against the managed database:
    bash deploy/azure/containerapps/run-script.sh retire_certifications --dry-run
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.campaign import ChallengeAttempt, ChallengeQuestion
from app.models.certification import Certification, CertificationProvider
from app.models.commerce import Payment
from app.models.engagement import SavedCertification
from app.models.scheduling import ExamBooking

# The only two that stay published. Anything else is retired; anything not
# already in the database is simply reported as absent.
KEEP_SLUGS = (
    "cloud-digital-leader",
    "generative-ai-leader",
)


async def _attachments(db, certification: Certification) -> dict[str, int]:
    """Anything a person has done with this certification."""
    counts = {}
    for label, model in (
        ("saved by", SavedCertification),
        ("challenge questions", ChallengeQuestion),
        ("challenge attempts", ChallengeAttempt),
        ("exam bookings", ExamBooking),
        ("payments", Payment),
    ):
        counts[label] = await db.scalar(
            select(func.count())
            .select_from(model)
            .where(model.certification_id == certification.id)
        )
    return counts


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    async with SessionLocal() as db:
        certifications = (
            await db.scalars(select(Certification).order_by(Certification.slug))
        ).all()

        for slug in KEEP_SLUGS:
            if not any(row.slug == slug for row in certifications):
                print(f"  WARNING: {slug} is not in this database")

        retired = 0
        for certification in certifications:
            if certification.slug in KEEP_SLUGS:
                print(f"  {certification.slug}: keeping")
                continue
            if not certification.is_published:
                print(f"  {certification.slug}: already unpublished")
                continue

            counts = await _attachments(db, certification)
            busy = {k: v for k, v in counts.items() if v}
            if busy:
                detail = ", ".join(f"{v} {k}" for k, v in busy.items())
                print(f"  {certification.slug}: retiring -- NOTE it has {detail}")
            else:
                print(f"  {certification.slug}: retiring (nothing attached)")

            certification.is_published = False
            retired += 1

        # Push the retirements down before anything counts them. The session
        # does not autoflush, so without this the provider check below reads
        # the pre-change catalogue, finds every provider still has published
        # exams, and quietly retires none of them.
        await db.flush()

        # A provider with nothing left to show is a dead end: its page would
        # list no exams and it would still sit in the provider filter.
        providers = (
            await db.scalars(
                select(CertificationProvider).order_by(CertificationProvider.slug)
            )
        ).all()
        emptied = 0
        for provider in providers:
            live = await db.scalar(
                select(func.count())
                .select_from(Certification)
                .where(
                    Certification.provider_id == provider.id,
                    Certification.is_published.is_(True),
                )
            )
            if live or not provider.is_published:
                continue
            print(f"  provider {provider.slug}: retiring, nothing published left")
            provider.is_published = False
            emptied += 1

        await db.flush()
        remaining = (
            await db.scalars(
                select(Certification)
                .where(Certification.is_published.is_(True))
                .order_by(Certification.name)
            )
        ).all()
        print("\n  published certifications after this change:")
        for certification in remaining:
            print(f"    - {certification.slug}")

        if args.dry_run:
            await db.rollback()
            print(
                f"\n  DRY RUN -- rolled back, {retired} certification(s) and "
                f"{emptied} provider(s) would be retired"
            )
        else:
            await db.commit()
            print(
                f"\n  committed, {retired} certification(s) and "
                f"{emptied} provider(s) retired"
            )


if __name__ == "__main__":
    asyncio.run(main())
