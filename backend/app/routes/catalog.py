"""BigBasket product search endpoint."""
from fastapi import APIRouter, Query
from app.utils.bigbasket import catalog

router = APIRouter()


@router.get("/products/search")
def search_products(
    q: str   = Query("", description="Search query (min 2 chars)"),
    limit: int = Query(20, ge=1, le=50),
):
    """Search BigBasket catalog. Returns up to `limit` matching products."""
    if len(q.strip()) < 2:
        return []
    return catalog.search(q.strip(), limit=limit)
