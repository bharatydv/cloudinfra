# -*- coding: utf-8 -*-
"""Audit the Digital Marketing course against COURSE_DIGITAL_MARKETING.md.

Checks coverage against the topic map, lesson structure, every quiz question,
prices and invented statistics, claims about real companies, hard-coded
credentials, and the hand-rolled renderer's constraints.

Read-only: it touches no database and writes no files.

    cd backend && python scripts/audit_course.py
"""

import io
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SEED = REPO / "database" / "seed" / "courses" / "digital-marketing-beginner-to-advanced"
DOC = REPO / "COURSE_DIGITAL_MARKETING.md"

doc = io.open(DOC, encoding="utf-8").read()
modules = []
# Module 21 is the reference pack: study plan, glossary, templates, cheat
# sheets, career roadmap and the level exams. None of it comes from the source
# outline, so it is excluded from the coverage and five-beat checks and audited
# only for quizzes, prices, claims and renderer constraints.
REFERENCE_MODULE = 21

for p in sorted(SEED.glob("module-*.json")):
    d = json.loads(io.open(p, encoding="utf-8").read())
    d["_file"] = p.name
    d["_n"] = int(p.stem.split("-")[1])
    modules.append(d)

mapped_modules = [m for m in modules if m["_n"] != REFERENCE_MODULE]

issues = []


def flag(kind, where, detail):
    issues.append((kind, where, detail))


# ---------------------------------------------------------------- 1. COVERAGE
print("=" * 72)
print("1. COVERAGE: topic map vs seed files")
print("=" * 72)

# Parse the topic map: ### Module N — Title, then | pdf topic | lesson |
sections = {}
cur = None
for line in doc.split("\n"):
    m = re.match(r"^### Module (\d+) ", line)
    if m:
        cur = int(m.group(1))
        sections[cur] = []
    elif cur and line.startswith("|") and "---" not in line:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 2 and cells[0] != "PDF topic":
            sections[cur].append((cells[0], cells[1]))

total_mapped = 0
for mod in mapped_modules:
    n = mod["_n"]
    mapped = sections.get(n, [])
    total_mapped += len(mapped)
    actual = [l["title"] for l in mod["lessons"]]
    doc_titles = [t for _, t in mapped]

    missing = [t for t in doc_titles if t not in actual]
    extra = [t for t in actual if t not in doc_titles]
    if missing:
        flag("COVERAGE", f"module {n:02d}", f"in the map but not in the seed: {missing}")
    if extra:
        flag("COVERAGE", f"module {n:02d}", f"in the seed but not in the map: {extra}")
    if doc_titles != actual:
        if not missing and not extra:
            flag("ORDER", f"module {n:02d}", "map and seed agree on titles but not order")

print(f"topic-map rows: {total_mapped}   "
      f"mapped lessons: {sum(len(m['lessons']) for m in mapped_modules)}   "
      f"reference lessons: {sum(len(m['lessons']) for m in modules if m['_n'] == REFERENCE_MODULE)}")
print(f"coverage mismatches: {len([i for i in issues if i[0] in ('COVERAGE','ORDER')])}")

# Closing four present, in order, in every taught module.
for mod in mapped_modules:
    n = mod["_n"]
    tail = [l["title"] for l in mod["lessons"][-4:]]
    expect = ["Practice questions:", "Hands-on lab:", "Assignment:", "Assessment:"]
    for got, want in zip(tail, expect):
        if not got.startswith(want):
            flag("STRUCTURE", f"module {n:02d}", f"closing four wrong: {tail}")
            break

# ------------------------------------------------------------------ 2. THIN
print()
print("=" * 72)
print("2. THIN TOPICS: word count per lesson")
print("=" * 72)
written, scaffold = [], []
for mod in modules:
    for l in mod["lessons"]:
        words = len(l["content"].split())
        rec = (mod["_n"], l["title"], words)
        (scaffold if "<!-- scaffold -->" in l["content"] else written).append(rec)

print(f"written lessons:  {len(written)}")
print(f"scaffold lessons: {len(scaffold)}")
if written:
    thin = [r for r in written if r[2] < 500 and not r[1].startswith(("Assessment:",))]
    print(f"written but under 500 words: {len(thin)}")
    for r in thin:
        flag("THIN", f"module {r[0]:02d}", f"{r[1]} is only {r[2]} words")

