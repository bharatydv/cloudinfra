# Digital Marketing — Beginner to Advanced — authoring guide

This file governs the **Digital Marketing — Beginner to Advanced** course only.
The Generative AI course has its own guide in [CLAUDE.md](CLAUDE.md), and
everything else in this repository follows `README.md`.

The course lives in the database like every other course on the site. It is
authored as JSON seed files and loaded by the seeder. There is no separate
content system, no new framework, and no change to the site design. It reuses
the course card, detail page, module pages, quiz, hint, solution, worksheet,
next/previous links and progress tracking already built for the GenAI course.

**352 lessons across 21 modules, roughly 163 hours.** Progress is tracked in
[PROGRESS_DIGITAL_MARKETING.md](PROGRESS_DIGITAL_MARKETING.md).

---

## Rules

### Audience

College students, MBA students, freshers, aspiring marketers, entrepreneurs,
freelancers and working professionals. Write for someone intelligent who has
never run a campaign.

- Simple English. Short paragraphs. No paragraph longer than five lines.
- Real examples and analogies, not abstractions. "A dental clinic deciding
  whether to bid on *dentist near me*", not "a keyword selection problem".
- Define a term the first time it appears. Never assume a previous module.
- No jargon for its own sake, and no mathematics beyond arithmetic and
  percentages.

### Method

**30% theory, 70% practical.** The module arc is
**Learn → Demo → Hands-on Practice → Assignment → Assessment**.

Inside a teaching lesson, that becomes five beats, in this order, as `##`
headings:

```
## Learn            the concept in plain English, an analogy, and a diagram
## Demo             one worked example using this module's fictional brand
## Hands-on practice  a task, with a worksheet or template to fill in
## Common mistakes  what beginners get wrong, and what to do instead
## Key takeaways    four or five bullets
```

**Diagrams are ASCII inside a code fence.** The renderer has no Mermaid support,
so a ```mermaid block would print its own source at the learner. Draw boxes and
arrows by hand; they render on the dark code background and read fine on a
phone.

Every **module** ends with exactly four lessons, in this order:

1. `Practice questions: <name>` — **40 questions** in total:
   - 20 multiple choice, in one `:::quiz` block
   - 10 short-answer, each with its model answer in a `:::solution` block,
     because the quiz component cannot grade free text
   - 5 scenario-based, in a `:::quiz` block with a situation in the prompt
   - 5 true/false, in a `:::quiz` block with True and False as the options
   Every question carries an explanation on the `=` line.
2. `Hands-on lab: <name>` — **3 guided exercises**, each with its expected
   output, plus a `:::template` to work in and a `:::checklist` to self-check
   against
3. `Assignment: <name>` — a deliverable, marked out of **100** against a rubric
   written as a table
4. `Assessment: <name>` — a closing quiz of **10 questions with a stated pass
   mark**, drawn from the whole module

A module that carries code (2, 3, 11, 15 and 17) puts it in its teaching
lessons: 4–5 exercises with starter, hint, full solution and expected output,
plus **2 debugging exercises**. A module with no code says nothing about code.

Module 20 is the capstone. Its lessons are deliverable briefs rather than the
four beats, but it keeps the same closing four.

### Coverage

**Never skip a topic from the PDF.** The topic map below is the contract. Every
bullet from the source outline maps to exactly one lesson. If a lesson grows
too large, split it and update the map — do not drop a topic.

Two outline bullets are merged where they are genuinely one idea: `ROI` and
`ROAS` share a lesson, and `CAC` and `LTV` share a lesson. Both remain fully
covered; the map records it.

### Added practicals

The outline lists a `Practical:` bullet for most modules. **Seven modules have
none: 9, 13, 14, 16, 17, 18 and 19.** Each of those gets a practical invented
for it, which becomes its hands-on lab. The map marks these
*(no practical in the PDF — added)*.

### Fictional brands

Every case study, example and assignment uses one of four fictional brands.
**Never invent data, revenue, traffic or performance figures about a real
company.**

| Brand | What it is | Used in |
| --- | --- | --- |
| **Petal & Pine** | A D2C skincare brand | Modules 1, 5, 6, 11, 13, 14 |
| **Bright Mile Dental** | A local dental clinic | Modules 2, 7, 10 |
| **Shiftly** | A B2B SaaS tool | Modules 4, 12, 15, 17, 18 |
| **Craftwise Academy** | An online course seller | Modules 3, 8, 9, 16 |

Modules 19 and 20 have no fixed brand: the career module is about the learner,
and the capstone learner picks one of the four.

### Practice artefacts

Practice means producing something, not reading about it. Use worksheets,
templates, checklists, sample reports and case studies, and hand them over in a
`:::worksheet`, `:::template` or `:::checklist` block so the learner can copy or
download them.

### Coding sections

Only five modules carry code, and only where a marketer genuinely needs it:

| Module | What |
| --- | --- |
| 2 | HTML and CSS: a landing page and a lead-generation form |
| 3 | JSON-LD structured data for a course and an organisation |
| 11 | A UTM builder, and spreadsheet formulas for ROI, ROAS, CAC, LTV and cohort tables |
| 15 | Prompt templates, and optional Python for bulk content work |
| 17 | Zapier and Make workflow blueprints, and webhook payloads |

Every coding exercise carries all five of:

- **Starter code** with the signature, a comment and `<!-- Your code here -->`
  or `# Your code here`
