# Generative AI for Beginners — authoring guide

This file governs the **Generative AI for Beginners** course only. Everything
else in this repository follows the conventions already in `README.md`.

> The second course, **Digital Marketing — Beginner to Advanced**, has its own
> authoring guide in [COURSE_DIGITAL_MARKETING.md](COURSE_DIGITAL_MARKETING.md)
> and its own checklist in
> [PROGRESS_DIGITAL_MARKETING.md](PROGRESS_DIGITAL_MARKETING.md). Nothing in
> this file applies to it.

The course lives in the database like every other course on the site. It is
authored as JSON seed files and loaded by the seeder. There is no separate
content system, no new framework, and no change to the site design.

---

## Rules

### Audience

College students, MBA students, freshers, non-technical professionals, and
technical learners who want a practical start. Write for someone intelligent
who has never seen this material.

- Simple English. Short paragraphs. No paragraph longer than five lines.
- Real examples, not abstractions. "A bank deciding if a card transaction is
  fraud", not "a classification problem".
- Define a term the first time it appears. Never assume a previous module.
- No jargon for its own sake, and no mathematics beyond arithmetic.

### Method

**30% concepts, 70% hands-on.** Every teaching lesson follows the same four
beats, in this order, as `##` headings:

```
## Learn          the concept, in plain English
## Demonstrate    one worked, concrete example
## Practice       something the learner does before moving on
## What to remember   four or five bullets
```

Every **module** ends with exactly three lessons, in this order:

1. `Practice questions and answer key` — a `:::quiz` block, 7–10 questions
2. `Hands-on lab: <name>` — a lab the learner works through with tools open
3. `Assignment: <name>` — a deliverable, marked against a published rubric

Exempt from the four beats and the closing three: the six capstone briefs in
module 14, the two certification exams, and everything in module 15. Modules 5
and 13 carry their exam *after* the assignment, so their closing three are the
three lessons before it.

### Coverage

**Never skip a topic from the PDF.** The topic map below is the contract. Every
bullet from the source outline maps to exactly one lesson. If a lesson grows
too large, split it and update the map — do not drop a topic.

### Coding sections

Modules **2, 4, 9, 11, 12, 13 and 14** include coding work. Python only. Every
coding exercise carries all five of:

- **Starter code** with the signature, a docstring and `# Your code here`
- **A hint**, in a `:::hint` block, that points at the approach without giving it
- **A full solution**, in a `:::solution` block, with a short note on why it is
  written that way
- **Expected output**, shown as a fenced block so the learner can compare
- **A debugging exercise**: broken code with a stated number of bugs, its own
  hint and its own solution

**Never hard-code an API key.** Every example reads credentials from the
environment. Where a lesson shows key handling, show the safe pattern:

```python
import os

api_key = os.environ["OPENAI_API_KEY"]   # never a literal in the file
```

### Tool claims

Tools change monthly; a course cannot keep up and should not pretend to.

- **Never** state a price, a rate limit, a context-window size, a model version
  or a feature list as a fact.
- Instead: "check what the tool currently offers", "this changes often, verify
  before you rely on it".
- Naming a tool is fine. Ranking tools on figures that go stale is not.

### Design

Match the existing site exactly. Brand indigo is `brand-600` (`#4f46e5`) in
`frontend/tailwind.config.js`. No new colours, no new fonts, no new UI
library, no redesign of any existing page.

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

Plus three container directives, which is how a lesson embeds interactive parts.

### `:::quiz`

```
:::quiz
Q. Which of these best describes a token?
- A whole word, always
+ A chunk of text a model reads and writes
- A password
= Models read tokens, not characters or whole words.
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
:::hint Start by naming the variable
Any Markdown, including code fences.
:::

:::solution
Any Markdown, including code fences.
:::
```

Both collapse closed on every page load, deliberately: the point of a hint is
that the learner tries first. The text after the directive name becomes the
button label; omit it for the default "Hint" or "Solution".

