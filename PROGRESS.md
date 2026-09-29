# Generative AI for Beginners — progress

Tracks the build of the course. Authoring rules are in [CLAUDE.md](CLAUDE.md).

**Status:** structure complete, content in progress.
**155 lessons across 14 modules, roughly 68 hours.**
The course is `"is_published": false` until the content is written, so it is
absent from the catalogue and the sitemap.

A module is done when all of its teaching lessons are written **and** its three
closing lessons (quiz, lab, assignment) are written. A lesson still carrying the
`<!-- scaffold -->` marker is not written.

---

## Platform work

- [x] `roadmap` and `certification_levels` columns, with migration `c1f83a6d2e75`
- [x] Seeder loads split course directories, one file per module
- [x] Seeder honours `is_published` from the seed row
- [x] Seeder loads per-course FAQs under `course:<slug>`
- [x] `/courses` catalogue restored from the coming-soon placeholder
- [x] `/courses` back in the sitemap
- [x] Course detail page: suggested study plan section
- [x] Course detail page: certification levels section
- [x] Course detail page: preview and enrolled lessons link out
- [x] `Quiz` component — practice questions with answer key
- [x] `Disclosure` component — hint and solution
- [x] `:::quiz`, `:::hint`, `:::solution` in the Markdown renderer
- [x] Public preview reader at `/courses/:slug/preview/:lessonSlug`
- [x] `npm run typecheck` and `npm run lint` clean
- [x] Renderer verified against real lesson content (18 checks)
- [ ] Run the seeder against a database and click through the pages
- [ ] Decide whether preview lessons should be indexable (currently `noindex,follow`)
- [ ] Publish: flip `is_published` to `true` in `course.json`

## Course-level content

- [x] `course.json` — title, slug, category, level, price, icon
- [x] Short description and full description
- [x] 12 learning outcomes
- [x] 5 requirements / who it is for
- [x] 8-week roadmap
- [x] 3 certification levels
- [x] 6 course FAQs
- [x] SEO title and description
- [ ] Course thumbnail image (currently falls back to the generated cover)
- [ ] Link to related certifications, if any apply

---

## Modules

### Module 1 — Introduction to AI and Generative AI — **done** (9 lessons)

- [x] What artificial intelligence actually is *(preview)*
- [x] AI, machine learning and deep learning *(preview)*
- [x] What generative AI is *(preview)*
- [x] The five kinds of generative AI
- [x] Where generative AI is already used
- [x] What generative AI gets wrong
- [x] Practice questions and answer key — 7 questions
- [x] Hands-on lab: your first generative AI session
- [x] Assignment: an honest AI audit — rubric out of 100

### Module 2 — How Generative AI Works *(coding)* — **done** (11 lessons)

- [x] Neural networks without the mathematics
- [x] What a large language model is
- [x] Tokens and tokenization — *reference lesson for coding sections*
- [x] Training and inference
- [x] Parameters and the context window
- [x] Embeddings, explained simply
- [x] Transformers and attention
- [x] Foundation models
- [x] Practice questions and answer key
- [x] Hands-on lab: measuring tokens, context and similarity
- [x] Assignment: explain a model to a non-technical audience

### Module 3 — Understanding LLMs — **done** (9 lessons)

- [x] The main model families
- [x] Open-source and proprietary models
- [x] Choosing a model for a job
- [x] Multimodal AI
- [x] Hallucinations, in depth
- [x] Knowledge cutoff and other limits
- [x] Practice questions and answer key
- [x] Hands-on lab: one prompt, four models
- [x] Assignment: a model selection brief

### Module 4 — Prompt Engineering *(coding)* — **done** (14 lessons)

- [x] What a prompt is
- [x] The anatomy of a good prompt
- [x] Zero-shot and few-shot prompting
- [x] Role prompting
- [x] Chain of thought
- [x] Asking for structured output
- [x] Prompt templates
- [x] Iterative prompting
- [x] Common prompting mistakes
- [x] Evaluating a prompt
- [x] Five real prompts, start to finish
- [x] Practice questions and answer key
- [x] Hands-on lab: building a reusable prompt template
- [x] Assignment: a prompt library with evaluations

### Module 5 — Generative AI Tools — **done** (12 lessons)

- [x] ChatGPT
- [x] Google Gemini
- [x] Microsoft Copilot
- [x] Claude
- [x] Perplexity
- [x] NotebookLM
- [x] GitHub Copilot
- [x] Choosing between them
- [x] Practice questions and answer key
- [x] Hands-on lab: the same task across three tools
- [x] Assignment: a tool comparison for a real need
- [x] Level 1 exam: GenAI Fundamentals

### Module 6 — AI for Productivity — **done** (13 lessons)

- [x] AI for students
- [x] AI for research
- [x] AI for presentations
- [x] AI for spreadsheets
- [x] AI for documents
- [x] AI for email
- [x] AI for meeting summaries
- [x] AI for brainstorming
- [x] AI for learning
- [x] AI-powered search
- [x] Practice questions and answer key
- [x] Hands-on lab: automating one real weekly task
- [x] Assignment: a personal productivity workflow

### Module 7 — Generative AI for Images — **done** (11 lessons)

- [x] How image generation works
- [x] Text-to-image
- [x] Image-to-image
- [x] Prompting for images
- [x] Style, composition, lighting and camera
- [x] Editing an image
- [x] Posters and social media graphics
- [x] The image tools
- [x] Practice questions and answer key
- [x] Hands-on lab: a poster from brief to final
- [x] Assignment: a visual identity for a small project

### Module 8 — Generative AI for Video and Audio — **done** (10 lessons)

