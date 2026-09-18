"""The certification challenge.

These tests concentrate on the things a candidate has an incentive to bend:
seeing the answers early, buying extra time, growing their own paper, and
shrugging off the proctoring warnings. The marketing copy is not tested; the
integrity of the discount it promises is.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.campaign import ChallengeAttempt, ChallengeQuestion
from app.models.system import SiteSetting
from app.services import challenge_service
from tests.factories import make_certification, make_provider

pytestmark = pytest.mark.asyncio

PROVIDER_SLUG = "google-cloud"


async def _terms(db, **overrides):
    """Install campaign terms and drop the service's cached copy."""
    value = {
        "enabled": True,
        "providerSlug": PROVIDER_SLUG,
        "questionCount": 4,
        "durationMinutes": 25,
        "passMark": 70,
        "rewardDiscountPercentage": 20,
        "maxWarnings": 3,
        "retakeAfterDays": 7,
        "responseHours": 24,
    }
    value.update(overrides)
    existing = await db.scalar(select(SiteSetting).where(SiteSetting.key == "challenge"))
    if existing is None:
        db.add(SiteSetting(key="challenge", value=value, is_public=True))
    else:
        existing.value = value
    await db.commit()
    challenge_service.reset_cache()


async def _questions(db, certification, count: int = 6, prefix: str = "q"):
    for index in range(count):
        db.add(
            ChallengeQuestion(
                reference=f"{prefix}-{uuid.uuid4().hex[:8]}-{index}",
                provider_slug=PROVIDER_SLUG,
                certification_id=certification.id,
                prompt=f"Question {index}?",
                options=[
                    {"key": "a", "text": "Right"},
                    {"key": "b", "text": "Wrong"},
                    {"key": "c", "text": "Wrong"},
                    {"key": "d", "text": "Wrong"},
                ],
                correct_option="a",
                explanation=f"Because of reason {index}.",
                topic="IAM",
                difficulty="medium",
            )
        )
    await db.commit()


async def _setup(db, **terms):
    """A published Google Cloud certification with a stocked question bank."""
    provider = await make_provider(db, name="Google Cloud")
    provider.slug = PROVIDER_SLUG
    await db.commit()
    certification = await make_certification(
        db, provider, name="Associate Cloud Engineer", exam_fee="125.00"
    )
    await _questions(db, certification)
    await _terms(db, **terms)
    return provider, certification


def _start_payload(certification_id, **overrides) -> dict:
    body = {
        "full_name": "Asha Rao",
        "email": f"asha-{uuid.uuid4().hex[:8]}@example.com",
        "phone": "+91 9000000000",
        "country": "India",
        "certification_id": str(certification_id),
        "accept_rules": True,
    }
    body.update(overrides)
    return body


async def _answer_key(db, attempt_id) -> tuple[list[str], dict[str, str]]:
    attempt = await db.scalar(
        select(ChallengeAttempt).where(ChallengeAttempt.id == uuid.UUID(attempt_id))
    )
    rows = await db.scalars(
        select(ChallengeQuestion).where(
            ChallengeQuestion.id.in_([uuid.UUID(q) for q in attempt.question_ids])
        )
    )
    return list(attempt.question_ids), {str(row.id): row.correct_option for row in rows}


# --- Landing -----------------------------------------------------------------
async def test_intro_offers_only_certifications_with_a_question_bank(client, db_session):
    provider, certification = await _setup(db_session)
    # Published, same provider, but nothing written for it yet.
    await make_certification(db_session, provider, name="Empty Cert")

    body = (await client.get("/api/challenge")).json()
    names = [option["name"] for option in body["options"]]
    assert certification.name in names
    assert "Empty Cert" not in names
    assert body["terms"]["pass_mark"] == "70.00"


async def test_intro_reports_the_campaign_as_closed_when_disabled(client, db_session):
    await _setup(db_session, enabled=False)
    body = (await client.get("/api/challenge")).json()
    assert body["terms"]["enabled"] is False


# --- Starting a paper ---------------------------------------------------------
async def test_starting_returns_questions_without_any_answers(client, db_session):
    _, certification = await _setup(db_session)

    response = await client.post(
        "/api/challenge/attempts", json=_start_payload(certification.id)
    )
    assert response.status_code == 201
    body = response.json()
    assert body["reference_code"].startswith("GC-")
    assert len(body["questions"]) == 4
    # The security property the whole feature rests on.
    assert "correct_option" not in response.text
    assert "explanation" not in response.text


async def test_the_rules_must_be_accepted(client, db_session):
    _, certification = await _setup(db_session)
    response = await client.post(
        "/api/challenge/attempts",
        json=_start_payload(certification.id, accept_rules=False),
    )
    assert response.status_code == 422


async def test_a_paper_is_capped_by_the_bank_when_the_bank_is_small(client, db_session):
    _, certification = await _setup(db_session, questionCount=50)
    body = (
        await client.post("/api/challenge/attempts", json=_start_payload(certification.id))
    ).json()
    # Six questions exist; asking for fifty must not invent any.
    assert len(body["questions"]) == 6