A `:::` line inside a code fence is treated as content, not a terminator.

---

## File structure

```
database/seed/courses/generative-ai-for-beginners/
├── course.json        course row, outcomes, requirements, roadmap,
│                      certification levels, per-course FAQs
├── module-01.json     one file per module, lessons in array order
├── module-02.json
├── ... module-14.json
└── module-15.json     course reference: syllabus, glossary, cheat sheets
```

The seeder reads `course.json`, then every `module-NN.json` in filename order,
which is why the numbers are zero-padded. See `load_course_dirs()` in
`backend/app/seed/run.py`.

**Module numbers are load-bearing.** Positions are assigned by filename order,
and 157 lessons refer to each other by module number ("module 3 covered X").
Never insert a module in the middle, and never add a `module-00.json` -- either
would renumber everything and silently break every cross-reference. New
material goes at the end, or as extra lessons inside an existing module.

### Exams and reference material

Three lessons sit outside the usual module shape:

- **`Level 1 exam: GenAI Fundamentals`** -- the last lesson of module 5, after
  its assignment. Covers modules 1-5.
- **`Level 2 exam: GenAI Practitioner`** -- the last lesson of module 13.
  Covers modules 6-13.
- **Module 15** -- syllabus, glossary and four cheat sheets. Every lesson is a
  preview, so all of it is readable without enrolling.

Exams are 20 questions in a `:::quiz` block plus two applied tasks, marked out
of 40 with a stated pass mark -- not out of 100 like an assignment. Level 3 is
the module 14 capstone and has no separate exam.

### Lesson shape

```json
{
  "title": "Tokens and tokenization",
  "duration_minutes": 25,
  "is_preview": false,
  "description": "One line, shown on the preview page.",
  "content": "## Learn\n\n...",
  "resources": []
}
```

`is_preview: true` makes a lesson readable without an account, at
`/courses/generative-ai-for-beginners/preview/<lesson-slug>`. The slug is
generated from the title, so **renaming a lesson changes its URL and orphans
the old one**. Module 1's first three lessons are the previews.

### Loading it

```bash
cd backend
python -m app.seed.run          # idempotent: matches on slug, updates in place
```

The course is `"is_published": false` in `course.json` while it is being
written, so it stays out of the catalogue and the sitemap. Flip it to `true`
when the content is done.

---

## Code this course touches

Created:

- `frontend/src/components/learn/Quiz.tsx` — practice questions
- `frontend/src/components/learn/Disclosure.tsx` — hint and solution
- `frontend/src/pages/public/LessonPreviewPage.tsx` — public preview reader
- `backend/migrations/versions/c1f83a6d2e75_course_roadmap_and_levels.py`

Modified:

- `frontend/src/lib/markdown.tsx` — the three `:::` directives
- `frontend/src/pages/public/CoursesPage.tsx` — catalogue restored
- `frontend/src/pages/public/CourseDetailPage.tsx` — study plan and
  certification level sections, preview links
- `frontend/src/types/api.ts`, `frontend/src/App.tsx`, `frontend/src/lib/queryClient.ts`
- `backend/app/models/catalog.py`, `backend/app/schemas/catalog.py`,
  `backend/app/services/course_service.py`, `backend/app/services/seo_service.py`
- `backend/app/seed/run.py` — split course directories, per-course FAQs,
  `is_published` honoured from the seed row

Before committing frontend changes:

```bash
cd frontend && npm run typecheck && npm run lint
```

---

## Topic map

Every bullet from the source PDF, and the lesson that covers it. A topic with
no lesson beside it is a bug.

### Module 1 — Introduction to AI and Generative AI

| PDF topic | Lesson |
| --- | --- |
| What is Artificial Intelligence? | What artificial intelligence actually is |
| AI vs Machine Learning vs Deep Learning | AI, machine learning and deep learning |
| What is Generative AI? | What generative AI is |
| Generative AI vs Traditional AI | What generative AI is |
| Types of Generative AI: Text, Image, Audio, Video and Code | The five kinds of generative AI |
| Real-world applications | Where generative AI is already used |
| Limitations and challenges of GenAI | What generative AI gets wrong |

