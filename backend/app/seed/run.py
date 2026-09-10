"""Idempotent database seeder.

Loads the JSON files in database/seed into PostgreSQL. Safe to re-run: rows are
matched on their natural key (slug / question / key) and updated in place.

    python -m app.seed.run              # seed everything
    python -m app.seed.run --reset      # delete seeded content first
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.catalog import Course, CourseCategory, CourseModule, Lesson
from app.models.certification import (
    Certification,
    CertificationProvider,
    CertificationResource,
)
from app.models.content import Article, ArticleCategory, Faq, Tag, Testimonial
from app.models.enums import ContentStatus, UserRole
from app.models.system import SiteSetting
from app.models.user import User
from app.utils.text import build_excerpt, reading_minutes, slugify

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(message)s")
logger = logging.getLogger("seed")

SEED_DIR = Path(__file__).resolve().parents[3] / "database" / "seed"


def load(name: str) -> dict[str, Any]:
    path = SEED_DIR / name
    if not path.is_file():
        raise SystemExit(f"Seed file missing: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


async def get_or_create(session: AsyncSession, model, *, match: dict, defaults: dict):
    """Fetch a row by its natural key, creating or updating it in place."""
    stmt = select(model)
    for field, value in match.items():
        stmt = stmt.where(getattr(model, field) == value)
    instance = await session.scalar(stmt)
    if instance is None:
        instance = model(**match, **defaults)
        session.add(instance)
        await session.flush()
        return instance, True
    for field, value in defaults.items():
        setattr(instance, field, value)
    await session.flush()
    return instance, False


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
async def seed_users(session: AsyncSession) -> dict[str, User]:
    people = [
        {
            "email": settings.seed_admin_email.lower(),
            "name": settings.seed_admin_name,
            "role": UserRole.ADMIN.value,
            "password": settings.seed_admin_password,
            "headline": "Platform administrator",
        },
        {
            "email": "instructor@example.com",
            "name": "Demo Instructor",
            "role": UserRole.INSTRUCTOR.value,
            "password": "Instructor123!",
            "headline": "Course author - demo account",
            "bio": "Placeholder instructor profile created by the seed script. Replace with "
                   "a real author profile before launch.",
        },
        {
            "email": "student@example.com",
            "name": "Demo Student",
            "role": UserRole.STUDENT.value,
            "password": "Student123!",
            "headline": "Demo learner account",
        },
    ]

    users: dict[str, User] = {}
    for person in people:
        password = person.pop("password")
        email = person.pop("email")
        existing = await session.scalar(select(User).where(User.email == email))
        defaults = {**person, "is_active": True, "is_email_verified": True}
        if existing is None:
            # password_hash is NOT NULL, so it must be present on the insert.
            defaults["password_hash"] = hash_password(password)
            logger.info("created user %s (%s)", email, defaults["role"])
        user, _ = await get_or_create(
            session, User, match={"email": email}, defaults=defaults
        )
        users[user.role] = user
    return users


# ---------------------------------------------------------------------------
# Taxonomy
# ---------------------------------------------------------------------------
async def seed_taxonomy(session: AsyncSession):
    data = load("taxonomy.json")
    course_categories: dict[str, CourseCategory] = {}
    for row in data["course_categories"]:
        category, _ = await get_or_create(
            session,
            CourseCategory,
            match={"slug": row["slug"]},
            defaults={
                "name": row["name"],
                "description": row.get("description"),
                "icon": row.get("icon"),
                "position": row.get("position", 0),
                "is_published": True,
            },
        )
        course_categories[row["slug"]] = category

    article_categories: dict[str, ArticleCategory] = {}
    for row in data["article_categories"]:
        category, _ = await get_or_create(
            session,
            ArticleCategory,
            match={"slug": row["slug"]},
            defaults={
                "name": row["name"],
                "description": row.get("description"),
                "icon": row.get("icon"),
                "position": row.get("position", 0),
            },
        )
        article_categories[row["slug"]] = category

    tags: dict[str, Tag] = {}
    for name in data["tags"]:
        slug = slugify(name, max_length=100)
        tag, _ = await get_or_create(
            session, Tag, match={"slug": slug}, defaults={"name": name}
        )
        tags[name] = tag

    logger.info(
        "taxonomy: %d course categories, %d article categories, %d tags",
        len(course_categories),
        len(article_categories),
        len(tags),
    )
    return course_categories, article_categories, tags


# ---------------------------------------------------------------------------
# Certifications
# ---------------------------------------------------------------------------
async def seed_certifications(session: AsyncSession):
    data = load("certifications.json")

    providers: dict[str, CertificationProvider] = {}
    for row in data["providers"]:
        provider, _ = await get_or_create(
            session,
            CertificationProvider,
            match={"slug": row["slug"]},
            defaults={
                "name": row["name"],
                "short_description": row.get("short_description"),
                "description": row.get("description"),
                "website_url": row.get("website_url"),
                "accent_color": row.get("accent_color"),
                "position": row.get("position", 0),
                "is_published": True,
                # Never claim a partnership in seed data.
                "is_official_partner": False,
                "meta_title": row.get("meta_title"),
                "meta_description": row.get("meta_description"),
            },
        )
        providers[row["slug"]] = provider

    certifications: dict[str, Certification] = {}
    for row in data["certifications"]:
        provider = providers[row["provider"]]
        certification, _ = await get_or_create(
            session,
            Certification,
            match={"provider_id": provider.id, "slug": row["slug"]},
            defaults={
                "name": row["name"],
                "short_description": row.get("short_description", ""),
                "description": row.get("description", ""),
                "exam_code": row.get("exam_code"),
                "level": row["level"],
                "category": row.get("category"),
                "skills": row.get("skills", []),
                "exam_topics": row.get("exam_topics", []),
                "audience": row.get("audience"),
                "recommended_experience": row.get("recommended_experience"),
                "preparation_roadmap": row.get("preparation_roadmap", []),
                "exam_duration_minutes": row.get("exam_duration_minutes"),
                "exam_format": row.get("exam_format"),
                "official_url": row.get("official_url"),
                "is_published": True,
                "is_featured": row.get("is_featured", False),
                "position": row.get("position", 0),
            },
        )
        certifications[row["slug"]] = certification

        for index, resource in enumerate(row.get("resources", []), start=1):
            await get_or_create(
                session,
                CertificationResource,
                match={
                    "certification_id": certification.id,
                    "slug": slugify(resource["title"], max_length=220),
                },
                defaults={
                    "title": resource["title"],
                    "resource_type": resource.get("resource_type", "guide"),
                    "description": resource.get("description"),
                    "content": resource.get("content", ""),
                    "url": resource.get("url"),
                    "estimated_minutes": resource.get("estimated_minutes"),
                    "position": index,
                    "status": ContentStatus.PUBLISHED.value,
                },
            )

    logger.info(
        "certifications: %d providers, %d certifications",
        len(providers),
        len(certifications),
    )
    return providers, certifications


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------
async def seed_courses(
    session: AsyncSession,
    categories: dict[str, CourseCategory],
    certifications: dict[str, Certification],
    instructor: User,
):
    data = load("courses.json")
    courses: dict[str, Course] = {}

    for row in data["courses"]:
        category = categories.get(row["category"])
        course, _ = await get_or_create(
            session,
            Course,
            match={"slug": row["slug"]},
            defaults={
                "title": row["title"],
                "short_description": row["short_description"],
                "description": row.get("description", ""),
                "icon": row.get("icon"),
                "category_id": category.id if category else None,
                "instructor_id": instructor.id,
                "level": row["level"],
                "duration_minutes": row.get("duration_minutes", 0),
                "price": Decimal(str(row.get("price", "0"))),
                "currency": row.get("currency", "USD"),
                "learning_outcomes": row.get("learning_outcomes", []),
                "requirements": row.get("requirements", []),
                "is_published": True,
                "is_featured": row.get("is_featured", False),
                "meta_description": row["short_description"],
            },
        )
        courses[row["slug"]] = course

        linked = [
            certifications[slug]
            for slug in row.get("certifications", [])
            if slug in certifications
        ]
        if linked:
            await session.refresh(course, ["certifications"])
            course.certifications = linked

        total_minutes = 0
        for module_index, module_row in enumerate(row["modules"], start=1):
            module, _ = await get_or_create(
                session,
                CourseModule,
                match={"course_id": course.id, "position": module_index},
                defaults={
                    "title": module_row["title"],
                    "description": module_row.get("description"),
                },
            )
            for lesson_index, lesson_row in enumerate(module_row["lessons"], start=1):
                minutes = lesson_row.get("duration_minutes", 0)
                total_minutes += minutes
                await get_or_create(
                    session,
                    Lesson,
                    match={
                        "module_id": module.id,
                        "slug": slugify(lesson_row["title"], max_length=220),
                    },
                    defaults={
                        "title": lesson_row["title"],
                        "description": lesson_row.get("description"),
                        "content": lesson_row.get("content", ""),
                        "video_url": lesson_row.get("video_url"),
                        "resources": lesson_row.get("resources", []),
                        "duration_minutes": minutes,
                        "position": lesson_index,
                        "is_preview": lesson_row.get("is_preview", False),
                    },
                )
        course.duration_minutes = total_minutes or course.duration_minutes

    logger.info("courses: %d", len(courses))
    return courses


# ---------------------------------------------------------------------------
# Articles
# ---------------------------------------------------------------------------
async def seed_articles(
    session: AsyncSession,
    categories: dict[str, ArticleCategory],
    tags: dict[str, Tag],
    author: User,
):
    data = load("articles.json")
    now = datetime.now(UTC)

    for index, row in enumerate(data["articles"]):
        category = categories.get(row["category"])
        content = row["content"]
        published_at = now - timedelta(days=index * 6 + 2)
        article, _ = await get_or_create(
            session,
            Article,
            match={"slug": row["slug"]},
            defaults={
                "title": row["title"],
                "excerpt": row.get("excerpt") or build_excerpt(content),
                "content": content,
                "author_id": author.id,
                "category_id": category.id if category else None,
                "reading_minutes": reading_minutes(content),
                "is_featured": row.get("is_featured", False),
                "status": ContentStatus.PUBLISHED.value,
                "published_at": published_at,
                "meta_title": row.get("meta_title"),
                "meta_description": row.get("meta_description") or row.get("excerpt"),
                "faq": row.get("faq", []),
            },
        )
        wanted = [tags[name] for name in row.get("tags", []) if name in tags]
        if wanted:
            await session.refresh(article, ["tags"])
            article.tags = wanted

    logger.info("articles: %d", len(data["articles"]))


# ---------------------------------------------------------------------------
# FAQs, testimonials, settings
# ---------------------------------------------------------------------------
async def seed_site(session: AsyncSession):
    data = load("site.json")

    for row in data["faqs"]:
        await get_or_create(
            session,
            Faq,
            match={"question": row["question"]},
            defaults={
                "answer": row["answer"],
                "category": row["category"],
                "position": row["position"],
                "is_published": row.get("is_published", True),
            },
        )

    for row in data["testimonials"]:
        await get_or_create(
            session,
            Testimonial,
            match={"user_name": row["user_name"]},
            defaults={
                "role": row.get("role"),
                "content": row["content"],
                "rating": row.get("rating", 5),
                "position": row.get("position", 0),
                "is_published": row.get("is_published", True),
                "is_demo": row.get("is_demo", True),
            },
        )

    for row in data["settings"]:
        await get_or_create(
            session,
            SiteSetting,
            match={"key": row["key"]},
            defaults={
                "value": row["value"],
                "description": row.get("description"),
                "is_public": row.get("is_public", True),
            },
        )

    logger.info(
        "site: %d FAQs, %d testimonials, %d settings",
        len(data["faqs"]),
        len(data["testimonials"]),
        len(data["settings"]),
    )


# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------
async def reset(session: AsyncSession) -> None:
    logger.warning("Deleting seeded content")
    for model in (
        Lesson,
        CourseModule,
        Course,
        CourseCategory,
        CertificationResource,
        Certification,
        CertificationProvider,
        Article,
        ArticleCategory,
        Tag,
        Faq,
        Testimonial,
        SiteSetting,
    ):
        await session.execute(delete(model))
    await session.commit()


async def main(do_reset: bool) -> None:
    async with SessionLocal() as session:
        if do_reset:
            await reset(session)

        users = await seed_users(session)
        course_categories, article_categories, tags = await seed_taxonomy(session)
        _, certifications = await seed_certifications(session)
        await seed_courses(
            session,
            course_categories,
            certifications,
            users.get(UserRole.INSTRUCTOR.value) or users[UserRole.ADMIN.value],
        )
        await seed_articles(
            session,
            article_categories,
            tags,
            users.get(UserRole.INSTRUCTOR.value) or users[UserRole.ADMIN.value],
        )
        await seed_site(session)
        await session.commit()

    logger.info("Seed complete.")
    logger.info("Admin login: %s", settings.seed_admin_email)
    if settings.environment != "development":
        logger.warning(
            "Seed data contains demo accounts and placeholder testimonials. "
            "Do not leave them in a production database."
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the database with demo content.")
    parser.add_argument(
        "--reset", action="store_true", help="Delete existing seeded content first"
    )
    args = parser.parse_args()
    try:
        asyncio.run(main(args.reset))
    except KeyboardInterrupt:
        sys.exit(1)
