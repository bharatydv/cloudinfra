"""Take the seeded demo courses off a live catalogue.

`database/seed/courses.json` used to carry six placeholder courses --
Cloud Computing Fundamentals and friends -- each with three thin modules. They
were scaffolding for building the site, not teaching material, and they sit in
the catalogue beside the two real courses as if they were equals.

That file is now empty, so a fresh seed never creates them again. This script
deals with the databases that already have them.

It unpublishes rather than deletes. `is_published` gates the listing, the
detail page, featured, related, deals, search and the category counts, so
unpublishing removes them from the public site completely, while leaving the
rows recoverable if one of them turns out to be wanted after all.

Courses are matched by exact slug against the list below, so nothing an admin
has written since can be caught by it. A course that has enrollments,
reviews, certificates or payments is reported before the change -- the change
is safe either way, because nothing is destroyed, but an enrolled student
losing sight of their course is worth knowing about.

Usage:

    DATABASE_URL="postgresql+asyncpg://..." python -m scripts.unpublish_demo_courses --dry-run
    DATABASE_URL="postgresql+asyncpg://..." python -m scripts.unpublish_demo_courses

    # or, against the managed database:
    bash deploy/azure/containerapps/run-script.sh unpublish_demo_courses --dry-run
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.catalog import Course, CourseModule, Lesson
from app.models.commerce import Payment
from app.models.engagement import Certificate, CourseReview, Enrollment, LessonProgress
from app.models.user import User

# The six placeholder courses, by exact slug. Anything not on this list is
# never touched.
DEMO_SLUGS = (
    "cloud-computing-fundamentals",
    "introduction-to-artificial-intelligence",
    "machine-learning-fundamentals",
    "data-science-fundamentals",
    "devops-fundamentals",
    "digital-marketing-fundamentals",
)


async def _attachments(db, course: Course) -> dict[str, int]:
    """Anything a person has done with this course."""
    counts = {}
    for label, model in (
        ("enrollments", Enrollment),
        ("reviews", CourseReview),
        ("certificates", Certificate),
        ("payments", Payment),
    ):
        counts[label] = await db.scalar(
            select(func.count()).select_from(model).where(model.course_id == course.id)
        )
    return counts


async def _lessons_started(db, course: Course) -> int:
    """How much of the course anyone has actually worked through."""
    return await db.scalar(
        select(func.count())
        .select_from(LessonProgress)
        .join(Lesson, Lesson.id == LessonProgress.lesson_id)
        .join(CourseModule, CourseModule.id == Lesson.module_id)
        .where(CourseModule.course_id == course.id)
    )


async def _enrolled_emails(db, course: Course, limit: int = 10) -> list[str]:
    rows = await db.scalars(
        select(User.email)
        .join(Enrollment, Enrollment.user_id == User.id)
        .where(Enrollment.course_id == course.id)
        .order_by(User.email)
        .limit(limit)
    )
    return list(rows)


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    async with SessionLocal() as db:
        changed = 0
        attached = 0

        for slug in DEMO_SLUGS:
            course = await db.scalar(select(Course).where(Course.slug == slug))
            if course is None:
                print(f"  {slug}: not present")
                continue
            if not course.is_published:
                print(f"  {slug}: already unpublished")
                continue

            counts = await _attachments(db, course)
            busy = {k: v for k, v in counts.items() if v}
            if busy:
                attached += 1
                detail = ", ".join(f"{v} {k}" for k, v in busy.items())
                print(f"  {slug}: unpublishing -- NOTE it has {detail}")
                # Who, specifically. An unpublished course 404s for everyone
                # but an admin, so whoever is enrolled loses access to it, and
                # that is a decision the operator should make with names in
                # front of them rather than a count.
                done = await _lessons_started(db, course)
                for email in await _enrolled_emails(db, course):
                    print(f"      enrolled: {email}")
                print(f"      lessons with recorded progress: {done}")
            else:
                print(f"  {slug}: unpublishing (nothing attached)")

            course.is_published = False
            changed += 1

        # What the catalogue will show afterwards, so the result is visible
        # here rather than only on the site. The session is not autoflushing,
        # so the pending changes have to be pushed down first or this reads
        # back the old state -- and a dry run would print a reassuring list
        # that bears no relation to what it just decided.
        await db.flush()
        remaining = (
            await db.scalars(
                select(Course).where(Course.is_published.is_(True)).order_by(Course.title)
            )
        ).all()
        print("\n  published courses after this change:")
        for course in remaining:
            print(f"    - {course.slug}")

        if attached:
            print(f"\n  {attached} course(s) had student activity -- nothing was deleted")

        if args.dry_run:
            await db.rollback()
            print(f"\n  DRY RUN -- rolled back, {changed} course(s) would be unpublished")
        else:
            await db.commit()
            print(f"\n  committed, {changed} course(s) unpublished")


if __name__ == "__main__":
    asyncio.run(main())
