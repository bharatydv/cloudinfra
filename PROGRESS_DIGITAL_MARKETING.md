# Digital Marketing — Beginner to Advanced — progress

Tracks the build of the course. Authoring rules are in
[COURSE_DIGITAL_MARKETING.md](COURSE_DIGITAL_MARKETING.md).

**Status:** structure complete, every lesson scaffolded.
**Module 1 of 20 is written, and module 21 (the reference pack) is complete.**
Modules 2 to 20 are still scaffolds.
**352 lessons across 21 modules, roughly 163 hours.**
Verified end to end against a local database and browser on 2026-10-05.
The course is now `"is_published": true` in `course.json`. **Modules 2 to 20 are
still scaffolds**, so publishing puts 325 placeholder lessons in the catalogue
and the sitemap. See the deployment note below.

A module is done when all of its teaching lessons are written **and** its four
closing lessons (practice questions, lab, assignment, assessment) are written. A
lesson still carrying the `<!-- scaffold -->` marker is not written.

---

## Platform work

- [x] Seed folder `database/seed/courses/digital-marketing-beginner-to-advanced/`
- [x] `course.json` — title, slug, category `digital-marketing`, icon `megaphone`, free
- [x] 20 `module-NN.json` files, every lesson scaffolded with its final title
- [x] Every one of the 271 PDF bullets mapped to exactly one lesson
- [x] Lesson titles verified unique across the whole course (338 slugs, no collisions)
- [x] FAQ questions verified distinct from the GenAI course and `site.json`
- [x] `Worksheet` component — worksheet, template and checklist, with copy and download
- [x] `:::worksheet`, `:::template`, `:::checklist` in the Markdown renderer
- [x] Renderer drops HTML comments, so `<!-- scaffold -->` no longer prints on the
      page; inside a code fence it is still content, for `<!-- Your code here -->`
- [x] Renderer supports pipe tables, which the 100-mark rubrics need
- [x] Renderer joins a list item that wraps onto an indented line, instead of
      restarting the numbering (an unindented line after a list is still a new
      paragraph, which 352 places in the GenAI course rely on)
- [x] Worksheet, template and checklist blocks keep their line breaks, so a form
      renders as a form rather than one run-on paragraph
- [x] Course detail page counts certification levels instead of hard-coding "Three"
- [x] `apply_genai_course.py` takes `--course`, so prod-apply works for both courses
- [x] `apply_genai_course.py` picks the category fallback by slug, instead of
      filing every course under Artificial Intelligence
- [x] `npm run typecheck` and `npm run lint` clean
- [x] Seeder run against a local database: 8 courses, this one 20 modules / 338 lessons
- [x] Catalogue card, detail page (16 weeks, 5 levels, 20 modules) and a preview
      lesson all render
- [x] Worksheet and checklist blocks render with working Copy and Download
- [x] All 338 lessons walked by following Next: no loop, no collision, every slug
      resolves to its own lesson
- [x] Progress tracking verified: mark complete moves the counter and persists
- [x] GenAI course re-checked after the shared renderer change: hints, solutions,
      code fences, detail page and its 3 levels all still render
- [ ] Write the content, module by module (the checklist below)
- [ ] Replace the sample practice question in each module with the full 7–10
- [ ] Decide whether preview lessons should be indexable (currently `noindex,follow`)
- [ ] Publish: flip `is_published` to `true` in `course.json`

## Module 21 — the reference pack

Added at the end so modules 1 to 20 keep mapping one-to-one onto the source
outline. Every lesson is a preview, so all of it is free to read.

- [x] 14 lessons, 19,511 words, all `is_preview: true`
- [x] 16-week day-by-day plan: 16 weeks x 5 study days, every module placed
- [x] Glossary: 167 terms, each with the module that covers it
- [x] 30 numbered templates across 3 lessons, every one copy- and downloadable
- [x] 3 tool cheat sheets: SEO/content, ads/analytics, email/automation/AI
- [x] Career roadmap with the six roles and a portfolio checklist
- [x] Level 1 to 4 exams: 20 questions plus 2 applied tasks each, out of 40,
      pass 24, with per-question answer keys and self-marking guides