- [x] Text-to-video
- [x] Image-to-video
- [x] AI avatars
- [x] AI voice generation
- [x] AI music
- [x] Writing a video script
- [x] AI-assisted video editing
- [x] Practice questions and answer key
- [x] Hands-on lab: a sixty-second explainer
- [x] Assignment: a short video with a disclosure statement

### Module 9 — Generative AI for Coding *(coding)* — **done** (10 lessons)

- [x] AI coding assistants
- [x] Generating code
- [x] Explaining code
- [x] Debugging with AI
- [x] Documentation
- [x] GitHub Copilot in practice
- [x] Project: a small application, built with AI
- [x] Practice questions and answer key
- [x] Hands-on lab: fix four broken programs
- [x] Assignment: build and document a small tool

### Module 10 — Responsible and Ethical AI — **done** (13 lessons)

- [x] Hallucination, revisited
- [x] Bias
- [x] Privacy
- [x] Copyright
- [x] Deepfakes
- [x] Misinformation
- [x] Data security
- [x] Responsible prompting
- [x] Human verification
- [x] When not to use AI
- [x] Practice questions and answer key
- [x] Hands-on lab: auditing an AI output for harm
- [x] Assignment: an AI use policy for a real group

### Module 11 — Introduction to AI Agents *(coding)* — **done** (11 lessons)

- [x] What an AI agent is
- [x] Chatbot versus agent
- [x] Tools and function calling
- [x] Memory
- [x] Planning
- [x] An agent workflow end to end
- [x] Agents in the wild
- [x] Agentic platforms
- [x] Practice questions and answer key
- [x] Hands-on lab: an agent with two tools
- [x] Assignment: design an agent for a real task

### Module 12 — Building a Simple GenAI Application *(coding)* — **done** (11 lessons)

- [x] The project: an AI study assistant
- [x] API basics
- [x] API keys, and keeping them safe
- [x] Calling an LLM API
- [x] System and user prompts
- [x] Just enough Python
- [x] A simple interface with Streamlit
- [x] Deploying it
- [x] Practice questions and answer key
- [x] Hands-on lab: build the study assistant
- [x] Assignment: extend and deploy your assistant

### Module 13 — RAG: Introduction *(coding)* — **done** (9 lessons)

- [x] What RAG is, and why it exists
- [x] The RAG pipeline
- [x] RAG versus plain prompting
- [x] Vector databases
- [x] Building a document question-answering app
- [x] Practice questions and answer key
- [x] Hands-on lab: RAG over your own notes
- [x] Assignment: a document assistant with citations
- [x] Level 2 exam: GenAI Practitioner

### Module 14 — Final Capstone Project *(coding)* — **done** (14 lessons)

- [x] Choosing your capstone
- [x] Brief: AI study assistant
- [x] Brief: resume and interview assistant
- [x] Brief: PDF question-answering bot
- [x] Brief: AI marketing assistant
- [x] Brief: AI customer support chatbot
- [x] Brief: AI research assistant
- [x] Scoping and planning
- [x] Building it
- [x] Testing and documenting
- [x] Presenting your work
- [x] Practice questions and answer key
- [x] Hands-on lab: the build sprint
- [x] Assignment: capstone submission and presentation

### Module 15 — Course reference — **done** (6 lessons)

- [x] Syllabus *(preview)*
- [x] Glossary *(preview)*
- [x] Cheat sheet: prompt engineering *(preview)*
- [x] Cheat sheet: image and video prompting *(preview)*
- [x] Cheat sheet: code, APIs and RAG *(preview)*
- [x] Cheat sheet: responsible use and verification *(preview)*
---

## Extras

Done:

- [x] Syllabus — module 15, preview
- [x] Glossary — module 15, preview, ~90 terms with the module that defines each
- [x] Cheat sheet: prompt engineering — module 15, preview
- [x] Cheat sheet: image and video prompting — module 15, preview
- [x] Cheat sheet: code, APIs and RAG — module 15, preview
- [x] Cheat sheet: responsible use and verification — module 15, preview
- [x] Level 1 exam — end of module 5, 20 questions + 2 applied tasks, 28/40 to pass
- [x] Level 2 exam — end of module 13, 20 questions + 2 applied tasks, 28/40 to pass
- [x] Level 3 — the module 14 capstone, already in place
- [x] Decide which lessons should be previews — module 1's first three, plus all of module 15
- [x] Check no stale claim crept in — automated, `0 flags` across all modules
- [x] Review every coding lesson for a hard-coded key — automated, in the audit

Outstanding:

- [ ] Course thumbnail image
- [ ] Downloadable prompt-library template (module 4 assignment)
- [ ] Starter repository for the module 12 Streamlit application
- [ ] Sample documents for the module 13 RAG lab
- [ ] Capstone presentation template (module 14)
- [ ] Per-lesson `resources` links — currently empty on every lesson
- [ ] Re-check named tools before each publish, since that one does go stale

---

## Counts

| Module | Lessons | Written |
| --- | ---: | ---: |
| 1 — Introduction to AI and Generative AI | 9 | 9 |
| 2 — How Generative AI Works | 11 | 11 |
| 3 — Understanding LLMs | 9 | 9 |
| 4 — Prompt Engineering | 14 | 14 |
| 5 — Generative AI Tools | 12 | 12 |
| 6 — AI for Productivity | 13 | 13 |
| 7 — Generative AI for Images | 11 | 11 |
| 8 — Generative AI for Video and Audio | 10 | 10 |
| 9 — Generative AI for Coding | 10 | 10 |
| 10 — Responsible and Ethical AI | 13 | 13 |
| 11 — Introduction to AI Agents | 11 | 11 |
| 12 — Building a Simple GenAI Application | 11 | 11 |
| 13 — RAG: Introduction | 9 | 9 |
| 14 — Final Capstone Project | 14 | 14 |
| 15 — Course reference | 6 | 6 |
| **Total** | **163** | **163** |
