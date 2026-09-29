"""Disable seeded demo accounts on a live database.

`app.seed.run` creates instructor@example.com / Instructor123! and
student@example.com / Student123!. Those passwords are published in this
repository's README and seed script, and the instructor account carries the
`instructor` role, which is staff: it can read the admin course endpoints and
create courses.

Any database seeded from this repo, or migrated from one that was, has them.

This deactivates them and replaces their password hash with a random value, so
reactivating one does not restore a known credential. `is_active` is checked
both at login and on every authenticated request, so existing sessions die too.

It deliberately does NOT delete them: `courses.instructor_id` and
`articles.author_id` point at these rows, and deleting would null those out and
change pages that are currently correct.

The configured seed admin (SEED_ADMIN_EMAIL) is never touched -- deactivating
it could lock the operator out of their own Admin console.

Usage:

    DATABASE_URL="postgresql+asyncpg://..." python -m scripts.disable_demo_accounts --dry-run
    DATABASE_URL="postgresql+asyncpg://..." python -m scripts.disable_demo_accounts
"""

from __future__ import annotations

import argparse
import asyncio
import secrets

from sqlalchemy import func, select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.catalog import Course
from app.models.content import Article
from app.models.user import User

# Accounts the seed script creates with passwords published in the repository.
DEMO_EMAILS = ("instructor@example.com", "student@example.com")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    protected = (settings.seed_admin_email or "").lower()

    async with SessionLocal() as db:
        changed = 0

        for email in DEMO_EMAILS:
            if email == protected:
                print(f"  {email}: is the configured admin account, leaving alone")
                continue

            user = await db.scalar(select(User).where(func.lower(User.email) == email))
            if user is None:
                print(f"  {email}: not present")
                continue

            courses = await db.scalar(
                select(func.count()).select_from(Course).where(Course.instructor_id == user.id)
            )
            articles = await db.scalar(
                select(func.count()).select_from(Article).where(Article.author_id == user.id)
            )

            if not user.is_active:
                print(f"  {email}: already disabled (role={user.role})")
                continue

            print(
                f"  {email}: role={user.role}, active={user.is_active}, "
                f"authors {courses} course(s) and {articles} article(s) -- disabling"
            )
            user.is_active = False
            # A random, unknowable password, so reactivating does not restore
            # the published one.
            user.hashed_password = hash_password(secrets.token_urlsafe(32))
            changed += 1

        # Report any other account still holding a published password, without
        # changing it -- that is a decision for whoever owns the account.
        others = (
            await db.scalars(
                select(User).where(
                    func.lower(User.email).like("%@example.com"),
                    User.is_active.is_(True),
                )
            )
        ).all()
        remaining = [u.email for u in others if u.email.lower() not in DEMO_EMAILS]
        if remaining:
            print(f"\n  still active with an example.com address: {', '.join(remaining)}")
            print("  (left alone; the configured admin is expected here)")

        if args.dry_run:
            await db.rollback()
            print(f"\n  DRY RUN -- rolled back, {changed} account(s) would change")
        else:
            await db.commit()
            print(f"\n  committed, {changed} account(s) disabled")


if __name__ == "__main__":
    asyncio.run(main())
