from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.deps import DbSession
from app.models.enums import SearchEntity
from app.repositories import search_repo
from app.schemas.system import SearchResponse, SearchResult

router = APIRouter(tags=["Search"])


@router.get("/search", response_model=SearchResponse)
async def search(
    db: DbSession,
    q: str = Query("", description="Search query", max_length=200),
    types: list[SearchEntity] | None = Query(
        None, description="Restrict to specific result types"
    ),
    limit: int = Query(20, ge=1, le=50),
) -> SearchResponse:
    """Cross-entity search backed by PostgreSQL full-text search."""
    results, counts = await search_repo.search_all(
        db, q, types=[item.value for item in types] if types else None, limit=limit
    )
    return SearchResponse(
        query=q,
        total=sum(counts.values()),
        results=[SearchResult(**item) for item in results],
        counts=counts,
    )