### Module 2 — How Generative AI Works *(coding)*

| PDF topic | Lesson |
| --- | --- |
| Introduction to neural networks | Neural networks without the mathematics |
| What are Large Language Models (LLMs)? | What a large language model is |
| Tokens and tokenization | Tokens and tokenization |
| Training vs inference | Training and inference |
| Parameters | Parameters and the context window |
| Context window | Parameters and the context window |
| Embeddings — beginner-friendly explanation | Embeddings, explained simply |
| What is a Transformer? | Transformers and attention |
| Attention mechanism — basic concept | Transformers and attention |
| Foundation models | Foundation models |

### Module 3 — Understanding LLMs

| PDF topic | Lesson |
| --- | --- |
| GPT | The main model families |
| Google Gemini | The main model families |
| Claude | The main model families |
| Llama | The main model families |
| Open-source vs proprietary models | Open-source and proprietary models |
| Model selection | Choosing a model for a job |
| Multimodal AI | Multimodal AI |
| Hallucinations | Hallucinations, in depth |
| Knowledge cutoff and model limitations | Knowledge cutoff and other limits |

### Module 4 — Prompt Engineering *(coding)*

| PDF topic | Lesson |
| --- | --- |
| What is a prompt? | What a prompt is |
| Anatomy of a good prompt | The anatomy of a good prompt |
| Zero-shot prompting | Zero-shot and few-shot prompting |
| Few-shot prompting | Zero-shot and few-shot prompting |
| Role prompting | Role prompting |
| Context + instruction + constraints | The anatomy of a good prompt |
| Chain-of-thought concept | Chain of thought |
| Structured output | Asking for structured output |
| Prompt templates | Prompt templates |
| Iterative prompting | Iterative prompting |
| Common prompting mistakes | Common prompting mistakes |
| Prompt evaluation | Evaluating a prompt |
| Practical exercises: marketing, research, resume, SQL/Python, data analysis | Five real prompts, start to finish |

### Module 5 — Generative AI Tools

| PDF topic | Lesson |
| --- | --- |
| ChatGPT | ChatGPT |
| Google Gemini | Google Gemini |
| Microsoft Copilot | Microsoft Copilot |
| Claude | Claude |
| Perplexity | Perplexity |
| NotebookLM | NotebookLM |
| GitHub Copilot | GitHub Copilot |
| For each tool: what it does, when to use it, demonstration, limitations | The four-beat structure of each tool lesson, plus Choosing between them |

### Module 6 — AI for Productivity

| PDF topic | Lesson |
| --- | --- |
| AI for students | AI for students |
| AI for research | AI for research |
| AI for presentations | AI for presentations |
| AI for Excel/Google Sheets | AI for spreadsheets |
| AI for Word/document creation | AI for documents |
| AI for email writing | AI for email |
| AI for meeting summaries | AI for meeting summaries |
| AI for brainstorming | AI for brainstorming |
| AI for learning | AI for learning |
| AI-powered search | AI-powered search |

### Module 7 — Generative AI for Images

| PDF topic | Lesson |
| --- | --- |
| How image generation works — basic concept | How image generation works |
| Text-to-image | Text-to-image |
| Image-to-image | Image-to-image |
| Prompting for images | Prompting for images |
| Style, composition, lighting and camera prompts | Style, composition, lighting and camera |
| Image editing | Editing an image |
| Creating posters and social media graphics | Posters and social media graphics |
| Example tools: ChatGPT image generation, Gemini, Canva AI, Adobe Firefly | The image tools |

### Module 8 — Generative AI for Video and Audio

| PDF topic | Lesson |
| --- | --- |
| Text-to-video | Text-to-video |
| Image-to-video | Image-to-video |
| AI avatars | AI avatars |
| AI voice generation | AI voice generation |
| AI music | AI music |
| Video script generation | Writing a video script |
| AI-assisted video editing | AI-assisted video editing |

