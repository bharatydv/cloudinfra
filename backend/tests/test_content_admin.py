from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_override
from tests.factories import make_article, make_certification, make_course, make_provider

pytestmark = pytest.mark.asyncio


# --------------------------------------------------------------------------
# Articles (public)
# --------------------------------------------------------------------------
async def test_draft_articles_are_not_public(client: AsyncClient, db_session):
    await make_article(db_session, title="Published Guide")
    await make_article(db_session, title="Draft Guide", status="draft")

    titles = [
        item["title"] for item in (await client.get("/api/articles")).json()["items"]
    ]
    assert "Published Guide" in titles
    assert "Draft Guide" not in titles


async def test_article_detail_builds_toc_and_schema(client: AsyncClient, db_session):
    article = await make_article(db_session, title="Table Of Contents Test")
    body = (await client.get(f"/api/articles/{article.slug}")).json()

    assert body["table_of_contents"][0]["title"] == "Heading"
    assert body["table_of_contents"][0]["anchor"] == "heading"
    assert any(item["@type"] == "Article" for item in body["seo"]["structured_data"])
    assert body["seo"]["canonical_url"].endswith(f"/resources/{article.slug}")


# --------------------------------------------------------------------------
# Search
# --------------------------------------------------------------------------
async def test_search_matches_across_entities(client: AsyncClient, db_session):
    await make_course(db_session, title="Kubernetes In Production")
    await make_article(db_session, title="Kubernetes Study Notes")

    body = (await client.get("/api/search?q=kubernetes")).json()
    assert body["total"] >= 2
    types = {item["type"] for item in body["results"]}
    assert {"course", "article"} <= types
    for item in body["results"]:
        assert item["url"].startswith("/")


async def test_search_by_exam_code(client: AsyncClient, db_session):
    provider = await make_provider(db_session)
    await make_certification(db_session, provider)

    body = (await client.get("/api/search?q=EX-100")).json()
    assert any(item["type"] == "certification" for item in body["results"])


async def test_empty_search_returns_no_results(client: AsyncClient):
    body = (await client.get("/api/search?q=")).json()
    assert body["total"] == 0
    assert body["results"] == []


# --------------------------------------------------------------------------
# Contact
# --------------------------------------------------------------------------
async def test_contact_form_stores_message(client: AsyncClient, admin):
    response = await client.post(
        "/api/contact",
        json={
            "name": "Grace H",
            "email": "grace@example.com",
            "subject": "A question",
            "message": "I would like to know more about the cloud track.",
        },
    )
    assert response.status_code == 201

    auth_override(admin)
    messages = (await client.get("/api/admin/messages")).json()
    assert messages["total"] == 1
    assert messages["items"][0]["status"] == "new"


async def test_contact_honeypot_is_rejected(client: AsyncClient):
    response = await client.post(
        "/api/contact",
        json={
            "name": "Bot",
            "email": "bot@example.com",
            "subject": "Spam subject",
            "message": "Spam message body here.",
            "website": "http://spam.example",
        },
    )
    assert response.status_code == 422