- **A hint**, in a `:::hint` block, pointing at the approach without giving it
- **A full solution**, in a `:::solution` block, with a short note on why it is
  written that way
- **Expected output**, as a fenced block so the learner can compare
- **A debugging exercise**: broken code with a stated number of bugs, its own
  hint and its own solution

**Never hard-code an API key or an access token.** Every example reads
credentials from the environment:

```python
import os

api_key = os.environ["OPENAI_API_KEY"]   # never a literal in the file
```

In a webhook or automation blueprint, show the secret as a placeholder the
learner replaces from their own tool, never a real-looking value.

### Tool claims

Google Ads, Meta Ads, GA4, Semrush, Ahrefs, Mailchimp, HubSpot and WhatsApp
Business change their interfaces, free tiers, policies and prices constantly. A
course cannot keep up and should not pretend to.

- **Never** state a price, a free-tier limit, a quota, a policy detail or a
  menu path as a permanent fact.
- Teach the concept and the sequence of steps, then add a **"Check the current
  interface"** note where the click path is likely to have moved.
- Naming a tool is fine. Ranking tools on figures that go stale is not.

### No promises

- **Never promise income, rankings, reach or results.** Not in a lesson, not in
  an assignment brief, not in the capstone.
- The five levels are **completion certificates from this platform**. They are
  not Google, Meta, HubSpot or any other vendor certification, and no lesson
  should imply otherwise.

### Design

Match the existing site exactly. Brand indigo is `brand-600` (`#4f46e5`) in
`frontend/tailwind.config.js`. No new colours, no new fonts, no new UI library,
no redesign of any existing page.

---

## Markdown available in lesson content

Lesson bodies go through `frontend/src/lib/markdown.tsx`, a hand-rolled
renderer. It is **not** CommonMark. What works:

| Works | Does not work |
| --- | --- |
| `##`, `###`, `####` headings | `#` h1 |
| Paragraphs | Tables |
| `-` and `1.` lists (flat) | Nested lists |
| `> ` blockquote | Images |
| ` ``` ` code fences | Syntax highlighting |
| `**bold**`, `*italic*`, `` `code` ``, `[link](url)` | Raw HTML |
| `---` horizontal rule | Footnotes |
| Pipe tables | Mermaid diagrams |

**Tables render** when a header row is followed by a `| --- | --- |` separator.
Use them for the marking rubrics. They scroll inside their own box on a phone,
so keep columns few and cells short.

**Mermaid does not render.** Use ASCII inside a code fence for every diagram.

Plus four container directives, which is how a lesson embeds interactive parts.

### `:::quiz`

```
:::quiz
Q. What is the main job of a landing page?
- To describe everything the business sells
+ To get one specific action from one specific audience
= A landing page is built around a single conversion.
:::
```

- `Q.` or `Q:` starts a question. Repeat for more questions in one block.
- `-` is a wrong option. `+` or `*` is a correct one.
- `=` is the answer key, shown only after the learner checks.
- A bare line continues whichever of the prompt or explanation came last.
- **Do not use backticks inside quiz options** — option text renders as plain
  text, so the backticks would show.
- A question with no options is dropped silently. Always check your output.

### `:::hint` and `:::solution`

```
:::hint Start with the headline
Any Markdown, including code fences.
:::

