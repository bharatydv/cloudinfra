from __future__ import annotations

from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.system import SiteSetting
from app.services import challenge_service
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


async def test_options_are_restricted_to_the_challenge_campaigns_certifications(
    client: AsyncClient, db_session
):
    """When the campaign names specific exams, scheduling offers only those.

    The scheduling form and the discount test are two doors into the same
    offer, so a certification the campaign does not cover should not appear
    as something a visitor can book through this form either.
    """
    provider = await make_provider(db_session, name="Google Cloud")
    provider.slug = "google-cloud"
    await db_session.commit()
    covered = await make_certification(db_session, provider, name="Covered Cert")
    other = await make_certification(db_session, provider, name="Uncovered Cert")

    db_session.add(
        SiteSetting(
            key="challenge",
            value={
                "enabled": True,
                "providerSlug": "google-cloud",
                "certificationSlugs": [covered.slug],
            },
            is_public=True,
        )
    )
    await db_session.commit()
    challenge_service.reset_cache()

    response = await client.get("/api/exam-bookings/options")
    names = [item["name"] for item in response.json()]
    assert covered.name in names
    assert other.name not in names


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
            preferred_date=(date.today() - timedelta(days=5)).isoformat(),
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


async def test_request_emails_a_receipt_with_a_callback_promise(
    client: AsyncClient, db_session, monkeypatch
):
    from app.services import scheduling_service

    sent: list[dict] = []

    async def fake_send(
        to: str, subject: str, body: str, html: str | None = None, *, sender: str | None = None
    ) -> None:
        sent.append({"to": to, "subject": subject, "body": body, "html": html, "sender": sender})

    monkeypatch.setattr(scheduling_service.email_service, "send_email", fake_send)
    monkeypatch.setattr(scheduling_service.settings, "sales_notification_email", "sales@example.com")
    monkeypatch.setattr(scheduling_service.settings, "email_contact_address", "contact@example.com")

    provider = await make_provider(db_session)
    certification = await make_certification(db_session, provider)
    payload = _payload(str(certification.id))
    response = await client.post("/api/exam-bookings", json=payload)
    assert response.status_code == 201, response.text
    reference = response.json()["reference_code"]

    receipt = next(mail for mail in sent if mail["to"] == payload["email"])
    assert reference in receipt["subject"]
    assert "within 24 hours" in receipt["body"]
    assert payload["preferred_date"] in receipt["body"]
    assert receipt["html"] and "within 24 hours" in receipt["html"]
    # Scheduling mail comes from the contact mailbox so a reply reaches a person.
    assert receipt["sender"] == "contact@example.com"

    alert = next(mail for mail in sent if mail["to"] == "sales@example.com")
    assert reference in alert["body"]
    assert alert["sender"] == "contact@example.com"
