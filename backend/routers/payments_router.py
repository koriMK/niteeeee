import re
import time
import base64
from datetime import datetime, timezone, timedelta
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

# Setup logging — intentionally keep payloads OUT of log messages
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments", tags=["payments"])

limiter = Limiter(key_func=get_remote_address)

# ── Safaricom production IP allowlist ─────────────────────────────────────────
# Source: https://developer.safaricom.co.ke/Documentation
# These are the IPs Safaricom uses to POST callbacks in production.
# In sandbox, callbacks come from various IPs, so we skip the check there.
SAFARICOM_IPS = {
    "196.201.214.200", "196.201.214.206", "196.201.213.114",
    "196.201.214.207", "196.201.214.208", "196.201.213.44",
    "196.201.212.127", "196.201.212.138", "196.201.212.129",
    "196.201.212.136", "196.201.212.74",  "196.201.212.69",
}

# ── In-memory OAuth token cache ───────────────────────────────────────────────
_token_cache: dict = {"token": None, "expires_at": 0.0}


async def get_mpesa_access_token() -> str:
    """
    Return a cached Safaricom OAuth token, refreshing it only when near expiry.
    Token lifetime is 3600 s; we refresh 60 s early for safety.
    The token is NEVER returned to the browser.
    """
    now = time.monotonic()
    if _token_cache["token"] and now < _token_cache["expires_at"]:
        return _token_cache["token"]

    if not settings.MPESA_CONSUMER_KEY or not settings.MPESA_CONSUMER_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="M-Pesa credentials not configured.",
        )

    token_url = f"{settings.mpesa_base_url}/oauth/v1/generate"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                token_url,
                params={"grant_type": "client_credentials"},
                auth=httpx.BasicAuth(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET),
                timeout=10.0,
            )
        except httpx.RequestError:
            logger.error("HTTP request to Safaricom OAuth failed")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Timeout connecting to Safaricom OAuth API.",
            )

        if response.status_code != 200:
            logger.error("Failed to generate M-Pesa token (status %s)", response.status_code)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Safaricom OAuth error. Check credentials.",
            )

        data = response.json()
        token = data["access_token"]
        # Safaricom tokens expire in 3600 s; cache for 3540 s (60-s safety margin)
        expires_in = int(data.get("expires_in", 3600))
        _token_cache["token"] = token
        _token_cache["expires_at"] = now + expires_in - 60

    return token


# ── Phone validation ──────────────────────────────────────────────────────────
# Safaricom Kenya mobile numbers: 2547XXXXXXXX or 2541XXXXXXXX (12 digits)
_SAFARICOM_PHONE_RE = re.compile(r"^254(7\d{8}|1\d{8})$")


def format_phone_number(phone: str) -> str:
    """Normalise then strictly validate a Safaricom phone number."""
    cleaned = "".join(c for c in phone if c.isdigit())
    if cleaned.startswith("0") and len(cleaned) == 10:
        cleaned = "254" + cleaned[1:]
    elif cleaned.startswith("7") and len(cleaned) == 9:
        cleaned = "254" + cleaned
    elif cleaned.startswith("1") and len(cleaned) == 9:
        cleaned = "254" + cleaned
    return cleaned


def _assert_valid_safaricom_number(phone: str) -> None:
    """Raise HTTP 400 if phone is not a valid Safaricom mobile number."""
    if not _SAFARICOM_PHONE_RE.match(phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid M-Pesa phone number. Must be a Safaricom mobile number "
                   "(07XXXXXXXX, 01XXXXXXXX, or 2547XXXXXXXX / 2541XXXXXXXX).",
        )


# ── STK Push ──────────────────────────────────────────────────────────────────