:::solution
Any Markdown, including code fences.
:::
```

Both collapse closed on every page load, deliberately: the point of a hint is
that the learner tries first. The text after the directive name becomes the
button label; omit it for the default "Hint" or "Solution".

### `:::worksheet`, `:::template` and `:::checklist`

```
:::worksheet Buyer persona sheet
- Name and role:
- What they are trying to get done:
- Where they already look for answers:
- What would stop them buying:
:::
```

The same block with three labels. It renders **open**, with a **Copy** button
and a **Download** button that saves the body as a `.txt` file the learner can
paste into Docs, Sheets or Notion. Nothing is uploaded, so it works on a public
preview lesson too.

Use `worksheet` for something filled in, `template` for something adapted, and
`checklist` for something ticked off. The text after the directive name becomes
the heading and the download filename.

**Do not use `- [ ]` task-list syntax.** The renderer has no task lists, so the
brackets render as literal text. Use plain `-` bullets; the learner ticks them
in their own copy.

A `:::` line inside a code fence is treated as content, not a terminator.

---

## File structure

```
database/seed/courses/digital-marketing-beginner-to-advanced/
├── course.json        course row, outcomes, requirements, 16-week roadmap,
│                      5 certification levels, per-course FAQs
├── module-01.json     one file per module, lessons in array order
├── module-02.json
├── ... module-20.json
└── module-21.json     course reference: study plan, glossary, 30 templates,
                       cheat sheets, career roadmap, the five level exams
```

### Module 21 — the reference pack

Modules 1 to 20 are the course and map one-to-one onto the source outline.
**Module 21 is reference material and is not in the topic map**, because none of
it comes from the outline. It holds:

| Lesson | What it is |
| --- | --- |
| The 16-week day-by-day plan | Every module placed on a study day |
| Glossary | 167 terms, each with the module that covers it |
| Templates 1 to 30 | Three lessons of ten, every one copyable and downloadable |
| Three cheat sheets | SEO and content, ads and analytics, email/automation/AI |
| Career roadmap | The six roles, and the portfolio checklist |
| Level 1 to 4 exams | 20 questions plus 2 applied tasks each, out of 40, pass 24 |
| Level 5 capstone | The brief, the 100-mark rubric and the presentation guide |

**Every lesson in module 21 is `is_preview: true`**, the same as module 15 of
the GenAI course. The course detail page surfaces any module whose lessons are
all previews in its own "Free to read" section, so the reference pack is
reachable without opening the curriculum.

Level 5 has no written exam. The capstone project is the assessment, which is
why its lesson carries a rubric instead of questions.

The seeder reads `course.json`, then every `module-NN.json` in filename order,
which is why the numbers are zero-padded. See `load_course_dirs()` in
`backend/app/seed/run.py`. No code change is needed to add a course: the seeder
discovers any folder under `database/seed/courses/`.

**Module numbers are load-bearing.** Positions are assigned by filename order,
and lessons refer to each other by module number ("module 3 covered keyword
research"). Never insert a module in the middle, and never add a
`module-00.json` — either would renumber everything and silently break every
cross-reference. New material goes at the end, or as extra lessons inside an
existing module.

### Lesson titles must be unique across the whole course

This one is not a style preference. The learn view resolves a lesson by
scanning the course and taking the **first** slug that matches
(`build_learn_view` in `backend/app/services/enrollment_service.py`), and the
sidebar links by bare slug. Two lessons sharing a title means the second is
unreachable: every link to it lands on the first.

The database constraint is `(module_id, slug)`, so it will not stop you. That
is why no module here ends with a bare `Practice questions and answer key` —
each closing lesson is named for its module, and repeated outline topics get
module-specific titles (`Keyword research for search` in module 3,
`Keyword research for YouTube` in module 8).

### Lesson shape

```json
{
  "title": "What makes a landing page work",
  "duration_minutes": 20,
  "is_preview": false,
  "description": "One line, shown on the preview page.",
  "content": "## Learn\n\n...",
  "resources": []
}
```

`is_preview: true` makes a lesson readable without an account at
`/courses/digital-marketing-beginner-to-advanced/preview/<lesson-slug>`. The
slug comes from the title, so **renaming a lesson changes its URL and orphans
the old one**. Module 1's first three lessons are the previews.

A lesson still carrying the `<!-- scaffold -->` marker is not written.

### Loading it

```bash
cd backend
python -m app.seed.run          # idempotent: matches on slug, updates in place
```

On a database that already has data, use the targeted script instead — the full
seeder resets demo accounts and overwrites anything edited through Admin:

```bash
cd backend
DATABASE_URL="..." python -m scripts.apply_genai_course \
    --course digital-marketing-beginner-to-advanced --dry-run