- [x] Level 5 capstone: brief, 16 deliverables, 100-mark rubric with deductions
      and grade bands, and a presentation guide
- [x] Course detail page gained a "Free to read, no account needed" section,
      driven by any module whose lessons are all previews, so the GenAI course's
      reference module gains it too
- [x] All links checked: 17 preview URLs, 17 course links on the detail page and
      all 14 reference pages render, no raw directives or leaked markup
- [ ] **Re-check the Level 2 to 4 exams when modules 2 to 20 are written.** They
      were written from the topic map, so a question could test something the
      finished module words differently.

## Deployed to production, 2026-10-05

- [x] Image `20261005-225807`, revision `learnbase-web--0000024`
- [x] Rollback tag if needed: `20260930-013646`
- [x] Both courses applied with `apply-course.sh <slug> --publish`; the other
      seven courses were reported untouched by the script on both runs
- [x] Live: 8 courses, Digital Marketing 21 modules / 352 lessons, GenAI
      unchanged at 15 / 163
- [x] All existing public pages return 200
- [x] Sitemap: 76 urls, 18 for Digital Marketing, 11 for GenAI
- [x] Byline reads "Platform Admin — Platform administrator", which is fine.
      The script's demo-account warning fired on the email domain, not the
      display name

### Known, and not fixed here

- [ ] **Per-page meta and og tags are applied client-side.** Search engines that
      render JavaScript see them correctly, but social crawlers do not run JS,
      so every shared link previews as the site's default card. This is how the
      SPA has always worked and affects every page, not just the new ones.
      Fixing it means prerendering or server-rendering the head.
- [ ] Modules 2 to 20 are scaffolds and are now publicly visible and in the
      sitemap. Either finish them or run
      `apply-course.sh digital-marketing-beginner-to-advanced --unpublish`.

## SEO

- [x] Every new page emits title, description, canonical, robots, og:title,
      og:description, og:type, og:url, og:image, og:site_name, twitter:card,
      twitter:title, twitter:description, twitter:image and JSON-LD
- [x] All 18 new URLs are in the sitemap
- [x] Preview lesson titles were 88–114 characters because the API composed
      `lesson | course` and the frontend then appended the brand. The API now
      sends the lesson title alone, so titles are 45–71 characters. The course
      is still named in the description, the breadcrumbs and the JSON-LD
- [x] Course `meta_title` shortened to 47 characters, 61 with the brand suffix
- [ ] Four titles are still slightly over 60 characters (61, 64, 68, 71).
      Shortening them means renaming lessons, which changes their URLs, so they
      are left as they are
- [ ] Neither course has a thumbnail, so social shares use the site default
      card. A per-course og image would be an improvement

## Known tooling issues found and fixed

- [x] **`npm run typecheck` was checking nothing.** The script ran `tsc --noEmit`
      against the root `tsconfig.json`, which has `"files": []` and only project
      references, so it always exited 0 whatever was broken. Changed to
      `tsc -b --noEmit`, which does build the references. Verified it now catches
      a deliberately introduced error. Every earlier "typecheck clean" in this
      file was vacuous; the first real run found one error, in the new reference
      card, now fixed.
- [x] `CourseDetail.modules[].lessons` is `LessonSummary`, which carries no
      `description`. The reference cards show the reading time instead.

## Audit, 2026-10-05

A full audit of all 20 modules against the topic map. Five errors found and
fixed; the audit script is reproducible and now passes clean.

- [x] Coverage: all 338 topic-map rows match the 338 seed lessons, no topic
      missing, no lesson unmapped
- [x] Lesson titles still unique across the course (338 slugs, 0 collisions)
- [x] All 59 quiz questions checked: every one has 2+ options, exactly one
      correct answer, an explanation, no backticks and no duplicate options
- [x] All 59 answers verified correct by hand
- [x] No prices, free-tier limits, quotas or policy details stated as fact
- [x] No income, ranking or results promises. The audit's promise check now
      ignores negated uses, because the course warns against guarantees often;
      the 5 remaining hits were each reviewed and are warnings, wrong-answer
      options or question prompts
