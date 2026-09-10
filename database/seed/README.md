# Seed content

Demo content for local development, loaded by `backend/app/seed/run.py`.

| File | Contents |
| --- | --- |
| `taxonomy.json` | Course categories, resource categories, tags |
| `certifications.json` | Providers, certifications, exam topics, roadmaps, study resources |
| `courses.json` | Courses with modules and lesson content |
| `articles.json` | Long-form resource-hub articles |
| `site.json` | FAQs, testimonials, site settings (brand, contact, about, legal) |

## Loading

```bash
cd backend
python -m app.seed.run              # create or update
python -m app.seed.run --reset      # wipe seeded content first
```

The loader is idempotent: rows are matched on their natural key (slug, question,
setting key) and updated in place, so re-running is safe.

## Editing

Edit the JSON, then re-run the loader. Because the load is keyed on slugs,
changing a slug creates a new row rather than renaming the existing one — use
`--reset` if you are reorganising.

## Rules for this content

- Testimonials carry `"is_demo": true`. They are labelled **Demo content**
  wherever they render and must be deleted before launch.
- No provider is marked as an official partner. Do not add one without a
  documented agreement.
- No fabricated statistics, awards, ratings or student outcomes.
