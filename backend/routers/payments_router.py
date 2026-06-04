"""
payments_router.py
──────────────────
Tuma REST API payment integration for Nate Poultry Meat.
All Safaricom Daraja / M-Pesa code has been removed.

Authentication flow:
  POST https://api.tuma.co.ke/auth/token
  body: { email, api_key }
  → returns { success, data: { token, ... } }

STK Push flow:
  POST https://api.tuma.co.ke/payment/stk-push
  headers: { Authorization: Bearer <token> }
  body: { amount, phone, callback_url, description }
  → returns { success, data: { checkout_request_id, merchant_request_id, ... } }
"""

import re
import time
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from auth import get_current_user
from config import settings
from database import get_db
from models import Order, Payment, User
from schemas import STKPushRequest, STKPushResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments", tags=["payments"])
limiter = Limiter(key_func=get_remote_address)

# ── Token cache ───────────────────────────────────────────────────────────────
_token_cache: dict = {"token": None, "expires_at": 0.0}


async def get_tuma_token() -> str:
    """
    Authenticate with the Tuma API and return a cached Bearer token.
    Token is refreshed automatically when near expiry.
    Credentials are read from environment variables — never hardcoded.
    """
    now = time.monotonic()
    if _token_cache["token"] and now < _token_cache["expires_at"]:
        return _token_cache["token"]

    if not settings.TUMA_EMAIL or not settings.TUMA_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tuma credentials (TUMA_EMAIL / TUMA_API_KEY) are not configured.",
        )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.TUMA_BASE_URL.rstrip('/')}/auth/token",
                json={"email": settings.TUMA_EMAIL, "api_key": settings.TUMA_API_KEY},
                timeout=10.0,
            )
    except httpx.RequestError:
        logger.error("Network error reaching Tuma auth endpoint")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Could not connect to Tuma authentication service.",
        )

    if response.status_code == 401:
        logger.error("Tuma auth rejected — invalid or expired API key")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Tuma authentication failed. Check TUMA_API_KEY.",
        )

    if response.status_code != 200:
        logger.error("Tuma auth returned unexpected status")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Tuma authentication service error.",
        )

    data = response.json()
    if not data.get("success"):
        logger.error("Tuma auth success=false")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=data.get("message", "Tuma authentication failed."),
        )

    token = data.get("data", {}).get("token")
    if not token:
        logger.error("Tuma auth response missing token")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Tuma auth response did not include a token.",
        )

    expires_in = int(data.get("data", {}).get("expires_in", 3600))
    _token_cache["token"] = token
    _token_cache["expires_at"] = now + expires_in - 60  # refresh 60s early
    return token


# ── Phone validation ──────────────────────────────────────────────────────────
_PHONE_RE = re.compile(r"^254(7\d{8}|1\d{8})$")


def normalize_phone(phone: str) -> str:
    """Normalize a Kenyan phone number to 254XXXXXXXXX format."""
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("0") and len(digits) == 10:
        return "254" + digits[1:]
    if (digits.startswith("7") or digits.startswith("1")) and len(digits) == 9:
        return "254" + digits
    if digits.startswith("254") and len(digits) == 12:
        return digits
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid phone number. Use format: 07XXXXXXXX or 254XXXXXXXXX",
    )


def _validate_phone(phone: str) -> None:
    if not _PHONE_RE.match(phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number must be a valid Kenyan mobile number (2547XXXXXXXX or 2541XXXXXXXX).",
        )


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _verify_order(db: AsyncSession, order_id: int, user_id: int) -> Order:
    res = await db.execute(select(Order).where(Order.id == order_id, Order.user_id == user_id))
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Order not found.")
    if order.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order is not payable.")
    return order


async def _update_order_status(db: AsyncSession, order_id: int, new_status: str) -> None:
    res = await db.execute(select(Order).where(Order.id == order_id))
    order = res.scalar_one_or_none()
    if order:
        order.status = new_status


# ── STK Push ──────────────────────────────────────────────────────────────────

