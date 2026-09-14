from __future__ import annotations

from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from tests.conftest import auth_override
from tests.factories import make_certification, make_provider

pytestmark = pytest.mark.asyncio


def _payload(certification_id: str, **overrides) -> dict:
    preferred = date.today() + timedelta(days=21)
    body = {
        "full_name": "Asha Rao",
        "email": "asha@example.com",
        "phone": "+91 9000000000",
        "country": "India",
        "city": "Pune",
        "certification_id": certification_id,
        "preferred_date": preferred.isoformat(),
        "alternate_date": (preferred + timedelta(days=3)).isoformat(),
        "preferred_time_slot": "morning",
        "timezone": "Asia/Kolkata",
        "delivery_mode": "online_proctored",
    }
    body.update(overrides)
    return body


async def test_options_list_published_certifications_only(client: AsyncClient, db_session):
    provider = await make_provider(db_session)
    await make_certification(db_session, provider, name="Visible Cert", published=True)
    await make_certification(db_session, provider, name="Hidden Cert", published=False)

    response = await client.get("/api/exam-bookings/options")
    assert response.status_code == 200
    names = [item["name"] for item in response.json()]
    assert "Visible Cert" in names
    assert "Hidden Cert" not in names


async def test_anonymous_visitor_can_submit_a_request(client: AsyncClient, db_session):
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider)

    response = await client.post(
        "/api/exam-bookings", json=_payload(str(certification.id))
    )
    assert response.status_code == 201
    body = response.json()
    assert body["reference_code"].startswith("EX-")
    assert body["certification_name"] == certification.name
    # The success screen routes back to the certification using this link.
    assert body["certification_url"] == (
        f"/certifications/{provider.slug}/{certification.slug}"
    )


async def test_signed_in_request_is_linked_to_the_account(
    client: AsyncClient, db_session, student, admin
):
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider)

    auth_override(student)
    created = await client.post("/api/exam-bookings", json=_payload(str(certification.id)))
    assert created.status_code == 201

    auth_override(admin)
    listing = await client.get("/api/admin/exam-bookings")
    assert listing.status_code == 200
    items = listing.json()["items"]
    assert len(items) == 1
    assert items[0]["user_id"] == str(student.id)


async def test_unpublished_certification_is_rejected(client: AsyncClient, db_session):
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider, published=False)

    response = await client.post(
        "/api/exam-bookings", json=_payload(str(certification.id))
    )
    assert response.status_code == 404


async def test_past_date_and_honeypot_are_rejected(client: AsyncClient, db_session):
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider)

    past = await client.post(
        "/api/exam-bookings",
        json=_payload(
            str(certification.id),
            preferred_date=(date.today() - timedelta(days=1)).isoformat(),
            alternate_date=None,
        ),
    )
    assert past.status_code == 422

    bot = await client.post(
        "/api/exam-bookings",
        json=_payload(str(certification.id), website="http://spam.example"),
    )
    assert bot.status_code == 422


async def test_admin_can_filter_and_update_requests(client: AsyncClient, db_session, admin):
    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider)
    created = await client.post(
        "/api/exam-bookings", json=_payload(str(certification.id))
    )
    reference = created.json()["reference_code"]

    auth_override(admin)
    found = await client.get(f"/api/admin/exam-bookings?q={reference.lower()}")
    assert [item["reference_code"] for item in found.json()["items"]] == [reference]

    booking_id = found.json()["items"][0]["id"]
    updated = await client.put(
        f"/api/admin/exam-bookings/{booking_id}",
        json={"status": "scheduled", "admin_notes": "Slot confirmed with provider."},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "scheduled"

    by_status = await client.get("/api/admin/exam-bookings?booking_status=new")
    assert by_status.json()["items"] == []


async def test_exam_requests_require_admin(client: AsyncClient, db_session, student):
    auth_override(student)
    response = await client.get("/api/admin/exam-bookings")
    assert response.status_code == 403