# Five beats in every written teaching lesson.
CLOSERS = ("Practice questions:", "Hands-on lab:", "Assignment:", "Assessment:")
BEATS = ["Learn", "Demo", "Hands-on practice", "Common mistakes", "Key takeaways"]
for mod in mapped_modules:
    for l in mod["lessons"]:
        if "<!-- scaffold -->" in l["content"] or l["title"].startswith(CLOSERS):
            continue
        heads = re.findall(r"^## (.+)$", l["content"], re.M)
        if heads[:5] != BEATS:
            flag("BEATS", f"module {mod['_n']:02d}", f"{l['title']}: headings are {heads}")
        # Analogy and diagram, per the guide.
        if "analog" not in l["content"].lower():
            flag("BEATS", f"module {mod['_n']:02d}", f"{l['title']}: no analogy")
        if "```" not in l["content"]:
            flag("BEATS", f"module {mod['_n']:02d}", f"{l['title']}: no diagram")

# ------------------------------------------------------------------ 3. QUIZ
print()
print("=" * 72)
print("3. QUIZZES: structure of every question")
print("=" * 72)
qcount = 0
for mod in modules:
    for l in mod["lessons"]:
        where = f"module {mod['_n']:02d} / {l['title'][:40]}"
        for block in re.findall(r"^:::quiz$(.*?)^:::$", l["content"], re.M | re.S):
            qs = re.split(r"^Q[.:]", block, flags=re.M)[1:]
            if not qs:
                flag("QUIZ", where, "quiz block with no questions")
            for q in qs:
                qcount += 1
                opts = re.findall(r"^([-+*])\s+(.*)$", q, re.M)
                correct = [t for s, t in opts if s != "-"]
                head = q.strip().split("\n")[0][:58]
                if len(opts) < 2:
                    flag("QUIZ", where, f"fewer than 2 options: {head}")
                if len(correct) == 0:
                    flag("QUIZ", where, f"no correct answer: {head}")
                if len(correct) > 1:
                    flag("QUIZ", where, f"{len(correct)} correct answers: {head}")
                if not re.search(r"^=", q, re.M):
                    flag("QUIZ", where, f"no explanation: {head}")
                for _, t in opts:
                    if "`" in t:
                        flag("QUIZ", where, f"backtick in option: {t[:40]}")
                    if not t.strip():
                        flag("QUIZ", where, f"empty option: {head}")
                # Duplicate option text.
                texts = [t.strip().lower() for _, t in opts]
                if len(set(texts)) != len(texts):
                    flag("QUIZ", where, f"duplicate options: {head}")
print(f"questions checked: {qcount}")

# ------------------------------------------------- 4. PRICES / STATS / BRANDS
print()
print("=" * 72)
print("4. PRICES, INVENTED STATISTICS, REAL-COMPANY CLAIMS")
print("=" * 72)

PRICE = re.compile(r"[$£€₹]\s?\d|\b\d+\s?(?:USD|GBP|EUR|INR|dollars|rupees|pounds)\b"
                   r"|\bper month\b|\bfree tier\b|\bfree plan\b|\bcosts? \d", re.I)
# A percentage or a large round number stated outside a fictional-brand plan.
STAT = re.compile(r"\b\d{1,3}(?:\.\d+)?\s?%|\b\d{1,3}x\b|\b\d{2,}(?:,\d{3})+\b")
# "Make" and "X" are tool names and also ordinary English words, so they are
# left out: they produce far more false positives than real findings.
REAL = ["Google", "Meta", "Facebook", "Instagram", "LinkedIn", "YouTube", "WhatsApp",
        "Semrush", "Ahrefs", "Mailchimp", "Brevo", "HubSpot", "Zoho", "Zapier",
        "Screaming Frog", "Looker", "Shopify", "Canva", "Adobe", "ChatGPT", "Gemini",
        "Copilot", "Claude", "Perplexity", "TikTok", "Excel", "WordPress"]
# Verbs that turn naming a tool into a claim about it.
CLAIM = re.compile(
    r"\b(" + "|".join(REAL) + r")\b[^.\n]{0,70}?\b(costs?|charges?|offers?|includes?|"
    r"guarantees?|is the best|outperforms?|beats?|allows you to \d|limits? you to|"
    r"has \d|supports? up to|free for)\b", re.I)