@router.post("/stk-push", response_model=STKPushResponse)
@limiter.limit("3/minute")
async def initiate_stk_push(
    request: Request,
    body: STKPushRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate a Tuma STK Push payment request."""
    phone = normalize_phone(body.phone)
    _validate_phone(phone)

    if body.order_id is not None:
        await _verify_order(db, body.order_id, user.id)

    token = await get_tuma_token()
    amount = max(1, round(body.amount))
    local_ref = uuid.uuid4().hex

    callback_url = f"{settings.TUMA_CALLBACK_URL.rstrip('/')}?ref={local_ref}"

    try:
        async with httpx.AsyncClient() as client:
            logger.info("Initiating Tuma STK Push")
            response = await client.post(
                f"{settings.TUMA_BASE_URL.rstrip('/')}/payment/stk-push",
                json={
                    "amount": amount,
                    "phone": phone,
                    "callback_url": callback_url,
                    "description": (
                        f"Payment for Order #{body.order_id}"
                        if body.order_id is not None
                        else "Nate Poultry Meat payment"
                    ),
                },
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                timeout=15.0,
            )
    except httpx.RequestError:
        logger.error("Network error contacting Tuma STK Push API")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Could not connect to Tuma payment service.",
        )

    if response.status_code == 401:
        # Token expired mid-request — clear cache and tell client to retry
        _token_cache["token"] = None
        logger.error("Tuma STK Push returned 401 — token expired")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment token expired. Please try again.",
        )

    if response.status_code != 200:
        logger.error("Tuma STK Push returned non-200 status")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Tuma payment service error. Please try again.",
        )

    data = response.json()
    if not data.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=data.get("message", "Payment request rejected."),
        )

    resp_data = data.get("data", {})
    checkout_request_id = resp_data.get("checkout_request_id")
    merchant_request_id = resp_data.get("merchant_request_id")

    if not checkout_request_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Tuma response missing checkout_request_id.",
        )

    payment = Payment(
        order_id=body.order_id,
        phone=phone,
        amount=amount,
        checkout_request_id=checkout_request_id,
        merchant_request_id=str(merchant_request_id) if merchant_request_id else local_ref,
        status="pending",
    )
    db.add(payment)
    await db.commit()

    return STKPushResponse(checkout_request_id=checkout_request_id)


# ── Callback ──────────────────────────────────────────────────────────────────

@router.post("/callback")
async def tuma_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """Tuma webhook — called when a payment succeeds or fails."""
    try:
        payload = await request.json()
        logger.info("Tuma callback received")

        # Tuma sends checkout_request_id in query params or body
        checkout_request_id = (
            request.query_params.get("ref")
            or payload.get("checkout_request_id")
            or payload.get("reference")
        )
        success = payload.get("success") is True
        status_value = str(payload.get("status", "")).lower()
        result_code = payload.get("result_code")

        if result_code is not None:
            try:
                success = int(result_code) == 0
            except (TypeError, ValueError):
                pass

        if status_value == "completed":
            success = True
        elif status_value in ("failed", "cancelled"):
            success = False

        if not checkout_request_id:
            logger.warning("Tuma callback missing checkout_request_id")
            return {"success": True, "message": "Ignored"}

        res = await db.execute(
            select(Payment).where(Payment.checkout_request_id == checkout_request_id)
        )
        payment = res.scalar_one_or_none()

        if not payment:
            logger.warning("Tuma callback for unknown payment")
            return {"success": True, "message": "Ignored"}

        # Idempotency — skip already-resolved payments
        if payment.status != "pending":
            return {"success": True, "message": "Already processed"}

        if success:
            payment.status = "completed"
            logger.info("Payment completed")
            if payment.order_id:
                await _update_order_status(db, payment.order_id, "paid")
        else:
            payment.status = "failed"
            logger.info("Payment failed or cancelled")
            if payment.order_id:
                await _update_order_status(db, payment.order_id, "failed")

        await db.commit()
        return {"success": True, "message": "Processed"}

    except Exception:
        logger.exception("Unhandled error in Tuma callback")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal error.")


# ── Status polling ────────────────────────────────────────────────────────────

@router.get("/status/{checkout_request_id}")
async def check_payment_status(
    checkout_request_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Poll payment status by checkout_request_id."""
    res = await db.execute(
        select(Payment).where(Payment.checkout_request_id == checkout_request_id)
    )
    payment = res.scalar_one_or_none()

    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found.")

    return {
        "checkout_request_id": payment.checkout_request_id,
        "status": payment.status,
        "amount": payment.amount,
        "order_id": payment.order_id,
    }
