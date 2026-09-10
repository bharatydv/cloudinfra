from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_override
from tests.factories import make_course

pytestmark = pytest.mark.asyncio


async def test_enrollment_requires_authentication(client: AsyncClient, db_session):
    course = await make_course(db_session)
    response = await client.post("/api/enrollments", json={"course_id": str(course.id)})
    assert response.status_code == 401


async def test_enroll_in_free_course(client: AsyncClient, db_session, student):
    course = await make_course(db_session)
    auth_override(student)

    response = await client.post("/api/enrollments", json={"course_id": str(course.id)})
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "active"


async def test_duplicate_enrollment_conflicts(client: AsyncClient, db_session, student):
    course = await make_course(db_session)
    auth_override(student)

    await client.post("/api/enrollments", json={"course_id": str(course.id)})
    second = await client.post("/api/enrollments", json={"course_id": str(course.id)})
    assert second.status_code == 409


async def test_paid_course_cannot_be_enrolled_without_payment(
    client: AsyncClient, db_session, student
):
    course = await make_course(db_session, title="Paid Course", price="49.00")
    auth_override(student)

    response = await client.post("/api/enrollments", json={"course_id": str(course.id)})
    assert response.status_code == 403


async def test_learn_view_requires_enrollment(client: AsyncClient, db_session, student):
    course = await make_course(db_session)
    auth_override(student)

    response = await client.get(f"/api/learn/{course.slug}")
    assert response.status_code == 403


async def test_progress_updates_course_completion(client: AsyncClient, db_session, student):
    course = await make_course(db_session, title="Progress Course", lessons=2)
    auth_override(student)
    await client.post("/api/enrollments", json={"course_id": str(course.id)})

    view = (await client.get(f"/api/learn/{course.slug}")).json()
    assert view["total_lessons"] == 2
    assert view["completed_lessons"] == 0

    first_lesson = view["current_lesson"]["id"]
    marked = await client.post(
        f"/api/lessons/{first_lesson}/progress", json={"completed": True}
    )
    assert marked.status_code == 200
    assert marked.json()["completed"] is True

    progress = (await client.get("/api/users/me/progress")).json()
    assert progress[0]["completed_lessons"] == 1
    assert progress[0]["progress_percentage"] == 50
    assert progress[0]["status"] == "active"


async def test_completing_every_lesson_issues_a_certificate(
    client: AsyncClient, db_session, student
):
    course = await make_course(db_session, title="Short Course", lessons=2)
    auth_override(student)
    await client.post("/api/enrollments", json={"course_id": str(course.id)})

    view = (await client.get(f"/api/learn/{course.slug}")).json()
    lesson_ids = [
        lesson["id"] for module in view["modules"] for lesson in module["lessons"]
    ]
    for lesson_id in lesson_ids:
        await client.post(f"/api/lessons/{lesson_id}/progress", json={"completed": True})

    progress = (await client.get("/api/users/me/progress")).json()
    assert progress[0]["progress_percentage"] == 100
    assert progress[0]["status"] == "completed"

    certificates = (await client.get("/api/users/me/certificates")).json()
    assert len(certificates) == 1
    assert certificates[0]["serial"].startswith("CC-")


async def test_dashboard_summarises_activity(client: AsyncClient, db_session, student):
    course = await make_course(db_session, title="Dashboard Course", lessons=2)
    auth_override(student)
    await client.post("/api/enrollments", json={"course_id": str(course.id)})

    body = (await client.get("/api/users/me/dashboard")).json()
    assert body["enrolled_courses"] == 1
    assert body["in_progress_courses"] == 1
    assert body["completed_courses"] == 0


async def test_non_preview_lesson_is_gated(client: AsyncClient, db_session, student):
    course = await make_course(db_session, title="Gated Course", lessons=2)
    view_unauth = await client.get(f"/api/learn/{course.slug}")
    assert view_unauth.status_code == 401

    auth_override(student)
    detail = (await client.get(f"/api/courses/{course.slug}")).json()
    lessons = detail["modules"][0]["lessons"]
    gated = next(item for item in lessons if not item["is_preview"])

    response = await client.get(f"/api/lessons/{gated['id']}")
    assert response.status_code == 403


async def test_preview_lesson_is_public(client: AsyncClient, db_session):
    course = await make_course(db_session, title="Preview Course", lessons=2)
    detail = (await client.get(f"/api/courses/{course.slug}")).json()
    preview = next(
        item for item in detail["modules"][0]["lessons"] if item["is_preview"]
    )
    response = await client.get(f"/api/lessons/{preview['id']}")
    assert response.status_code == 200
    assert response.json()["content"]


async def test_review_requires_enrollment(client: AsyncClient, db_session, student):
    course = await make_course(db_session, title="Review Course")
    auth_override(student)

    blocked = await client.post(
        f"/api/courses/{course.id}/reviews", json={"rating": 5, "comment": "Great"}
    )
    assert blocked.status_code == 403

    await client.post("/api/enrollments", json={"course_id": str(course.id)})
    allowed = await client.post(
        f"/api/courses/{course.id}/reviews", json={"rating": 5, "comment": "Great"}
    )
    assert allowed.status_code == 201

    detail = (await client.get(f"/api/courses/{course.slug}")).json()
    assert detail["rating_count"] == 1
    assert float(detail["rating_average"]) == 5.0