async def test_a_second_paper_cannot_be_opened_while_one_is_running(client, db_session):
    _, certification = await _setup(db_session)
    payload = _start_payload(certification.id)
    assert (await client.post("/api/challenge/attempts", json=payload)).status_code == 201

    second = await client.post("/api/challenge/attempts", json=payload)
    assert second.status_code == 422
    assert "in progress" in second.json()["error"]["message"]


async def test_honeypot_submission_is_rejected(client, db_session):
    _, certification = await _setup(db_session)
    response = await client.post(
        "/api/challenge/attempts",
        json=_start_payload(certification.id, website="http://spam.example"),
    )
    assert response.status_code == 422


# --- Proctoring ---------------------------------------------------------------
async def test_third_warning_terminates_the_paper(client, db_session):
    _, certification = await _setup(db_session)
    session = (
        await client.post("/api/challenge/attempts", json=_start_payload(certification.id))
    ).json()
    url = f"/api/challenge/attempts/{session['attempt_id']}/warnings"

    first = (await client.post(url, json={"token": session["token"], "kind": "tab_hidden"})).json()
    assert (first["warnings"], first["terminated"]) == (1, False)
    assert first["remaining"] == 2

    second = (await client.post(url, json={"token": session["token"], "kind": "copy"})).json()
    assert (second["warnings"], second["terminated"]) == (2, False)

    third = (await client.post(url, json={"token": session["token"], "kind": "paste"})).json()
    assert (third["warnings"], third["terminated"]) == (3, True)

    # Further reports must not push the count past the limit that was promised.
    fourth = (await client.post(url, json={"token": session["token"], "kind": "window_blur"})).json()
    assert fourth["warnings"] == 3


async def test_warnings_reject_a_wrong_token(client, db_session):
    _, certification = await _setup(db_session)
    session = (
        await client.post("/api/challenge/attempts", json=_start_payload(certification.id))
    ).json()
    response = await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/warnings",
        json={"token": "not-the-real-token", "kind": "tab_hidden"},
    )
    assert response.status_code == 404


async def test_warnings_survive_a_page_reload(client, db_session):
    """The count lives on the row, so reopening the tab does not clear it."""
    _, certification = await _setup(db_session)
    session = (
        await client.post("/api/challenge/attempts", json=_start_payload(certification.id))
    ).json()
    url = f"/api/challenge/attempts/{session['attempt_id']}/warnings"
    await client.post(url, json={"token": session["token"], "kind": "tab_hidden"})

    attempt = await db_session.scalar(
        select(ChallengeAttempt).where(
            ChallengeAttempt.id == uuid.UUID(session["attempt_id"])
        )
    )
    assert attempt.warnings == 1
    assert attempt.violations[0]["kind"] == "tab_hidden"