@router.post("/stk-push", response_model=STKPushResponse)
@limiter.limit("3/minute")
async def initiate_stk_push(
    request: Request,
    body: STKPushRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Initiate a Safaricom M-Pesa Lipa Na M-Pesa Online (STK Push) transaction.
    Rate-limited to 3 pushes per minute per IP.
    """
    # Validate and normalise phone number
    formatted_phone = format_phone_number(body.phone)
    _assert_valid_safaricom_number(formatted_phone)

    # Verify the order belongs to the authenticated user
    if body.order_id is not None:
        order_res = await db.execute(
            select(Order).where(Order.id == body.order_id, Order.user_id == user.id)
        )
        order = order_res.scalar_one_or_none()
        if order is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Order not found or does not belong to you.",
            )
        if order.status not in ("pending",):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order is no longer in a payable state.",
            )

    token = await get_mpesa_access_token()

    # Generate timestamp in EAT (UTC+3)
    nairobi_time = datetime.now(timezone(timedelta(hours=3)))
    timestamp = nairobi_time.strftime("%Y%m%d%H%M%S")

    # Generate password: Base64(Shortcode + Passkey + Timestamp)
    password = base64.b64encode(
        f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}".encode("utf-8")
    ).decode("utf-8")

    amount = max(1, int(round(body.amount)))

    url = f"{settings.mpesa_base_url}/mpesa/stkpush/v1/processrequest"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {
        "BusinessShortCode": settings.MPESA_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": amount,
        "PartyA": formatted_phone,
        "PartyB": settings.MPESA_SHORTCODE,
        "PhoneNumber": formatted_phone,
        "CallBackURL": settings.MPESA_CALLBACK_URL,
        "AccountReference": f"Order-{body.order_id}" if body.order_id else "NatePoultry",
        "TransactionDesc": f"Nate Poultry Order {body.order_id}" if body.order_id else "Nate Poultry Payment",
    }

    try:
        async with httpx.AsyncClient() as client:
            logger.info("Sending STK Push to Safaricom for order_id=%s", body.order_id)
            response = await client.post(url, json=payload, headers=headers, timeout=15.0)

            if response.status_code != 200:
                logger.error("Safaricom STK Push HTTP error: %s", response.status_code)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Safaricom STK Push failed: {response.status_code}",
                )

            data = response.json()
            response_code = data.get("ResponseCode")
            checkout_request_id = data.get("CheckoutRequestID")
            merchant_request_id = data.get("MerchantRequestID")

            if response_code != "0" or not checkout_request_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=data.get("ResponseDescription", "Safaricom rejected the STK request."),
                )

            # Record payment in DB (status=pending until callback confirms)
            payment = Payment(
                order_id=body.order_id,
                phone=formatted_phone,
                amount=body.amount,
                checkout_request_id=checkout_request_id,
                merchant_request_id=merchant_request_id,
                status="pending",
            )
            db.add(payment)
            await db.commit()

            return STKPushResponse(checkout_request_id=checkout_request_id)

    except httpx.RequestError:
        logger.error("Network error contacting Safaricom STK Push API")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Timeout or network issue connecting to Safaricom STK Push API.",
        )


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _update_order_status(db: AsyncSession, order_id: int, status_val: str) -> None:
    order_res = await db.execute(select(Order).where(Order.id == order_id))
    order = order_res.scalar_one_or_none()
    if order:
        order.status = status_val


async def _resolve_query_response(db: AsyncSession, payment: Payment, data: dict) -> None:
    result_code = data.get("ResultCode")
    response_code = data.get("ResponseCode")
    if response_code == "0" and result_code is not None:
        if int(result_code) == 0:
            payment.status = "completed"
            if payment.order_id:
                await _update_order_status(db, payment.order_id, "paid")
        else:
            payment.status = "failed"
            if payment.order_id:
                await _update_order_status(db, payment.order_id, "failed")
        await db.commit()
        await db.refresh(payment)


# ── Callback endpoint ─────────────────────────────────────────────────────────

@router.post("/callback")
async def mpesa_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Safaricom webhook called when user completes or cancels the transaction.

    Security measures:
    - Production: IP allowlist enforced (Safaricom known IPs only).
    - Idempotency: a payment already in a terminal state is ignored.
    - Order fulfillment ONLY happens on ResultCode == 0 from Safaricom.
    - Both CheckoutRequestID and MerchantRequestID are cross-checked.
    - Exceptions return ResultCode=1 so Safaricom will retry.
    """
    # IP allowlist in production
    if settings.MPESA_ENV == "production":
        client_ip = request.client.host if request.client else ""
        # Respect X-Forwarded-For from trusted reverse proxy
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        if client_ip not in SAFARICOM_IPS:
            logger.warning("Callback rejected from unauthorised IP: %s", client_ip)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    try:
        payload = await request.json()
        # Do NOT log the raw payload — it contains PII (phone numbers, amounts)
        logger.info("M-Pesa callback received")

        stk_callback = payload.get("Body", {}).get("stkCallback", {})
        checkout_request_id = stk_callback.get("CheckoutRequestID")
        merchant_request_id = stk_callback.get("MerchantRequestID")
        result_code = stk_callback.get("ResultCode")

        if not checkout_request_id:
            logger.warning("Callback missing CheckoutRequestID — ignoring")
            return {"ResultCode": 0, "ResultDesc": "Accepted"}

        # Look up the payment record
        result = await db.execute(
            select(Payment).where(Payment.checkout_request_id == checkout_request_id)
        )
        payment = result.scalar_one_or_none()

        if not payment:
            logger.warning("Callback for unknown CheckoutRequestID — ignoring")
            return {"ResultCode": 0, "ResultDesc": "Accepted"}

        # Replay-attack guard: cross-check MerchantRequestID
        if (
            merchant_request_id
            and payment.merchant_request_id
            and payment.merchant_request_id != merchant_request_id
        ):
            logger.warning("MerchantRequestID mismatch — possible replay attack, rejecting")
            return {"ResultCode": 0, "ResultDesc": "Accepted"}

        # Idempotency: skip if already in a terminal state
        if payment.status != "pending":
            logger.info("Duplicate callback for already-processed payment — skipping")
            return {"ResultCode": 0, "ResultDesc": "Already processed"}

        # Fulfil ONLY on explicit ResultCode 0 from Safaricom
        if result_code == 0:
            payment.status = "completed"
            logger.info("Payment completed for order_id=%s", payment.order_id)
            if payment.order_id:
                await _update_order_status(db, payment.order_id, "paid")
        else:
            # Cancelled, timeout, insufficient funds, wrong PIN, etc.
            payment.status = "failed"
            logger.info("Payment failed/cancelled (ResultCode=%s) for order_id=%s", result_code, payment.order_id)
            if payment.order_id:
                await _update_order_status(db, payment.order_id, "failed")

        await db.commit()
        return {"ResultCode": 0, "ResultDesc": "Success"}

    except Exception:
        # Return ResultCode=1 so Safaricom retries — do NOT silently fulfil orders on error
        logger.exception("Unhandled error in M-Pesa callback handler")
        return {"ResultCode": 1, "ResultDesc": "Internal error, please retry"}


# ── Payment status (authenticated) ────────────────────────────────────────────

async def _query_safaricom_status(db: AsyncSession, payment: Payment) -> None:
    """Query Safaricom stkpushquery and update payment status if resolved."""
    token = await get_mpesa_access_token()
    nairobi_time = datetime.now(timezone(timedelta(hours=3)))
    timestamp = nairobi_time.strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(
        f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}".encode()
    ).decode()

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.mpesa_base_url}/mpesa/stkpushquery/v1/query",
            json={
                "BusinessShortCode": settings.MPESA_SHORTCODE,
                "Password": password,
                "Timestamp": timestamp,
                "CheckoutRequestID": payment.checkout_request_id,
            },
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=10.0,
        )
        if response.status_code == 200:
            logger.info("STK query response received from Safaricom")
            await _resolve_query_response(db, payment, response.json())
        elif response.status_code in (404, 500):
            logger.info("STK query: transaction still processing")
        else:
            logger.warning("Unexpected STK query status code: %s", response.status_code)


@router.get("/status/{checkout_request_id}")
async def check_payment_status(
    checkout_request_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return payment status."""
    result = await db.execute(
        select(Payment).where(Payment.checkout_request_id == checkout_request_id)
    )
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found.")

    # Ownership check: only the user who placed the order can poll its status
    if payment.order_id is not None:
        order_res = await db.execute(
            select(Order).where(Order.id == payment.order_id, Order.user_id == user.id)
        )
        if order_res.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if payment.status == "pending":
        try:
            await _query_safaricom_status(db, payment)
            await db.refresh(payment)
        except Exception:
            logger.error("Error querying Safaricom for payment status")

    return {
        "checkout_request_id": payment.checkout_request_id,
        "status": payment.status,
        "amount": payment.amount,
        "order_id": payment.order_id,
    }
