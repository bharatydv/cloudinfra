from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.factories import make_category, make_certification, make_course, make_provider

pytestmark = pytest.mark.asyncio


async def test_course_list_returns_published_only(client: AsyncClient, db_session):
    await make_course(db_session, title="Published Course", published=True)
    await make_course(db_session, title="Draft Course", published=False)

    response = await client.get("/api/courses")
    assert response.status_code == 200
    titles = [item["title"] for item in response.json()["items"]]
    assert "Published Course" in titles
    assert "Draft Course" not in titles


async def test_course_list_pagination_metadata(client: AsyncClient, db_session):
    for index in range(3):
        await make_course(db_session, title=f"Course {index}")

    response = await client.get("/api/courses?page=1&page_size=2")
    body = response.json()
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert body["total"] >= 3
    assert body["has_next"] is True
    assert body["has_previous"] is False
    assert len(body["items"]) == 2


async def test_course_filter_by_category_and_search(client: AsyncClient, db_session):
    category = await make_category(db_session, "Data Science")
    await make_course(db_session, title="Data Science Basics", category=category)
    await make_course(db_session, title="Unrelated Topic")

    by_category = await client.get("/api/courses?category=data-science")
    assert [c["title"] for c in by_category.json()["items"]] == ["Data Science Basics"]

    by_search = await client.get("/api/courses?q=unrelated")
    assert [c["title"] for c in by_search.json()["items"]] == ["Unrelated Topic"]


async def test_course_detail_includes_curriculum_and_seo(client: AsyncClient, db_session):
    course = await make_course(db_session, title="Detailed Course", lessons=3)

    response = await client.get(f"/api/courses/{course.slug}")
    assert response.status_code == 200
    body = response.json()
    assert body["lesson_count"] == 3
    assert len(body["modules"]) == 1
    assert len(body["modules"][0]["lessons"]) == 3
    assert body["seo"]["title"]
    assert body["seo"]["canonical_url"].endswith(f"/courses/{course.slug}")
    assert any(item["@type"] == "Course" for item in body["seo"]["structured_data"])
    assert body["is_enrolled"] is False


async def test_course_detail_omits_fabricated_rating_schema(client: AsyncClient, db_session):
    """A course with no reviews must not emit an aggregateRating."""
    course = await make_course(db_session, title="Unrated Course")
    body = (await client.get(f"/api/courses/{course.slug}")).json()
    course_schema = next(
        item for item in body["seo"]["structured_data"] if item["@type"] == "Course"
    )
    assert "aggregateRating" not in course_schema


async def test_unknown_course_returns_404(client: AsyncClient):
    response = await client.get("/api/courses/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_certification_list_and_detail(client: AsyncClient, db_session):
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider)

    listing = await client.get("/api/certifications")
    assert listing.status_code == 200
    assert listing.json()["total"] == 1

    detail = await client.get(
        f"/api/certifications/{provider.slug}/{certification.slug}"
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["exam_code"] == "EX-100"
    assert body["provider"]["slug"] == provider.slug
    assert body["seo"]["breadcrumbs"][0]["name"] == "Home"


async def test_provider_page_never_claims_partnership(client: AsyncClient, db_session):
    provider = await make_provider(db_session)
    await make_certification(db_session, provider)

    body = (await client.get(f"/api/certifications/{provider.slug}")).json()
    assert body["is_official_partner"] is False


async def test_unpublished_certification_is_hidden(client: AsyncClient, db_session):
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider, published=False)

    response = await client.get(
        f"/api/certifications/{provider.slug}/{certification.slug}"
    )
    assert response.status_code == 404
