from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Product
from schemas import ProductListResponse, ProductOut

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=ProductListResponse)
async def list_products(
    category: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all active products with optional category and search filters."""
    query = select(Product).where(Product.is_active.is_(True))  # SQLAlchemy identity comparison

    if category:
        query = query.where(Product.category == category)

    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))

    query = query.order_by(Product.id)

    result = await db.execute(query)
    products = result.scalars().all()

    items = [
        ProductOut(
            id=p.id,
            name=p.name,
            description=p.description,
            category=p.category,
            price=p.price,
            stock=p.stock,
            unit=p.unit,
            image_urls=p.image_urls,
            is_active=p.is_active,
        )
        for p in products
    ]

    return ProductListResponse(items=items, total=len(items))