- [x] No claims made about real companies; tools are named, never rated
- [x] No hard-coded credentials; no code yet, so nothing to debug
- [x] Renderer constraints clean: no h1, no images, no task lists, no unbalanced
      directives, no table rows missing a separator
- [x] **Fixed:** the topic map listed the lab before the practice questions, the
      reverse of the rules and of the actual lesson order
- [x] **Fixed:** module 1 lesson 7 said "losing 1,800 subscribers" about the
      dormant segment, which is 1,900
- [x] **Fixed:** module 1 lesson 8 set an objective of filling twelve empty
      slots a week while the marketing target only added twelve a month; now
      three a week, which multiplies out
- [x] **Fixed:** module 1 lesson 9 had a KPI chain that did not multiply out
      (600 starts at 30% is 180, not the 200-seat target). Now 4,000 visits,
      800 starts, 25%, 200 seats, with a line saying these are the brand's own
      arithmetic and not industry benchmarks
- [x] **Fixed:** the module 10 sample question had a clumsy duplicated
      preposition in its correct answer

## Known issues inherited from the GenAI course

- [ ] The GenAI course has 14 lessons titled `Practice questions and answer key`,
      which all share one slug. Only module 1's is reachable; the sidebar links
      for modules 2–14 land on it. Not fixed here, because this work was scoped
      to leave the GenAI course files alone. Fixing it means renaming those 14
      lessons, which changes their URLs.

## Course-level content

- [x] `course.json` — title, slug, category, level, price, icon
- [x] Short description and full description
- [x] 18 learning outcomes
- [x] 5 requirements
- [x] 16-week roadmap
- [x] 5 certification levels
- [x] 10 course FAQs
- [ ] Course thumbnail image

## Content rules to hold to while writing

- [ ] 30% theory, 70% practical in every module
- [ ] Every teaching lesson uses Learn → Demo → Practice → What to remember
- [ ] Every example uses a fictional brand; no real company data invented
- [ ] Every assignment has a 100-mark rubric with stated bands
- [ ] Coding sections in modules 2, 3, 11, 15 and 17 carry starter, hint,
      solution, expected output and a debugging exercise
- [ ] No API key, token or secret is ever a literal
- [ ] No price, free-tier limit or menu path stated as a permanent fact
- [ ] "Check the current interface" notes wherever a click path is shown
- [ ] No promise of income, rankings or results anywhere

---

## Modules

- [x] **Module 01 — Digital Marketing Fundamentals** (13 lessons: 9 teaching + 4 closing)
      — **written, 14,709 words, 403 minutes.** Verified in the browser.
  - [x] 9 teaching lessons written, each with Learn / Demo / Hands-on practice /
        Common mistakes / Key takeaways, an analogy, an ASCII diagram and a
        worksheet
  - [x] Practice questions: digital marketing fundamentals — 40 questions
        (20 MCQ, 10 short answer with model answers, 5 scenario, 5 true/false),
        every one with an explanation
  - [x] Hands-on lab: a buyer persona and funnel for Petal & Pine — 3 guided
        exercises with expected output, a template and a 12-point self-check
  - [x] Assignment: a one-page digital marketing brief (100-mark rubric table,
        pass 50, plus grade bands and deductions)
  - [x] Assessment: digital marketing fundamentals — 10 questions, pass mark 7/10
  - [x] No code: module 1 needs none. Code lives in modules 2, 3, 11, 15 and 17.
- [ ] **Module 02 — Website & Landing Page Fundamentals** (13 lessons: 9 teaching + 4 closing · code: HTML and CSS)
  - [ ] 9 teaching lessons written
  - [ ] Practice questions: websites and landing pages (7–10 questions + key)
  - [ ] Hands-on lab: build a landing page in HTML and CSS
  - [ ] Assignment: a landing page for Bright Mile Dental (100-mark rubric)
  - [ ] Assessment: websites and landing pages (short quiz)
