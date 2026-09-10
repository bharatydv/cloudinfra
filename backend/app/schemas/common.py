from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class Message(BaseModel):
    message: str


class SeoMeta(BaseModel):
    """Everything a page needs to render correct head tags."""

    title: str
    description: str | None = None
    canonical_url: str | None = None
    og_image: str | None = None
    robots: str = "index,follow"
    breadcrumbs: list[Breadcrumb] = []
    structured_data: list[dict[str, Any]] = []


class Breadcrumb(BaseModel):
    name: str
    url: str


class TocEntry(BaseModel):
    level: int
    title: str
    anchor: str


class FaqItem(BaseModel):
    question: str
    answer: str


SeoMeta.model_rebuild()
