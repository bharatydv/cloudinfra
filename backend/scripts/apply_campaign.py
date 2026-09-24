"""Apply the certification-challenge campaign's data to a database.

The full seeder (`app.seed.run`) is deliberately not used for this: it
overwrites every certification, course and article to match the repo's seed
JSON, which would discard any edit made through Admin since the database was
first seeded. This script only touches what the campaign actually needs:

  * the two campaign certifications (added if missing, left alone if present)
  * their question bank (matched on `reference`, safe to re-run)
  * the `challenge` site setting (replaced with the campaign's current terms)
  * every certification's `discount_percentage`, as certifications.json sets it
  * the promotion banner text and the site-wide discount, from site.json

Nothing else -- no other certification, course, article or setting -- is
read or written.

Usage, pointed at whichever database DATABASE_URL names:

    DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/db?ssl=require" \\
        python -m scripts.apply_campaign

Run from the `backend` directory so `DATABASE_URL` is read before `app.core
.config.settings` is imported.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.campaign import ChallengeQuestion
from app.models.certification import Certification, CertificationProvider
from app.models.system import SiteSetting

SEED_DIR = Path(__file__).resolve().parents[2] / "database" / "seed"

CAMPAIGN_CERT_SLUGS = ["cloud-digital-leader", "generative-ai-leader"]

CHALLENGE_SETTING_VALUE = {
    "enabled": True,
    "providerSlug": "google-cloud",
    "certificationSlugs": CAMPAIGN_CERT_SLUGS,
    "questionCount": 50,
    "durationMinutes": 90,
    "passMark": 70,
    "rewardDiscountMinPercentage": 20,
    "rewardDiscountMaxPercentage": 65,
    "maxWarnings": 3,
    "retakeAfterDays": 7,
    "responseHours": 24,
}
CHALLENGE_SETTING_DESCRIPTION = (
    "Certification challenge campaign terms: which certifications are offered, "
    "paper size, time limit, pass mark, the discount scale a pass earns (minimum "
    "at the pass mark, maximum for a perfect score), and how many proctoring "
    "warnings are allowed before the test auto-submits."
)

# Setting fields the campaign owns, copied from site.json.
SETTING_FIELDS = {
    "promotion": ["message", "badge"],
    "pricing": ["discountPercentage"],
}


def load(name: str) -> dict:
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


async def main() -> None:
    certifications = load("certifications.json")["certifications"]
    questions = load("challenge.json")["questions"]

    async with SessionLocal() as db:
        provider = await db.scalar(
            select(CertificationProvider).where(CertificationProvider.slug == "google-cloud")
        )
        if provider is None:
            raise SystemExit(
                "No 'google-cloud' provider in this database. Run the full seeder "
                "first, or create the provider before this script."
            )

        # --- Certifications --------------------------------------------------
        by_slug: dict[str, Certification] = {}
        added_certs = 0
        for row in certifications:
            if row["slug"] not in CAMPAIGN_CERT_SLUGS or row["provider"] != "google-cloud":
                continue
            existing = await db.scalar(
                select(Certification).where(
                    Certification.provider_id == provider.id,
                    Certification.slug == row["slug"],
                )
            )
            if existing is not None:
                by_slug[row["slug"]] = existing
                print(f"certification already present, left as-is: {row['slug']}")
                continue
            certification = Certification(
                provider_id=provider.id,
                name=row["name"],
                slug=row["slug"],
                short_description=row.get("short_description", ""),
                description=row.get("description", ""),
                exam_code=row.get("exam_code"),
                level=row["level"],
                category=row.get("category"),
                skills=row.get("skills", []),
                exam_topics=row.get("exam_topics", []),
                audience=row.get("audience"),
                recommended_experience=row.get("recommended_experience"),
                preparation_roadmap=row.get("preparation_roadmap", []),
                exam_duration_minutes=row.get("exam_duration_minutes"),
                exam_format=row.get("exam_format"),
                official_url=row.get("official_url"),
                exam_fee_amount=row.get("exam_fee_amount"),
                exam_fee_currency=row.get("exam_fee_currency", "USD"),
                discount_percentage=row.get("discount_percentage"),
                is_published=True,
                is_featured=row.get("is_featured", False),
                position=row.get("position", 0),
            )
            db.add(certification)
            await db.flush()
            by_slug[row["slug"]] = certification
            added_certs += 1
            print(f"added certification: {row['slug']}")

        missing = set(CAMPAIGN_CERT_SLUGS) - set(by_slug)
        if missing:
            raise SystemExit(f"Certification(s) not found in certifications.json: {missing}")

        # --- Question bank -----------------------------------------------------
        added_q = updated_q = 0
        for row in questions:
            slug = row.get("certification")
            if slug not in CAMPAIGN_CERT_SLUGS:
                continue
            certification = by_slug[slug]
            existing = await db.scalar(
                select(ChallengeQuestion).where(ChallengeQuestion.reference == row["reference"])
            )
            defaults = dict(
                provider_slug=row.get("provider", "google-cloud"),
                certification_id=certification.id,
                prompt=row["prompt"],
                options=row["options"],
                correct_option=row["correct_option"],
                explanation=row.get("explanation"),
                topic=row.get("topic"),
                difficulty=row.get("difficulty", "medium"),
                is_active=row.get("is_active", True),
            )
            if existing is None:
                db.add(ChallengeQuestion(reference=row["reference"], **defaults))
                added_q += 1
            else:
                for field, value in defaults.items():
                    setattr(existing, field, value)
                updated_q += 1

        # --- Campaign setting ----------------------------------------------
        setting = await db.scalar(select(SiteSetting).where(SiteSetting.key == "challenge"))
        if setting is None:
            db.add(
                SiteSetting(
                    key="challenge",
                    value=CHALLENGE_SETTING_VALUE,
                    description=CHALLENGE_SETTING_DESCRIPTION,
                    is_public=True,
                )
            )
            print("created 'challenge' setting")
        else:
            setting.value = CHALLENGE_SETTING_VALUE
            setting.description = CHALLENGE_SETTING_DESCRIPTION
            print("updated 'challenge' setting")

        # --- Discounts -------------------------------------------------------
        # Every certification's discount follows the seed JSON: the campaign
        # certifications carry the headline discount, the rest none.
        providers = {
            p.slug: p.id for p in (await db.scalars(select(CertificationProvider))).all()
        }
        for row in certifications:
            provider_id = providers.get(row["provider"])
            if provider_id is None:
                continue
            existing = await db.scalar(
                select(Certification).where(
                    Certification.provider_id == provider_id,
                    Certification.slug == row["slug"],
                )
            )
            if existing is None:
                continue
            discount = row.get("discount_percentage")
            if existing.discount_percentage != discount:
                print(
                    f"discount {row['slug']}: {existing.discount_percentage} -> {discount}"
                )
                existing.discount_percentage = discount

        # --- Promotion and pricing ---------------------------------------------
        # Only the campaign's fields are merged in; anything else in these
        # settings (benefits, tax, ...) keeps whatever Admin last saved.
        seed_settings = {s["key"]: s["value"] for s in load("site.json")["settings"]}
        for key, fields in SETTING_FIELDS.items():
            setting = await db.scalar(select(SiteSetting).where(SiteSetting.key == key))
            if setting is None:
                print(f"no '{key}' setting in this database, skipped")
                continue
            value = dict(setting.value or {})
            for field in fields:
                value[field] = seed_settings[key][field]
            if value != setting.value:
                setting.value = value
                print(f"updated '{key}' setting: {', '.join(fields)}")

        await db.commit()
        print(
            f"done: {added_certs} certification(s) added, "
            f"{added_q} question(s) added, {updated_q} question(s) updated"
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(1)
