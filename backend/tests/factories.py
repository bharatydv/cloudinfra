"""Small builders so each test can create only the rows it needs."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import Course, CourseCategory, CourseModule, Lesson
from app.models.certification import Certification, CertificationProvider
from app.models.content import Article, ArticleCategory
from app.models.enums import ContentStatus
from app.utils.text import slugify


async def make_category(db: AsyncSession, name: str = "Cloud Computing") -> CourseCategory:
    category = CourseCategory(name=name, slug=slugify(name))
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def make_course(
    db: AsyncSession,
    *,
    title: str = "Cloud Fundamentals",
    price: str = "0",
    published: bool = True,
    category: CourseCategory | None = None,
    lessons: int = 2,
) -> Course:
    course = Course(
        title=title,
        slug=slugify(title),
        short_description=f"{title} short description for tests.",
        description="Body",
        price=Decimal(price),
        is_published=published,
        category_id=category.id if category else None,
    )
    db.add(course)
    await db.flush()

    module = CourseModule(course_id=course.id, title="Module one", position=1)
    db.add(module)
    await db.flush()
    for index in range(1, lessons + 1):
        db.add(
            Lesson(
                module_id=module.id,
                title=f"Lesson {index}",
                slug=f"lesson-{index}",
                content=f"Lesson {index} body",
                position=index,
                duration_minutes=10,
                is_preview=index == 1,
            )
        )
    await db.commit()
    await db.refresh(course)
    return course


async def make_provider(db: AsyncSession, name: str = "Example Cloud") -> CertificationProvider:
    provider = CertificationProvider(name=name, slug=slugify(name), is_published=True)
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider


async def make_certification(
    db: AsyncSession,
    provider: CertificationProvider,
    *,
    name: str = "Example Architect",
    published: bool = True,
) -> Certification:
    certification = Certification(
        provider_id=provider.id,
        name=name,
        slug=slugify(name),
        short_description="Preparation resources for tests.",
        description="Body",
        level="associate",
        exam_code="EX-100",
        skills=["Networking"],
        is_published=published,
    )
    db.add(certification)
    await db.commit()
    await db.refresh(certification)
    return certification


async def make_article(
    db: AsyncSession,
    *,
    title: str = "A Study Guide",
    status: str = ContentStatus.PUBLISHED.value,
    published_at=None,
) -> Article:
    from datetime import UTC, datetime

    category = await db.scalar(
        select(ArticleCategory).where(ArticleCategory.slug == "guides")
    )
    if category is None:
        category = ArticleCategory(name="Guides", slug="guides")
        db.add(category)
        await db.flush()
    article = Article(
        title=title,
        slug=slugify(title),
        excerpt="Excerpt for tests.",
        content="## Heading\n\nBody text for the test article.",
        category_id=category.id,
        status=status,
        published_at=published_at
        or (datetime.now(UTC) if status == ContentStatus.PUBLISHED.value else None),
        reading_minutes=1,
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return article
