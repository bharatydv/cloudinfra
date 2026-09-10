"""Slug, excerpt and reading-time helpers."""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable

from slugify import slugify as _slugify

WORDS_PER_MINUTE = 220
_MARKDOWN_NOISE = re.compile(r"[#*_`>\[\]()!]|https?://\S+")


def slugify(value: str, max_length: int = 200) -> str:
    return _slugify(value, max_length=max_length) or "untitled"


async def unique_slug(
    value: str,
    exists: Callable[[str], Awaitable[bool]],
    max_length: int = 200,
) -> str:
    """Append -2, -3 ... until `exists(slug)` returns False."""
    base = slugify(value, max_length=max_length)
    candidate = base
    suffix = 2
    while await exists(candidate):
        tail = f"-{suffix}"
        candidate = f"{base[: max_length - len(tail)]}{tail}"
        suffix += 1
    return candidate


def strip_markdown(content: str) -> str:
    return _MARKDOWN_NOISE.sub(" ", content)


def reading_minutes(content: str) -> int:
    words = len(strip_markdown(content).split())
    return max(1, round(words / WORDS_PER_MINUTE))


def build_excerpt(content: str, limit: int = 200) -> str:
    text = " ".join(strip_markdown(content).split())
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",.;:") + "..."


def extract_headings(markdown: str) -> list[dict[str, object]]:
    """Build a table of contents from H2/H3 markdown headings."""
    toc: list[dict[str, object]] = []
    in_code_fence = False
    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if line.startswith("```"):
            in_code_fence = not in_code_fence
            continue
        if in_code_fence:
            continue
        match = re.match(r"^(#{2,3})\s+(.*)$", line)
        if match:
            title = match.group(2).strip()
            toc.append(
                {"level": len(match.group(1)), "title": title, "anchor": slugify(title)}
            )
    return toc
