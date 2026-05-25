from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user
from database import get_db
from models import Order, OrderItem, Product, User
from schemas import CreateOrderRequest, OrderItemOut, OrderOut

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.post("", response_model=OrderOut)
async def create_order(
    body: CreateOrderRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new order with items. Calculates total from product prices."""
    if not body.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order must contain at least one item",
        )

    # Fetch all products referenced in the order
    product_ids = [item.product_id for item in body.items]
    result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products = {p.id: p for p in result.scalars().all()}

    # Validate all products exist
    for item in body.items:
        if item.product_id not in products:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {item.product_id} not found",
            )

    # Create order
    order = Order(
        user_id=user.id,
        vendor_id=body.vendor_id,
        delivery_type=body.delivery_type,
        delivery_address=body.delivery_address,
        status="pending",
        total=0,
    )
    db.add(order)
    await db.flush()  # get the order.id

    # Create order items and compute total
    total = 0.0
    order_items = []
    for item in body.items:
        product = products[item.product_id]
        unit_price = product.price
        order_item = OrderItem(
            order_id=order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=unit_price,
        )
        db.add(order_item)
        order_items.append(order_item)
        total += unit_price * item.quantity

    order.total = total
    await db.commit()
    await db.refresh(order)

    return OrderOut(
        id=order.id,
        vendor_id=order.vendor_id,
        delivery_type=order.delivery_type,
        delivery_address=order.delivery_address,
        status=order.status,
        total=order.total,
        items=[
            OrderItemOut(
                id=oi.id,
                product_id=oi.product_id,
                quantity=oi.quantity,
                unit_price=oi.unit_price,
            )
            for oi in order_items
        ],
        created_at=order.created_at.isoformat(),
    )


@router.get("")
async def list_orders(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all orders for the currently authenticated user."""
    result = await db.execute(
        select(Order)
        .where(Order.user_id == user.id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()

    return [
        OrderOut(
            id=o.id,
            vendor_id=o.vendor_id,
            delivery_type=o.delivery_type,
            delivery_address=o.delivery_address,
            status=o.status,
            total=o.total,
            items=[
                OrderItemOut(
                    id=oi.id,
                    product_id=oi.product_id,
                    quantity=oi.quantity,
                    unit_price=oi.unit_price,
                )
                for oi in o.items
            ],
            created_at=o.created_at.isoformat(),
        )
        for o in orders
    ]