for mod in modules:
    for l in mod["lessons"]:
        where = f"module {mod['_n']:02d} / {l['title'][:40]}"
        body = l["content"]
        for m in PRICE.finditer(body):
            line = body[max(0, m.start() - 70): m.end() + 70].replace("\n", " ")
            flag("PRICE", where, f"...{line.strip()}...")
        for m in STAT.finditer(body):
            line = body[max(0, m.start() - 90): m.end() + 90].replace("\n", " ")
            flag("STAT?", where, f"...{line.strip()}...")
        for m in CLAIM.finditer(body):
            line = body[max(0, m.start() - 50): m.end() + 60].replace("\n", " ")
            flag("CLAIM?", where, f"...{line.strip()}...")
        # A promise is only a promise when it is not being warned against. The
        # course says "never guarantee a ranking" a lot, and flagging that every
        # run would train everyone to ignore this check.
        NEGATED = re.compile(
            r"\b(no|not|never|nobody|cannot|can't|do not|don't|without|"
            r"outside|against|avoid|refuse|anti)\b", re.I)
        for bad in ["guarantee", "you will rank", "you will earn",
                    "double your", "triple your", "proven to"]:
            for m in re.finditer(re.escape(bad), body, re.I):
                before = body[max(0, m.start() - 60): m.start()]
                after = body[m.end(): m.end() + 40]
                if NEGATED.search(before) or NEGATED.search(after):
                    continue
                line = body[max(0, m.start() - 60): m.end() + 60].replace("\n", " ")
                flag("PROMISE", where, f"...{line.strip()}...")

# ------------------------------------------------------------------ 5. CODE
print()
print("=" * 72)
print("5. CODE AND FORMULAS")
print("=" * 72)
CODE_LANG = re.compile(r"^```(\w+)", re.M)
fences = 0
for mod in modules:
    for l in mod["lessons"]:
        where = f"module {mod['_n']:02d} / {l['title'][:40]}"
        body = l["content"]
        fences += len(re.findall(r"^```", body, re.M))
        if len(re.findall(r"^```", body, re.M)) % 2:
            flag("CODE", where, "unbalanced code fence")
        for lang in CODE_LANG.findall(body):
            if lang.lower() == "mermaid":
                flag("CODE", where, "mermaid fence: renders as raw source")
        if "os.environ" not in body:
            for m in re.finditer(r"(api[_-]?key|secret|token)\s*=\s*[\"'][A-Za-z0-9]{8,}", body, re.I):
                flag("SECRET", where, f"hard-coded credential: {m.group(0)[:40]}")
        if "=SUM(" in body or "=IF(" in body or re.search(r"\n\s*[A-Z]+\s*=\s*[A-Z]", body):
            flag("FORMULA", where, "formula present - verify by hand")
print(f"code fences: {fences} (all ASCII diagrams in module 1; code modules are 2, 3, 11, 15, 17)")

# --------------------------------------------------------------- 6. RENDERER
print()
print("=" * 72)
print("6. RENDERER CONSTRAINTS")
print("=" * 72)
for mod in modules:
    for l in mod["lessons"]:
        where = f"module {mod['_n']:02d} / {l['title'][:40]}"
        body = l["content"]
        if "- [ ]" in body or "- [x]" in body:
            flag("RENDER", where, "task-list syntax renders literally")
        if re.search(r"^#\s", body, re.M):
            flag("RENDER", where, "h1 heading, which the renderer does not support")
        if re.search(r"^!\[", body, re.M):
            flag("RENDER", where, "image, which the renderer does not support")
        opens = len(re.findall(r"^:::\w", body, re.M))
        closes = len(re.findall(r"^:::$", body, re.M))
        if opens != closes:
            flag("RENDER", where, f"{opens} directive openers vs {closes} closers")
        # Table header without a separator row.
        lines = body.split("\n")
        fence = False
        for i, line in enumerate(lines[:-1]):
            if line.startswith("```"):
                fence = not fence
            if fence:
                continue
            if line.startswith("|") and not re.match(r"^\s*\|[\s:|-]+\|?\s*$", lines[i + 1]):
                if not re.match(r"^\s*\|[\s:|-]+\|?\s*$", line) and not (
                    i and re.match(r"^\s*\|[\s:|-]+\|?\s*$", lines[i - 1])
                ) and not (i > 1 and lines[i-1].startswith("|")):
                    flag("RENDER", where, f"table row with no separator: {line[:50]}")

# ------------------------------------------------------------------ REPORT
print()
print("=" * 72)
print("FINDINGS")
print("=" * 72)
by_kind = {}
for kind, where, detail in issues:
    by_kind.setdefault(kind, []).append((where, detail))
if not issues:
    print("none")
for kind in sorted(by_kind):
    rows = by_kind[kind]
    print(f"\n### {kind}  ({len(rows)})")
    for where, detail in rows[:40]:
        print(f"  {where:46s} {detail}")
    if len(rows) > 40:
        print(f"  ... and {len(rows) - 40} more")