- [ ] **Module 03 — SEO — Search Engine Optimization** (22 lessons: 18 teaching + 4 closing · code: JSON-LD)
  - [ ] 18 teaching lessons written
  - [ ] Practice questions: SEO (7–10 questions + key)
  - [ ] Hands-on lab: an SEO audit and keyword strategy
  - [ ] Assignment: an SEO audit report for Craftwise Academy (100-mark rubric)
  - [ ] Assessment: SEO (short quiz)
- [ ] **Module 04 — Content Marketing** (17 lessons: 13 teaching + 4 closing)
  - [ ] 13 teaching lessons written
  - [ ] Practice questions: content marketing (7–10 questions + key)
  - [ ] Hands-on lab: a 30-day content calendar
  - [ ] Assignment: a content plan for Shiftly (100-mark rubric)
  - [ ] Assessment: content marketing (short quiz)
- [ ] **Module 05 — Social Media Marketing** (18 lessons: 14 teaching + 4 closing)
  - [ ] 14 teaching lessons written
  - [ ] Practice questions: social media marketing (7–10 questions + key)
  - [ ] Hands-on lab: a social media strategy for a brand
  - [ ] Assignment: a 30-day social media plan for Petal & Pine (100-mark rubric)
  - [ ] Assessment: social media marketing (short quiz)
- [ ] **Module 06 — Social Media Advertising** (19 lessons: 15 teaching + 4 closing)
  - [ ] 15 teaching lessons written
  - [ ] Practice questions: social media advertising (7–10 questions + key)
  - [ ] Hands-on lab: a complete Meta Ads campaign structure
  - [ ] Assignment: a Meta Ads plan for Petal & Pine (100-mark rubric)
  - [ ] Assessment: social media advertising (short quiz)
- [ ] **Module 07 — Google Ads / PPC** (19 lessons: 15 teaching + 4 closing)
  - [ ] 15 teaching lessons written
  - [ ] Practice questions: Google Ads and PPC (7–10 questions + key)
  - [ ] Hands-on lab: build a Google Search Ads campaign
  - [ ] Assignment: a Google Ads plan for Bright Mile Dental (100-mark rubric)
  - [ ] Assessment: Google Ads and PPC (short quiz)
- [ ] **Module 08 — YouTube Marketing** (15 lessons: 11 teaching + 4 closing)
  - [ ] 11 teaching lessons written
  - [ ] Practice questions: YouTube marketing (7–10 questions + key)
  - [ ] Hands-on lab: a YouTube channel growth plan
  - [ ] Assignment: a channel launch plan for Craftwise Academy (100-mark rubric)
  - [ ] Assessment: YouTube marketing (short quiz)
- [ ] **Module 09 — Email Marketing** (20 lessons: 16 teaching + 4 closing)
  - [ ] 16 teaching lessons written
  - [ ] Practice questions: email marketing (7–10 questions + key)
  - [ ] Hands-on lab: build a five-email welcome sequence
  - [ ] Assignment: an email programme for Craftwise Academy (100-mark rubric)
  - [ ] Assessment: email marketing (short quiz)
- [ ] **Module 10 — WhatsApp & Conversational Marketing** (13 lessons: 9 teaching + 4 closing)
  - [ ] 9 teaching lessons written
  - [ ] Practice questions: WhatsApp and conversational marketing (7–10 questions + key)
  - [ ] Hands-on lab: design a WhatsApp lead-nurturing workflow
  - [ ] Assignment: a conversational funnel for Bright Mile Dental (100-mark rubric)
  - [ ] Assessment: WhatsApp and conversational marketing (short quiz)
- [ ] **Module 11 — Analytics & Measurement** (20 lessons: 16 teaching + 4 closing · code: UTM builder and spreadsheet formulas for ROI, ROAS, CAC, LTV and cohorts)
  - [ ] 16 teaching lessons written
  - [ ] Practice questions: analytics and measurement (7–10 questions + key)
  - [ ] Hands-on lab: build a digital marketing dashboard
  - [ ] Assignment: a monthly performance report for Petal & Pine (100-mark rubric)
  - [ ] Assessment: analytics and measurement (short quiz)