### Module 9 — Generative AI for Coding *(coding)*

| PDF topic | Lesson |
| --- | --- |
| AI coding assistants | AI coding assistants |
| Code generation | Generating code |
| Code explanation | Explaining code |
| Debugging | Debugging with AI |
| Documentation | Documentation |
| GitHub Copilot | GitHub Copilot in practice |
| Practical project: build a simple website or Python application with AI | Project: a small application, built with AI |

### Module 10 — Responsible and Ethical AI

| PDF topic | Lesson |
| --- | --- |
| AI hallucination | Hallucination, revisited |
| Bias | Bias |
| Privacy | Privacy |
| Copyright | Copyright |
| Deepfakes | Deepfakes |
| Misinformation | Misinformation |
| Data security | Data security |
| Responsible prompting | Responsible prompting |
| Human verification | Human verification |
| When not to use AI | When not to use AI |

### Module 11 — Introduction to AI Agents *(coding)*

| PDF topic | Lesson |
| --- | --- |
| What is an AI agent? | What an AI agent is |
| AI chatbot vs AI agent | Chatbot versus agent |
| Tools and function calling | Tools and function calling |
| Memory | Memory |
| Planning | Planning |
| Agent workflow | An agent workflow end to end |
| Real-world examples | Agents in the wild |
| Agentic workflows and platforms: ChatGPT, Gemini, Microsoft Copilot Studio | Agentic platforms |

### Module 12 — Building a Simple GenAI Application *(coding)*

| PDF topic | Lesson |
| --- | --- |
| Project: AI Study Assistant | The project: an AI study assistant |
| API basics | API basics |
| API keys | API keys, and keeping them safe |
| Calling an LLM API | Calling an LLM API |
| System and user prompts | System and user prompts |
| Basic Python | Just enough Python |
| Simple UI with Streamlit | A simple interface with Streamlit |
| Deploying the application | Deploying it |

### Module 13 — RAG: Introduction *(coding)*

| PDF topic | Lesson |
| --- | --- |
| What is RAG? | What RAG is, and why it exists |
| Why do we need RAG? | What RAG is, and why it exists |
| Documents → chunks → embeddings → vector database → LLM | The RAG pipeline |
| RAG vs normal prompting | RAG versus plain prompting |
| Simple document Q&A application | Building a document question-answering app |
| Introduction to vector databases | Vector databases |

### Module 14 — Final Capstone Project *(coding)*

| PDF topic | Lesson |
| --- | --- |
| AI Study Assistant | Brief: AI study assistant |
| Resume & Interview Assistant | Brief: resume and interview assistant |
| PDF Question-Answering Bot | Brief: PDF question-answering bot |
| AI Marketing Assistant | Brief: AI marketing assistant |
| AI Customer Support Chatbot | Brief: AI customer support chatbot |
| AI Research Assistant | Brief: AI research assistant |

---

## The 8-week plan and the three certification levels

Both live in `course.json` as `roadmap` and `certification_levels`, and render
as their own sections on the course detail page. They come straight from the
source PDF:

| Week | Topics |
| --- | --- |
| 1 | AI + Generative AI fundamentals |
| 2 | LLMs + how GenAI works |
| 3 | Prompt engineering |
| 4 | ChatGPT, Gemini, Copilot and AI productivity |
| 5 | Image, video and audio generation |
| 6 | AI coding + AI agents |
| 7 | RAG + building GenAI applications |
| 8 | Capstone project + presentation |

| Level | Focus | Modules |
| --- | --- | --- |
| 1 — GenAI Fundamentals | AI, LLMs, GenAI tools and prompting | 1–5 |
| 2 — GenAI Practitioner | Productivity, image/video, coding, agents, RAG | 6–13 |
| 3 — GenAI Project | Build and present a working GenAI application | 14 |

These are completion certificates from this platform. They are **not** vendor
certifications, and no lesson should imply otherwise.