# --- Grading ------------------------------------------------------------------
async def test_passing_records_the_discount_and_returns_the_review(client, db_session):
    _, certification = await _setup(db_session)
    session = (
        await client.post("/api/challenge/attempts", json=_start_payload(certification.id))
    ).json()
    qids, key = await _answer_key(db_session, session["attempt_id"])

    response = await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/submit",
        json={
            "token": session["token"],
            "answers": [{"question_id": q, "option_key": key[q]} for q in qids],
            "auto_submitted": False,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["passed"] is True
    assert body["score_percentage"] == "100.00"
    assert body["discount_percentage"] == "20.00"
    # 125.00 less 20% = 100.00, quoted against the price the site already shows.
    assert body["rewarded_price"] == "100.00"
    assert len(body["review"]) == 4
    assert body["review"][0]["explanation"]


async def test_failing_earns_no_discount(client, db_session):
    _, certification = await _setup(db_session)
    session = (
        await client.post("/api/challenge/attempts", json=_start_payload(certification.id))
    ).json()
    qids, _key = await _answer_key(db_session, session["attempt_id"])

    body = (
        await client.post(
            f"/api/challenge/attempts/{session['attempt_id']}/submit",
            json={
                "token": session["token"],
                "answers": [{"question_id": q, "option_key": "b"} for q in qids],
            },
        )
    ).json()
    assert body["passed"] is False
    assert body["score_percentage"] == "0.00"
    assert body["discount_percentage"] is None
    assert body["rewarded_price"] is None


async def test_answers_for_questions_never_served_are_ignored(client, db_session):
    """A client cannot enlarge its own paper to dilute the ones it got wrong."""
    _, certification = await _setup(db_session)
    session = (
        await client.post("/api/challenge/attempts", json=_start_payload(certification.id))
    ).json()
    qids, key = await _answer_key(db_session, session["attempt_id"])

    outsiders = await db_session.scalars(
        select(ChallengeQuestion.id).where(
            ChallengeQuestion.id.notin_([uuid.UUID(q) for q in qids])
        )
    )
    answers = [{"question_id": qids[0], "option_key": key[qids[0]]}]
    answers += [{"question_id": str(other), "option_key": "a"} for other in outsiders]

    body = (
        await client.post(
            f"/api/challenge/attempts/{session['attempt_id']}/submit",
            json={"token": session["token"], "answers": answers},
        )
    ).json()
    assert body["question_count"] == 4
    assert body["correct_count"] == 1
    assert body["score_percentage"] == "25.00"


async def test_a_late_submission_forfeits_the_reward(client, db_session):
    _, certification = await _setup(db_session)
    session = (
        await client.post("/api/challenge/attempts", json=_start_payload(certification.id))
    ).json()
    qids, key = await _answer_key(db_session, session["attempt_id"])

    attempt = await db_session.scalar(
        select(ChallengeAttempt).where(
            ChallengeAttempt.id == uuid.UUID(session["attempt_id"])
        )
    )
    attempt.expires_at = datetime.now(UTC) - timedelta(minutes=5)
    await db_session.commit()

    body = (
        await client.post(
            f"/api/challenge/attempts/{session['attempt_id']}/submit",
            json={
                "token": session["token"],
                "answers": [{"question_id": q, "option_key": key[q]} for q in qids],
            },
        )
    ).json()
    assert body["score_percentage"] == "100.00"
    assert body["passed"] is False
    assert body["discount_percentage"] is None
    assert body["auto_submitted"] is True


async def test_resubmitting_returns_the_first_result_unchanged(client, db_session):
    _, certification = await _setup(db_session)
    session = (
        await client.post("/api/challenge/attempts", json=_start_payload(certification.id))
    ).json()
    qids, key = await _answer_key(db_session, session["attempt_id"])
    url = f"/api/challenge/attempts/{session['attempt_id']}/submit"

    first = (
        await client.post(
            url,
            json={
                "token": session["token"],
                "answers": [{"question_id": q, "option_key": key[q]} for q in qids],
            },
        )
    ).json()
    # A retry after a dropped response, this time carrying nothing.
    second = (await client.post(url, json={"token": session["token"], "answers": []})).json()

    assert first["score_percentage"] == second["score_percentage"] == "100.00"
    assert second["passed"] is True


async def test_submitting_rejects_a_wrong_token(client, db_session):
    _, certification = await _setup(db_session)
    session = (
        await client.post("/api/challenge/attempts", json=_start_payload(certification.id))
    ).json()
    # Well-formed but wrong, so the token comparison is what rejects it rather
    # than the schema's length check.
    response = await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/submit",
        json={"token": "f" * len(session["token"]), "answers": []},
    )
    assert response.status_code == 404


async def test_retake_is_blocked_until_the_cooldown_expires(client, db_session):
    _, certification = await _setup(db_session)
    payload = _start_payload(certification.id)
    session = (await client.post("/api/challenge/attempts", json=payload)).json()
    await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/submit",
        json={"token": session["token"], "answers": []},
    )

    blocked = await client.post("/api/challenge/attempts", json=payload)
    assert blocked.status_code == 422
    assert "already taken" in blocked.json()["error"]["message"]


async def test_cooldown_of_zero_days_allows_an_immediate_retake(client, db_session):
    _, certification = await _setup(db_session, retakeAfterDays=0)
    payload = _start_payload(certification.id)
    session = (await client.post("/api/challenge/attempts", json=payload)).json()
    await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/submit",
        json={"token": session["token"], "answers": []},
    )

    again = await client.post("/api/challenge/attempts", json=payload)
    assert again.status_code == 201


# --- Terms --------------------------------------------------------------------
async def test_campaign_terms_are_clamped_to_sane_values(db_session):
    """An operator typo must not create a paper with a negative pass mark."""
    await _terms(db_session, passMark=-40, maxWarnings=0, questionCount=0)
    config = await challenge_service.load_config(db_session)
    assert config.pass_mark == Decimal("0.00")
    assert config.max_warnings == 1
    assert config.question_count == 1


async def test_the_promised_discount_is_snapshotted_onto_the_attempt(client, db_session):
    """Changing the campaign later must not alter what a candidate was told."""
    _, certification = await _setup(db_session)
    session = (
        await client.post("/api/challenge/attempts", json=_start_payload(certification.id))
    ).json()
    qids, key = await _answer_key(db_session, session["attempt_id"])
    await client.post(
        f"/api/challenge/attempts/{session['attempt_id']}/submit",
        json={
            "token": session["token"],
            "answers": [{"question_id": q, "option_key": key[q]} for q in qids],
        },
    )

    await _terms(db_session, rewardDiscountPercentage=5)

    attempt = await db_session.scalar(
        select(ChallengeAttempt).where(
            ChallengeAttempt.id == uuid.UUID(session["attempt_id"])
        )
    )
    assert attempt.discount_percentage == Decimal("20.00")