- [ ] **Module 12 — Conversion Rate Optimization (CRO)** (13 lessons: 9 teaching + 4 closing)
  - [ ] 9 teaching lessons written
  - [ ] Practice questions: conversion rate optimisation (7–10 questions + key)
  - [ ] Hands-on lab: analyse a landing page and propose improvements
  - [ ] Assignment: a CRO teardown for Shiftly (100-mark rubric)
  - [ ] Assessment: conversion rate optimisation (short quiz)
- [ ] **Module 13 — Influencer & Affiliate Marketing** (14 lessons: 10 teaching + 4 closing)
  - [ ] 10 teaching lessons written
  - [ ] Practice questions: influencer and affiliate marketing (7–10 questions + key)
  - [ ] Hands-on lab: an influencer campaign plan and outreach kit
  - [ ] Assignment: an influencer and affiliate programme for Petal & Pine (100-mark rubric)
  - [ ] Assessment: influencer and affiliate marketing (short quiz)
- [ ] **Module 14 — E-commerce Marketing** (15 lessons: 11 teaching + 4 closing)
  - [ ] 11 teaching lessons written
  - [ ] Practice questions: e-commerce marketing (7–10 questions + key)
  - [ ] Hands-on lab: a product page and merchandising teardown
  - [ ] Assignment: an e-commerce growth plan for Petal & Pine (100-mark rubric)
  - [ ] Assessment: e-commerce marketing (short quiz)
- [ ] **Module 15 — AI in Digital Marketing** (18 lessons: 14 teaching + 4 closing · code: Prompt templates, and optional Python for bulk content work)
  - [ ] 14 teaching lessons written
  - [ ] Practice questions: AI in digital marketing (7–10 questions + key)
  - [ ] Hands-on lab: build an AI-assisted marketing campaign
  - [ ] Assignment: an AI-assisted campaign for Shiftly (100-mark rubric)
  - [ ] Assessment: AI in digital marketing (short quiz)
- [ ] **Module 16 — Advanced SEO: AEO, GEO & AI Search** (16 lessons: 12 teaching + 4 closing)
  - [ ] 12 teaching lessons written
  - [ ] Practice questions: AEO, GEO and AI search (7–10 questions + key)
  - [ ] Hands-on lab: an AI-answer visibility audit
  - [ ] Assignment: an AEO and GEO plan for Craftwise Academy (100-mark rubric)
  - [ ] Assessment: AEO, GEO and AI search (short quiz)
- [ ] **Module 17 — Marketing Automation** (15 lessons: 11 teaching + 4 closing · code: Zapier and Make workflow blueprints, and webhook payloads)
  - [ ] 11 teaching lessons written
  - [ ] Practice questions: marketing automation (7–10 questions + key)
  - [ ] Hands-on lab: a lead-nurturing automation blueprint
  - [ ] Assignment: an automation build for Shiftly (100-mark rubric)
  - [ ] Assessment: marketing automation (short quiz)
- [ ] **Module 18 — Advanced Digital Marketing Strategy** (18 lessons: 14 teaching + 4 closing)
  - [ ] 14 teaching lessons written
  - [ ] Practice questions: advanced strategy (7–10 questions + key)
  - [ ] Hands-on lab: a one-page annual marketing strategy
  - [ ] Assignment: a 12-month strategy for Shiftly (100-mark rubric)
  - [ ] Assessment: advanced strategy (short quiz)
- [ ] **Module 19 — Freelancing & Digital Marketing Career** (19 lessons: 15 teaching + 4 closing)
  - [ ] 15 teaching lessons written
  - [ ] Practice questions: freelancing and career (7–10 questions + key)
  - [ ] Hands-on lab: build your portfolio and proposal kit
  - [ ] Assignment: a portfolio, proposal and rate card (100-mark rubric)
  - [ ] Assessment: freelancing and career (short quiz)
- [ ] **Module 20 — Capstone Project** (21 lessons: 17 teaching + 4 closing)
  - [ ] 17 teaching lessons written
  - [ ] Practice questions: capstone readiness (7–10 questions + key)
  - [ ] Hands-on lab: a capstone dry run
  - [ ] Assignment: the complete digital marketing capstone (100-mark rubric)
  - [ ] Assessment: capstone readiness (short quiz)
