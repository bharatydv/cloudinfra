"""Add the Generative AI for Beginners course to an already-seeded database.

The full seeder (`app.seed.run`) is deliberately not used for this. On a live
database it would:

  * create demo accounts with published passwords (instructor@example.com /
    Instructor123!, student@example.com / Student123!) and reset the admin
    password to the seed value;
  * overwrite every certification, course, article, FAQ, testimonial and site
    setting to match the repo's seed JSON, discarding anything edited through
    Admin since the database was first seeded.

This script touches one course and nothing else:

  * the `artificial-intelligence` course category (created only if missing)
  * the `generative-ai-for-beginners` course row
  * its modules and lessons, matched on position and slug, safe to re-run
  * its FAQs, under the `course:generative-ai-for-beginners` category

No user is created or modified. No other course, article, certification or
setting is read or written.

Usage, pointed at whichever database DATABASE_URL names:

    DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/db?ssl=require" \\
        python -m scripts.apply_genai_course --dry-run
    DATABASE_URL="..." python -m scripts.apply_genai_course

Run from the `backend` directory so DATABASE_URL is read before
`app.core.config.settings` is imported.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import SessionLocal
from app.models.catalog import Course, CourseCategory, CourseModule, Lesson
from app.models.content import Faq
from app.models.enums import UserRole
from app.models.user import User
from app.utils.text import slugify

COURSE_SLUG = "generative-ai-for-beginners"
COURSE_DIR = (
    Path(__file__).resolve().parents[2] / "database" / "seed" / "courses" / COURSE_SLUG
)
# Created only if the category is genuinely absent; an existing one is left
# exactly as the operator has it.
CATEGORY_FALLBACK = {
    "name": "Artificial Intelligence",
    "slug": "artificial-intelligence",
    "icon": "brain-circuit",
    "description": "Practical courses on artificial intelligence and generative AI.",
}


def load_course() -> dict[str, Any]:
    manifest = COURSE_DIR / "course.json"
    if not manifest.is_file():
        raise SystemExit(f"Course manifest not found: {manifest}")
    row = json.loads(manifest.read_text(encoding="utf-8"))
    row["modules"] = [
        json.loads(path.read_text(encoding="utf-8"))
        for path in sorted(COURSE_DIR.glob("module-*.json"))
    ]
    if not row["modules"]:
        raise SystemExit(f"No module-NN.json files in {COURSE_DIR}")
    return row


async def resolve_instructor(db: AsyncSession, wanted: str | None) -> User:
    """Use an existing account. This script never creates a user.

    The instructor's name and headline are shown on the public course page, so
    a seeded demo account is the wrong answer even though it is usually the
    first instructor in the table. Prefer a real account, and say so loudly
    when only a demo one is available.
    """
    if wanted:
        user = await db.scalar(select(User).where(User.email == wanted.lower()))
        if user is None:
            raise SystemExit(f"No account with email {wanted!r} in this database.")
        return user

    candidates = (
        await db.scalars(
            select(User)
            .where(User.role.in_([UserRole.INSTRUCTOR.value, UserRole.ADMIN.value]))
            .order_by(User.created_at)
        )
    ).all()
    if not candidates:
        raise SystemExit(
            "No instructor or admin account exists in this database. "
            "Create one through Admin before running this script."
        )

    real = [u for u in candidates if not u.email.endswith("@example.com")]
    if real:
        return real[0]

    chosen = candidates[0]
    print(
        f"  WARNING: the only staff accounts are demo ones. Crediting "
        f"{chosen.email!r}, whose name and headline would appear on the "
        f"public course page."
    )
    print(
        "           Re-run with --instructor-email <real account> "
        "before publishing."
    )
    return chosen


async def resolve_category(db: AsyncSession, slug: str) -> CourseCategory:
    category = await db.scalar(select(CourseCategory).where(CourseCategory.slug == slug))
    if category is not None:
        return category
    category = CourseCategory(**CATEGORY_FALLBACK)
    db.add(category)
    await db.flush()
    print(f"  created course category {slug!r}")
    return category


async def apply(
    db: AsyncSession,
    row: dict[str, Any],
    *,
    dry_run: bool,
    instructor_email: str | None,
) -> None:
    category = await resolve_category(db, row["category"])
    instructor = await resolve_instructor(db, instructor_email)
    print(f"  instructor: {instructor.email} ({instructor.role})")

    course = await db.scalar(
        select(Course)
        .where(Course.slug == row["slug"])
        .options(selectinload(Course.modules).selectinload(CourseModule.lessons))
    )
    creating = course is None
    print(f"  course: {'creating' if creating else 'updating'} {row['slug']!r}")

    fields = {
        "title": row["title"],
        "short_description": row["short_description"],
        "description": row.get("description", ""),
        "icon": row.get("icon"),
        "category_id": category.id,
        "level": row["level"],
        "price": row.get("price", "0"),
        "currency": row.get("currency", "USD"),
        "learning_outcomes": row.get("learning_outcomes", []),
        "requirements": row.get("requirements", []),
        "roadmap": row.get("roadmap", []),
        "certification_levels": row.get("certification_levels", []),
        "is_featured": row.get("is_featured", False),
        "meta_description": row.get("meta_description", row["short_description"]),
    }
    if row.get("meta_title"):
        fields["meta_title"] = row["meta_title"]

    if creating:
        course = Course(
            slug=row["slug"],
            instructor_id=instructor.id,
            # Publishing stays a separate, deliberate decision. A re-run never
            # changes it, so flipping it in Admin is not undone by this script.
            is_published=row.get("is_published", False),
            **fields,
        )
        db.add(course)
        await db.flush()
    else:
        for key, value in fields.items():
            setattr(course, key, value)
        print(f"  is_published left as it is: {course.is_published}")

    existing_modules = {m.position: m for m in (course.modules if not creating else [])}
    total_minutes = 0
    lessons_written = 0

    for index, module_row in enumerate(row["modules"], start=1):
        module = existing_modules.get(index)
        if module is None:
            module = CourseModule(
                course_id=course.id,
                position=index,
                title=module_row["title"],
                description=module_row.get("description"),
            )
            db.add(module)
            await db.flush()
            existing_lessons: dict[str, Lesson] = {}
        else:
            module.title = module_row["title"]
            module.description = module_row.get("description")
            existing_lessons = {l.slug: l for l in module.lessons}

        for position, lesson_row in enumerate(module_row["lessons"], start=1):
            slug = slugify(lesson_row["title"], max_length=220)
            minutes = lesson_row.get("duration_minutes", 0)
            total_minutes += minutes
            lessons_written += 1

            lesson = existing_lessons.get(slug)
            values = {
                "title": lesson_row["title"],
                "description": lesson_row.get("description"),
                "content": lesson_row.get("content", ""),
                "video_url": lesson_row.get("video_url"),
                "resources": lesson_row.get("resources", []),
                "duration_minutes": minutes,
                "position": position,
                "is_preview": lesson_row.get("is_preview", False),
            }
            if lesson is None:
                db.add(Lesson(module_id=module.id, slug=slug, **values))
            else:
                for key, value in values.items():
                    setattr(lesson, key, value)

    course.duration_minutes = total_minutes
    print(f"  modules: {len(row['modules'])}, lessons: {lessons_written}, {total_minutes} min")

    faqs = row.get("faqs", [])
    for index, faq_row in enumerate(faqs, start=1):
        faq = await db.scalar(select(Faq).where(Faq.question == faq_row["question"]))
        values = {
            "answer": faq_row["answer"],
            "category": f"course:{row['slug']}",
            "position": faq_row.get("position", index),
            "is_published": faq_row.get("is_published", True),
        }
        if faq is None:
            db.add(Faq(question=faq_row["question"], **values))
        else:
            for key, value in values.items():
                setattr(faq, key, value)
    print(f"  faqs: {len(faqs)}")

    if dry_run:
        await db.rollback()
        print("\n  DRY RUN -- rolled back, nothing was written")
    else:
        await db.commit()
        print("\n  committed")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do everything, then roll back instead of committing.",
    )
    parser.add_argument(
        "--instructor-email",
        help="Credit this existing account as the course author.",
    )
    args = parser.parse_args()

    row = load_course()
    lessons = sum(len(m["lessons"]) for m in row["modules"])
    print(f"Applying {row['slug']!r}: {len(row['modules'])} modules, {lessons} lessons")
    print(f"  source: {COURSE_DIR}")

    async with SessionLocal() as db:
        # Guard against the obvious mistake of pointing this at the wrong
        # database: report what else is there before touching anything.
        others = (await db.scalars(select(Course.slug).where(Course.slug != COURSE_SLUG))).all()
        print(f"  other courses in this database (untouched): {len(others)}")
        await apply(
            db, row, dry_run=args.dry_run, instructor_email=args.instructor_email
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(130)