async def test_contact_validates_input(client: AsyncClient):
    response = await client.post(
        "/api/contact", json={"name": "A", "email": "not-an-email", "subject": "", "message": ""}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"


# --------------------------------------------------------------------------
# Admin authorisation
# --------------------------------------------------------------------------
async def test_admin_routes_reject_students(client: AsyncClient, student):
    auth_override(student)
    for path in (
        "/api/admin/dashboard",
        "/api/admin/users",
        "/api/admin/settings",
    ):
        assert (await client.get(path)).status_code == 403, path


async def test_admin_routes_reject_anonymous(client: AsyncClient):
    assert (await client.get("/api/admin/dashboard")).status_code == 401


async def test_admin_dashboard_counts(client: AsyncClient, db_session, admin):
    await make_course(db_session, title="Counted Course")
    await make_article(db_session, title="Counted Article")
    auth_override(admin)

    stats = (await client.get("/api/admin/dashboard")).json()["stats"]
    assert stats["courses"] >= 1
    assert stats["published_articles"] >= 1
    assert stats["users"] >= 1


# --------------------------------------------------------------------------
# Admin CRUD
# --------------------------------------------------------------------------
async def test_course_crud_round_trip(client: AsyncClient, admin):
    auth_override(admin)

    created = await client.post(
        "/api/courses",
        json={
            "title": "Admin Created Course",
            "short_description": "Created through the admin API in a test.",
            "level": "beginner",
        },
    )
    assert created.status_code == 201, created.text
    course = created.json()
    assert course["slug"] == "admin-created-course"

    module = await client.post(
        "/api/modules", json={"course_id": course["id"], "title": "Module one"}
    )
    assert module.status_code == 201

    lesson = await client.post(
        "/api/lessons",
        json={
            "module_id": module.json()["id"],
            "title": "Lesson one",
            "content": "Body",
            "duration_minutes": 8,
        },
    )
    assert lesson.status_code == 201

    updated = await client.put(
        f"/api/courses/{course['id']}",
        json={"short_description": "An updated short description for the course."},
    )
    assert updated.json()["short_description"].startswith("An updated")

    published = await client.post(f"/api/courses/{course['id']}/publish")
    assert published.json()["is_published"] is True

    # Now visible on the public catalogue.
    public = await client.get(f"/api/courses/{course['slug']}")
    assert public.status_code == 200

    deleted = await client.delete(f"/api/courses/{course['id']}")
    assert deleted.status_code == 200
    assert (await client.get(f"/api/courses/{course['slug']}")).status_code == 404


async def test_publishing_requires_a_module(client: AsyncClient, admin):
    auth_override(admin)
    created = await client.post(
        "/api/courses",
        json={
            "title": "Empty Course",
            "short_description": "A course with no modules yet, for testing.",
        },
    )
    response = await client.post(f"/api/courses/{created.json()['id']}/publish")
    assert response.status_code == 422


async def test_duplicate_course_slug_conflicts(client: AsyncClient, db_session, admin):
    await make_course(db_session, title="Existing Course")
    auth_override(admin)
    response = await client.post(
        "/api/courses",
        json={
            "title": "Existing Course",
            "slug": "existing-course",
            "short_description": "Attempting to reuse an existing slug.",
        },
    )
    assert response.status_code == 409


async def test_article_cms_publish_flow(client: AsyncClient, admin):
    auth_override(admin)

    created = await client.post(
        "/api/articles",
        json={
            "title": "CMS Draft Article",
            "content": "## Section\n\nBody text written through the CMS.",
            "status": "draft",
            "tag_names": ["Testing"],
        },
    )
    assert created.status_code == 201
    article = created.json()
    assert article["status"] == "draft"
    assert article["reading_minutes"] >= 1
    assert article["excerpt"]  # derived from content when omitted
    assert [tag["name"] for tag in article["tags"]] == ["Testing"]

    # Drafts are not publicly readable.
    assert (await client.get(f"/api/articles/{article['slug']}")).status_code == 404

    published = await client.put(
        f"/api/articles/{article['id']}", json={"status": "published"}
    )
    assert published.json()["published_at"] is not None
    assert (await client.get(f"/api/articles/{article['slug']}")).status_code == 200

    assert (await client.delete(f"/api/articles/{article['id']}")).status_code == 200


async def test_certification_crud_round_trip(client: AsyncClient, admin):
    auth_override(admin)

    provider = await client.post(
        "/api/certification-providers", json={"name": "Test Provider"}
    )
    assert provider.status_code == 201

    certification = await client.post(
        "/api/certifications",
        json={
            "provider_id": provider.json()["id"],
            "name": "Test Certification",
            "short_description": "Preparation resources for a test certification.",
            "level": "associate",
            "is_published": True,
        },
    )
    assert certification.status_code == 201

    resource = await client.post(
        "/api/certification-resources",
        json={
            "certification_id": certification.json()["id"],
            "title": "Study roadmap",
            "resource_type": "roadmap",
        },
    )
    assert resource.status_code == 201

    detail = await client.get(
        f"/api/certifications/{provider.json()['slug']}/{certification.json()['slug']}"
    )
    assert detail.status_code == 200
    assert len(detail.json()["resources"]) == 1

    assert (
        await client.delete(f"/api/certifications/{certification.json()['id']}")
    ).status_code == 200


async def test_admin_cannot_demote_themselves(client: AsyncClient, admin):
    auth_override(admin)
    response = await client.put(
        f"/api/admin/users/{admin.id}", json={"role": "student"}
    )
    assert response.status_code == 422


async def test_faq_crud(client: AsyncClient, admin):
    auth_override(admin)
    created = await client.post(
        "/api/admin/faqs",
        json={"question": "Is this tested?", "answer": "Yes.", "category": "home"},
    )
    assert created.status_code == 201

    public = await client.get("/api/faqs?category=home")
    assert any(item["question"] == "Is this tested?" for item in public.json())

    assert (
        await client.delete(f"/api/admin/faqs/{created.json()['id']}")
    ).status_code == 200


# --------------------------------------------------------------------------
# SEO surfaces
# --------------------------------------------------------------------------
async def test_sitemap_includes_published_content_only(client: AsyncClient, db_session):
    published = await make_course(db_session, title="Sitemap Course", published=True)
    hidden = await make_course(db_session, title="Hidden Course", published=False)

    response = await client.get("/sitemap.xml")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    assert f"/courses/{published.slug}" in response.text
    assert f"/courses/{hidden.slug}" not in response.text


async def test_robots_txt_blocks_private_areas(client: AsyncClient):
    response = await client.get("/robots.txt")
    assert response.status_code == 200
    for path in ("/admin", "/dashboard", "/learn", "/login"):
        assert f"Disallow: {path}" in response.text
    assert "Sitemap:" in response.text


async def test_home_payload_shape(client: AsyncClient, db_session):
    await make_course(db_session, title="Home Course")
    body = (await client.get("/api/home")).json()
    for key in (
        "categories",
        "featured_courses",
        "featured_certifications",
        "providers",
        "latest_articles",
        "testimonials",
        "faqs",
        "seo",
    ):
        assert key in body
    assert body["seo"]["robots"] == "index,follow"
