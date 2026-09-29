"""Give every course a presentable author byline.

A database seeded from this repo credits its courses to "Demo Instructor",
headline "Course author - demo account", which is what the seed script creates.
That name and headline are rendered on every public course page, next to the
avatar in the hero.

This renames that account's display fields to a neutral platform byline and
points any course currently credited to the admin account at the same one, so
the catalogue reads consistently. It changes display fields only:

  * no email, role, password or is_active is touched
  * no row is created or deleted
  * only courses are repointed -- article authorship is left exactly as it is

Run with --name and --headline to use something other than the defaults, for
instance a real author once one exists.

Usage:

    DATABASE_URL="postgresql+asyncpg://..." python -m scripts.fix_course_bylines --dry-run
    DATABASE_URL="postgresql+asyncpg://..." python -m scripts.fix_course_bylines \\
        --name "Inferacloud" --headline "Course team"
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import func, select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.catalog import Course
from app.models.user import User

BYLINE_ACCOUNT = "instructor@example.com"
DEFAULT_NAME = "Inferacloud"
DEFAULT_HEADLINE = "Course team"
DEFAULT_BIO = (
    "Courses on this platform are written and maintained by the Inferacloud "
    "course team."
)


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--name", default=DEFAULT_NAME)
    parser.add_argument("--headline", default=DEFAULT_HEADLINE)
    parser.add_argument("--bio", default=DEFAULT_BIO)
    args = parser.parse_args()

    async with SessionLocal() as db:
        byline = await db.scalar(
            select(User).where(func.lower(User.email) == BYLINE_ACCOUNT)
        )
        if byline is None:
            raise SystemExit(
                f"{BYLINE_ACCOUNT} is not in this database; nothing to rename."
            )

        print(f"  byline account: {byline.email}")
        print(f"    name    : {byline.name!r} -> {args.name!r}")
        print(f"    headline: {byline.headline!r} -> {args.headline!r}")
        byline.name = args.name
        byline.headline = args.headline
        byline.bio = args.bio

        # Anything credited to the admin account is credited that way because
        # no better account existed when it was created, not by choice.
        admin_email = (settings.seed_admin_email or "").lower()
        admin = await db.scalar(select(User).where(func.lower(User.email) == admin_email))
        repointed = 0
        if admin is not None and admin.id != byline.id:
            courses = (
                await db.scalars(select(Course).where(Course.instructor_id == admin.id))
            ).all()
            for course in courses:
                print(f"    repointing {course.slug!r} from {admin.email} to the byline account")
                course.instructor_id = byline.id
                repointed += 1

        total = await db.scalar(
            select(func.count()).select_from(Course).where(Course.instructor_id == byline.id)
        )
        print(f"\n  courses that will carry this byline: {total}")

        if args.dry_run:
            await db.rollback()
            print(f"  DRY RUN -- rolled back ({repointed} course(s) would be repointed)")
        else:
            await db.commit()
            print(f"  committed ({repointed} course(s) repointed)")


if __name__ == "__main__":
    asyncio.run(main())
