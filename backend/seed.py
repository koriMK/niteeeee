"""Seed the database with products matching the frontend's Products.tsx."""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Product

# Products data extracted from src/app/components/Products.tsx
SEED_PRODUCTS = [
    {
        "id": 1,
        "name": "Eggs Kienyeji",
        "category": "Fresh Eggs",
        "price": 650,
        "unit": "tray",
        "image_urls": ["https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600"],
        "description": "Farm-fresh kienyeji eggs, sold per tray.",
    },
    {
        "id": 2,
        "name": "Eggs Unfertilised",
        "category": "Fresh Eggs",
        "price": 480,
        "unit": "tray",
        "image_urls": ["https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600"],
        "description": "High-quality unfertilised eggs, sold per tray.",
    },
    {
        "id": 3,
        "name": "Broilers",
        "category": "Fresh Chicken",
        "price": 550,
        "unit": "whole",
        "image_urls": ["https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=600"],
        "description": "Whole broiler chicken, fresh daily.",
    },
    {
        "id": 4,
        "name": "Kienyeji",
        "category": "Fresh Chicken",
        "price": 600,
        "unit": "per kg",
        "image_urls": ["https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=600"],
        "description": "Free-range kienyeji chicken, sold per kg.",
    },
    {
        "id": 5,
        "name": "Beef",
        "category": "Beef",
        "price": 700,
        "unit": "per kg",
        "image_urls": ["https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600"],
        "description": "Premium quality beef, sold per kg.",
    },
    {
        "id": 6,
        "name": "Pork",
        "category": "Pork",
        "price": 700,
        "unit": "per kg",
        "image_urls": ["https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=600"],
        "description": "Fresh pork cuts, sold per kg.",
    },
    {
        "id": 7,
        "name": "Chevon (Goat Meat)",
        "category": "Chevon / Goat Meat",
        "price": 950,
        "unit": "per kg",
        "image_urls": ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
        "description": "Premium goat meat (chevon), sold per kg.",
    },
    {
        "id": 8,
        "name": "Minced Meat",
        "category": "Beef",
        "price": 800,
        "unit": "per kg",
        "image_urls": ["https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600"],
        "description": "Freshly minced beef, sold per kg.",
    },
    {
        "id": 9,
        "name": "Chicken Thigh Bone-in",
        "category": "Fresh Chicken",
        "price": 550,
        "unit": "per kg",
        "image_urls": ["https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=600"],
        "description": "Chicken thigh with bone, sold per kg.",
    },
    {
        "id": 10,
        "name": "Chicken Thigh Boneless",
        "category": "Fresh Chicken",
        "price": 600,
        "unit": "per kg",
        "image_urls": ["https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=600"],
        "description": "Boneless chicken thigh, sold per kg.",
    },
    {
        "id": 11,
        "name": "Chicken Gizzard",
        "category": "Fresh Chicken",
        "price": 550,
        "unit": "per kg",
        "image_urls": ["https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=600"],
        "description": "Chicken gizzards, sold per kg.",
    },
]


async def seed_products(db: AsyncSession) -> None:
    """Insert seed products if the products table is empty."""
    result = await db.execute(select(Product).limit(1))
    if result.scalar_one_or_none() is not None:
        return  # already seeded

    for p in SEED_PRODUCTS:
        product = Product(
            id=p["id"],
            name=p["name"],
            description=p.get("description"),
            category=p["category"],
            price=p["price"],
            stock=100,
            unit=p["unit"],
            image_urls_json=json.dumps(p.get("image_urls", [])),
            is_active=True,
        )
        db.add(product)

    await db.commit()
    print(f"✅ Seeded {len(SEED_PRODUCTS)} products")