```

The course is `"is_published": false` in `course.json` while it is being
written, so it stays out of the catalogue and the sitemap. Flip it to `true`
when the content is done.

---

## Code this course touches

Created:

- `frontend/src/components/learn/Worksheet.tsx` — the worksheet, template and
  checklist block, with copy and download

Modified:

- `frontend/src/lib/markdown.tsx` — the `:::worksheet`, `:::template` and
  `:::checklist` directives, HTML comments dropped outside code fences, and
  pipe tables for the marking rubrics
- `frontend/src/pages/public/CourseDetailPage.tsx` — the certification levels
  heading counts the levels instead of saying "Three", because this course has
  five; and a "Free to read" section listing any module whose lessons are all
  previews
- `backend/scripts/apply_genai_course.py` — a `--course` flag, so the same safe
  prod-apply path works for both courses

Nothing else. The card, detail page, module pages, quiz, hint, solution,
next/previous links and progress tracking were already course-agnostic.

Before committing frontend changes:

```bash
cd frontend && npm run typecheck && npm run lint
```

---

## The 16-week plan and the five levels

Both live in `course.json` as `roadmap` and `certification_levels`, and render
as their own sections on the course detail page. The outline suggests 12–16
weeks; this is the 16-week version, at roughly eight to ten hours a week.

| Week | Topics | Modules |
| --- | --- | --- |
| 1 | Digital marketing fundamentals | 1 |
| 2 | Websites and landing pages | 2 |
| 3 | SEO foundations | 3 |
| 4 | SEO in depth | 3 |
| 5 | Content marketing | 4 |
| 6 | Social media marketing | 5 |
| 7 | Social media advertising | 6 |
| 8 | Google Ads and PPC | 7 |
| 9 | YouTube marketing | 8 |
| 10 | Email marketing | 9 |
| 11 | WhatsApp and conversational marketing | 10 |
| 12 | Analytics and measurement | 11 |
| 13 | CRO, influencer and affiliate | 12, 13 |
| 14 | E-commerce and AI in marketing | 14, 15 |
| 15 | AI search and automation | 16, 17 |
| 16 | Strategy, career and capstone | 18, 19, 20 |

| Level | Focus | Modules |
| --- | --- | --- |
| 1 — Beginner | Fundamentals, website, SEO, content, social media | 1–5 |
| 2 — Intermediate | Google Ads, Meta Ads, YouTube, email, WhatsApp, analytics, CRO | 6–12 |
| 3 — Advanced | Influencer, affiliate, e-commerce, AI marketing, AEO/GEO, automation, strategy | 13–18 |
| 4 — Professional | Client management, freelancing, pricing, portfolio | 19 |
| 5 — Capstone | A complete digital marketing project, presented | 20 |

These are completion certificates from this platform. They are **not** vendor
certifications, and no lesson should imply otherwise.

---

## Topic map

Every bullet from the source PDF, and the lesson that covers it. A topic with
no lesson beside it is a bug.

### Module 1 — Digital Marketing Fundamentals

| PDF topic | Lesson |
| --- | --- |
| What is Digital Marketing? | What digital marketing actually is |
| Traditional vs Digital Marketing | Traditional marketing and digital marketing |
| Digital marketing ecosystem | The digital marketing ecosystem |
| Customer journey & marketing funnel | The customer journey and the marketing funnel |
| B2B vs B2C marketing | B2B and B2C marketing |
| Target audience & buyer persona | Target audience and buyer personas |
| Customer segmentation | Customer segmentation |
| Marketing objectives & KPIs | Marketing objectives and KPIs |
| Introduction to digital marketing strategy | How a digital marketing strategy fits together |
| *(closing four)* | Practice questions: digital marketing fundamentals |
| Practical: Create a buyer persona and marketing funnel | Hands-on lab: a buyer persona and funnel for Petal & Pine |
| *(closing four)* | Assignment: a one-page digital marketing brief |
| *(closing four)* | Assessment: digital marketing fundamentals |

### Module 2 — Website & Landing Page Fundamentals *(HTML and CSS: a landing page and a lead-generation form)*

| PDF topic | Lesson |
| --- | --- |
| Website structure | How a website is structured |
| Domain & hosting | Domains and hosting |
| Website UX/UI basics | UX and UI basics for marketers |
| Landing pages | What makes a landing page work |
| CTA design | Designing a call to action |
| Lead-generation forms | Lead-generation forms |
| Conversion optimization | Conversion basics for a landing page |
| WordPress basics | WordPress basics |
| Google Analytics & Search Console setup | Setting up Google Analytics and Search Console |
| *(closing four)* | Practice questions: websites and landing pages |
| Practical: Create a landing page for a business | Hands-on lab: build a landing page in HTML and CSS |
| *(closing four)* | Assignment: a landing page for Bright Mile Dental |
| *(closing four)* | Assessment: websites and landing pages |

### Module 3 — SEO — Search Engine Optimization *(JSON-LD: structured data for a course and an organisation)*

| PDF topic | Lesson |
| --- | --- |
| What is SEO? | What SEO is |
| How search engines work | How search engines work |
| Crawling, indexing & ranking | Crawling, indexing and ranking |
| Keyword research | Keyword research for search |
| Search intent | Search intent |
| On-page SEO | On-page SEO |
| Off-page SEO | Off-page SEO |
| Technical SEO | Technical SEO |
| Local SEO | Local SEO |
| International SEO | International SEO |
| Link building | Link building |
| Internal linking | Internal linking |
| SEO content strategy | SEO content strategy |
| Core Web Vitals | Core Web Vitals |
| Structured data/schema | Structured data and schema markup |
| SEO audits | Running an SEO audit |
| Competitor analysis | SEO competitor analysis |
| Tools: Google Search Console, Keyword Planner, Trends, Semrush, Ahrefs, Screaming Frog | The SEO toolkit |
| *(closing four)* | Practice questions: SEO |
| Practical: Perform an SEO audit and create a keyword strategy | Hands-on lab: an SEO audit and keyword strategy |
| *(closing four)* | Assignment: an SEO audit report for Craftwise Academy |
| *(closing four)* | Assessment: SEO |

### Module 4 — Content Marketing

| PDF topic | Lesson |
| --- | --- |
| What is content marketing? | What content marketing is |
| Content strategy | Building a content strategy |
| Content pillars | Content pillars |
| Blog strategy | Blog strategy |
| Content calendar | The content calendar |
| Copywriting fundamentals | Copywriting fundamentals |
| Storytelling | Storytelling in marketing |
| Headlines & hooks | Headlines and hooks |
| Lead magnets | Lead magnets |
| E-books & guides | E-books and long-form guides |
| Content distribution | Content distribution |
| Content repurposing | Content repurposing |
| AI-assisted content creation | AI-assisted content creation |
| *(closing four)* | Practice questions: content marketing |
| Practical: Create a 30-day content calendar | Hands-on lab: a 30-day content calendar |
| *(closing four)* | Assignment: a content plan for Shiftly |
| *(closing four)* | Assessment: content marketing |

### Module 5 — Social Media Marketing

| PDF topic | Lesson |
| --- | --- |
| Social media strategy | Social media strategy |
| Facebook | Facebook |
| Instagram | Instagram |
| LinkedIn | LinkedIn |
| YouTube | YouTube as a social channel |
| X | X |
| Short-form video | Short-form video |
| Reels & Shorts | Reels and Shorts |
| Community building | Community building |
| Hashtag strategy | Hashtag strategy |
| Social media calendar | The social media calendar |
| Engagement strategy | Engagement strategy |
| Influencer marketing | Influencer marketing, an introduction |
| Social media analytics | Social media analytics |
| *(closing four)* | Practice questions: social media marketing |
| Practical: Create a social media strategy for a brand | Hands-on lab: a social media strategy for a brand |
| *(closing four)* | Assignment: a 30-day social media plan for Petal & Pine |
| *(closing four)* | Assessment: social media marketing |

### Module 6 — Social Media Advertising

| PDF topic | Lesson |
| --- | --- |
| Meta Ads fundamentals | Meta Ads fundamentals |
| Campaign objectives | Campaign objectives |
| Campaign structure | Campaign structure |
| Audience targeting | Audience targeting |
| Custom audiences | Custom audiences |
| Lookalike audiences | Lookalike audiences |
| Retargeting | Retargeting on Meta |
| Ad creatives | Ad creatives |
| Copywriting for ads | Copywriting for ads |
| Budgeting | Budgeting a Meta campaign |
| Bidding | Bidding on Meta |
| A/B testing | A/B testing ads |
| Conversion tracking | Conversion tracking on Meta |
| Meta Pixel | The Meta Pixel |
| Campaign optimization | Optimising a Meta campaign |
| *(closing four)* | Practice questions: social media advertising |
| Practical: Build a complete Meta Ads campaign structure | Hands-on lab: a complete Meta Ads campaign structure |
| *(closing four)* | Assignment: a Meta Ads plan for Petal & Pine |
| *(closing four)* | Assessment: social media advertising |

### Module 7 — Google Ads / PPC

| PDF topic | Lesson |
| --- | --- |
| What is PPC? | What PPC is |
| Google Ads ecosystem | The Google Ads ecosystem |
| Search campaigns | Search campaigns |
| Display campaigns | Display campaigns |
| Video campaigns | Video campaigns |
| Shopping campaigns | Shopping campaigns |
| Performance Max | Performance Max |
| Keyword match types | Keyword match types |
| Negative keywords | Negative keywords |
| Ad extensions/assets | Ad extensions and assets |
| Bidding strategies | Bidding strategies in Google Ads |
| Quality Score | Quality Score |
| Conversion tracking | Conversion tracking in Google Ads |
| Remarketing | Remarketing in Google Ads |
| Campaign optimization | Optimising a Google Ads campaign |
| *(closing four)* | Practice questions: Google Ads and PPC |
| Practical: Build a Google Search Ads campaign | Hands-on lab: build a Google Search Ads campaign |
| *(closing four)* | Assignment: a Google Ads plan for Bright Mile Dental |
| *(closing four)* | Assessment: Google Ads and PPC |

### Module 8 — YouTube Marketing

| PDF topic | Lesson |
| --- | --- |
| YouTube algorithm basics | How the YouTube algorithm works |
| Channel setup | Setting up a channel |
| Video SEO | Video SEO |
| Keyword research | Keyword research for YouTube |
| Titles | Titles that earn the click |
| Thumbnails | Thumbnails |
| Descriptions | Descriptions and metadata |
| YouTube Shorts | YouTube Shorts |
| Content strategy | A YouTube content strategy |
| YouTube advertising | YouTube advertising |
| YouTube Analytics | YouTube Analytics |
| *(closing four)* | Practice questions: YouTube marketing |
| Practical: Create a YouTube channel growth plan | Hands-on lab: a YouTube channel growth plan |
| *(closing four)* | Assignment: a channel launch plan for Craftwise Academy |
| *(closing four)* | Assessment: YouTube marketing |

### Module 9 — Email Marketing

| PDF topic | Lesson |
| --- | --- |
| Email marketing fundamentals | Email marketing fundamentals |
| Lead generation | Lead generation for email |
| Email lists | Building and owning an email list |
| Lead magnets | Lead magnets for email list growth |
| Newsletter strategy | Newsletter strategy |
| Email copywriting | Email copywriting |
| Email design | Email design |
| Segmentation | Segmenting an email list |
| Personalization | Personalisation |
| Automation | Email automation |
| Drip campaigns | Drip campaigns |
| Welcome sequences | Welcome sequences |
| Abandoned-cart campaigns | Abandoned-cart emails |
| Email analytics | Email analytics |
| Deliverability | Deliverability |
| Tools: Mailchimp, Brevo, HubSpot | The email toolkit |
| *(closing four)* | Practice questions: email marketing |
| *(no practical in the PDF — added)* | Hands-on lab: build a five-email welcome sequence |
| *(closing four)* | Assignment: an email programme for Craftwise Academy |
| *(closing four)* | Assessment: email marketing |

### Module 10 — WhatsApp & Conversational Marketing

| PDF topic | Lesson |
| --- | --- |
| WhatsApp Business | WhatsApp Business |
| WhatsApp marketing | WhatsApp marketing |
| WhatsApp broadcasts | WhatsApp broadcasts |
| Lead nurturing | Lead nurturing on WhatsApp |
| Chatbots | Chatbots |
| Automated responses | Automated responses |
| Customer support | Customer support over chat |
| WhatsApp API basics | WhatsApp API basics |
| Conversational funnels | Conversational funnels |
| *(closing four)* | Practice questions: WhatsApp and conversational marketing |
| Practical: Design a WhatsApp lead-nurturing workflow | Hands-on lab: design a WhatsApp lead-nurturing workflow |
| *(closing four)* | Assignment: a conversational funnel for Bright Mile Dental |
| *(closing four)* | Assessment: WhatsApp and conversational marketing |

### Module 11 — Analytics & Measurement *(UTM builder and spreadsheet formulas for ROI, ROAS, CAC, LTV and cohorts)*

| PDF topic | Lesson |
| --- | --- |
| Marketing metrics | The metrics that matter |
| Traffic sources | Traffic sources |
| UTM parameters | UTM parameters |
| Google Analytics 4 | Google Analytics 4 |
| Events | Events in GA4 |
| Conversions | Conversions in GA4 |
| User acquisition | User acquisition reports |
| Engagement | Engagement reports |
| Attribution | Attribution |
| Funnel analysis | Funnel analysis |
| Cohort analysis | Cohort analysis |
| Campaign reporting | Campaign reporting |
| ROI / ROAS | ROI and ROAS |
| CAC / LTV | CAC and LTV |
| Dashboard creation | Building a dashboard |
| Tools: GA4, Search Console, Looker Studio, Excel/Google Sheets | The analytics toolkit |
| *(closing four)* | Practice questions: analytics and measurement |
| Practical: Build a digital marketing dashboard | Hands-on lab: build a digital marketing dashboard |
| *(closing four)* | Assignment: a monthly performance report for Petal & Pine |
| *(closing four)* | Assessment: analytics and measurement |

### Module 12 — Conversion Rate Optimization (CRO)

| PDF topic | Lesson |
| --- | --- |
| What is CRO? | What conversion rate optimisation is |
| Conversion funnel | The conversion funnel |
| Landing-page optimization | Landing-page optimisation |
| CTA optimization | CTA optimisation |
| Form optimization | Form optimisation |
| A/B testing | A/B testing a page |
| Heatmaps | Heatmaps and session recordings |
| User behavior | Reading user behaviour |
| Conversion experiments | Running a conversion experiment |
| *(closing four)* | Practice questions: conversion rate optimisation |
| Practical: Analyze a landing page and propose improvements | Hands-on lab: analyse a landing page and propose improvements |
| *(closing four)* | Assignment: a CRO teardown for Shiftly |
| *(closing four)* | Assessment: conversion rate optimisation |

### Module 13 — Influencer & Affiliate Marketing

| PDF topic | Lesson |
| --- | --- |
| Influencer marketing | How influencer marketing works |
| Types of influencers | Types of influencers |
| Influencer selection | Selecting an influencer |
| Campaign planning | Planning an influencer campaign |
| Negotiation | Negotiation and contracts |
| Measuring influencer campaigns | Measuring an influencer campaign |
| Affiliate marketing | How affiliate marketing works |
| Affiliate networks | Affiliate networks |
| Commission models | Commission models |
| Tracking affiliate performance | Tracking affiliate performance |
| *(closing four)* | Practice questions: influencer and affiliate marketing |
| *(no practical in the PDF — added)* | Hands-on lab: an influencer campaign plan and outreach kit |
| *(closing four)* | Assignment: an influencer and affiliate programme for Petal & Pine |
| *(closing four)* | Assessment: influencer and affiliate marketing |

### Module 14 — E-commerce Marketing

| PDF topic | Lesson |
| --- | --- |
| E-commerce marketing funnel | The e-commerce marketing funnel |
| Product pages | Product pages that sell |
| Product SEO | Product SEO |
| Google Shopping | Google Shopping |
| Meta commerce advertising | Meta commerce advertising |
| Retargeting | Retargeting for e-commerce |
| Abandoned cart | Abandoned-cart recovery |
| Customer reviews | Customer reviews and social proof |
| Upselling & cross-selling | Upselling and cross-selling |
| Marketplace marketing | Marketplace marketing |
| Customer retention | Customer retention |
| *(closing four)* | Practice questions: e-commerce marketing |
| *(no practical in the PDF — added)* | Hands-on lab: a product page and merchandising teardown |
| *(closing four)* | Assignment: an e-commerce growth plan for Petal & Pine |
| *(closing four)* | Assessment: e-commerce marketing |

### Module 15 — AI in Digital Marketing *(Prompt templates, and optional Python for bulk content work)*

| PDF topic | Lesson |
| --- | --- |
| Generative AI for marketing | Generative AI for marketing |
| AI content creation | AI content creation |
| AI copywriting | AI copywriting |
| AI image generation | AI image generation for marketing |
| AI video generation | AI video generation for marketing |
| AI social media management | AI for social media management |
| AI SEO | AI for SEO |
| AI keyword research | AI keyword research |
| AI customer research | AI customer research |
| AI analytics | AI for analytics |
| AI chatbots | AI chatbots for marketing |
| AI marketing automation | AI marketing automation |
| Prompt engineering for marketers | Prompt engineering for marketers |
| AI agents for marketing workflows | AI agents for marketing workflows |
| *(closing four)* | Practice questions: AI in digital marketing |
| Practical: Build an AI-assisted marketing campaign | Hands-on lab: build an AI-assisted marketing campaign |
| *(closing four)* | Assignment: an AI-assisted campaign for Shiftly |
| *(closing four)* | Assessment: AI in digital marketing |

### Module 16 — Advanced SEO: AEO, GEO & AI Search

| PDF topic | Lesson |
| --- | --- |
| SEO vs AEO vs GEO | SEO, AEO and GEO |
| Answer Engine Optimization | Answer Engine Optimisation |
| Generative Engine Optimization | Generative Engine Optimisation |
| AI Search | AI search |
| Search intent | Search intent in AI search |
| Entity optimization | Entity optimisation |
| Structured content | Structured content |
| Knowledge graphs | Knowledge graphs |
| Brand mentions | Brand mentions |
| AI-generated search results | AI-generated search results |
| Optimizing content for AI answers | Optimising content for AI answers |
| Measuring visibility in AI search | Measuring visibility in AI search |
| *(closing four)* | Practice questions: AEO, GEO and AI search |
| *(no practical in the PDF — added)* | Hands-on lab: an AI-answer visibility audit |
| *(closing four)* | Assignment: an AEO and GEO plan for Craftwise Academy |
| *(closing four)* | Assessment: AEO, GEO and AI search |

### Module 17 — Marketing Automation *(Zapier and Make workflow blueprints, and webhook payloads)*

| PDF topic | Lesson |
| --- | --- |
| Marketing automation fundamentals | Marketing automation fundamentals |
| Lead scoring | Lead scoring |
| Lead nurturing | Lead nurturing workflows |
| CRM | What a CRM does |
| Automated email workflows | Automated email workflows |
| WhatsApp automation | WhatsApp automation |
| Customer segmentation | Segmentation inside automation |
| Retargeting automation | Retargeting automation |
| Workflow design | Designing a workflow |
| CRM integration | CRM integration and webhooks |
| Tools: HubSpot, Zoho, Zapier, Make | The automation toolkit |
| *(closing four)* | Practice questions: marketing automation |
| *(no practical in the PDF — added)* | Hands-on lab: a lead-nurturing automation blueprint |
| *(closing four)* | Assignment: an automation build for Shiftly |
| *(closing four)* | Assessment: marketing automation |

### Module 18 — Advanced Digital Marketing Strategy

| PDF topic | Lesson |
| --- | --- |
| Market research | Market research |
| Competitor analysis | Competitor analysis for strategy |
| SWOT analysis | SWOT analysis |
| STP strategy | Segmentation, targeting and positioning |
| Customer journey mapping | Customer journey mapping |
| Marketing funnel | The full-funnel view |
| Channel selection | Channel selection |
| Content strategy | Content strategy at the portfolio level |
| Paid + organic strategy | Paid and organic together |
| Budget allocation | Budget allocation |
| Campaign planning | Campaign planning |
| KPI framework | A KPI framework |
| Marketing attribution | Marketing attribution models |
| ROI optimization | ROI optimisation |
| *(closing four)* | Practice questions: advanced strategy |
| *(no practical in the PDF — added)* | Hands-on lab: a one-page annual marketing strategy |
| *(closing four)* | Assignment: a 12-month strategy for Shiftly |
| *(closing four)* | Assessment: advanced strategy |

### Module 19 — Freelancing & Digital Marketing Career

| PDF topic | Lesson |
| --- | --- |
| Digital marketing career paths | Digital marketing career paths |
| SEO specialist | The SEO specialist role |
| Social media manager | The social media manager role |
| Performance marketer | The performance marketer role |
| Content marketer | The content marketer role |
| Email marketer | The email marketer role |
| Digital marketing analyst | The digital marketing analyst role |
| Freelancing platforms | Freelancing platforms |
| Finding clients | Finding clients |
| Creating proposals | Writing a proposal |
| Pricing services | Pricing your services |
| Client communication | Client communication |
| Reporting to clients | Reporting to clients |
| Building a portfolio | Building a portfolio |
| LinkedIn personal branding | LinkedIn personal branding |
| *(closing four)* | Practice questions: freelancing and career |
| *(no practical in the PDF — added)* | Hands-on lab: build your portfolio and proposal kit |
| *(closing four)* | Assignment: a portfolio, proposal and rate card |
| *(closing four)* | Assessment: freelancing and career |

### Module 20 — Capstone Project

| PDF topic | Lesson |
| --- | --- |
| *(added — opens the module)* | Capstone: choosing your brand and brief |
| Market research | Capstone: market research |
| Buyer persona | Capstone: buyer persona |
| Competitor analysis | Capstone: competitor analysis |
| Website/landing page | Capstone: website and landing page |
| Keyword research | Capstone: keyword research |
| SEO strategy | Capstone: SEO strategy |
| Content strategy | Capstone: content strategy |
| Social media calendar | Capstone: social media calendar |
| Meta Ads campaign | Capstone: Meta Ads campaign |
| Google Ads campaign | Capstone: Google Ads campaign |
| Email campaign | Capstone: email campaign |
| Analytics setup | Capstone: analytics setup |
| Marketing dashboard | Capstone: marketing dashboard |
| Campaign budget | Capstone: campaign budget |
| KPI & ROI report | Capstone: KPI and ROI report |
| Final presentation | Capstone: final presentation |
| *(closing four)* | Practice questions: capstone readiness |
| *(no practical in the PDF — added)* | Hands-on lab: a capstone dry run |
| *(closing four)* | Assignment: the complete digital marketing capstone |
| *(closing four)* | Assessment: capstone readiness |
