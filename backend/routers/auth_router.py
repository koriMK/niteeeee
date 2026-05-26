import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_pin,
    verify_pin,
    get_current_user,
)
from config import settings
from database import get_db
from models import User
from schemas import (
    AuthResponse,
    AuthUser,
    CheckPhoneRequest,
    CheckPhoneResponse,
    CreateAccountRequest,
    ForgotPinResponse,
    LoginRequest,
    RefreshTokenRequest,
    UpdateProfileRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def normalize_phone(raw: str) -> str:
    """Normalize a Kenyan phone number to +254XXXXXXXXX format."""
    digits = re.sub(r"\D", "", raw)
    # Handle various formats: 0712..., 254712..., +254712...
    if digits.startswith("0") and len(digits) == 10:
        digits = "254" + digits[1:]
    elif digits.startswith("254") and len(digits) == 12:
        pass  # already correct
    elif digits.startswith("7") and len(digits) == 9:
        digits = "254" + digits
    elif len(digits) == 12 and digits.startswith("254"):
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number format. Use 07XX XXX XXX",
        )
    return f"+{digits}"


@router.post("/check-phone", response_model=CheckPhoneResponse)
async def check_phone(body: CheckPhoneRequest, db: AsyncSession = Depends(get_db)):
    phone = normalize_phone(body.phone)
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()
    if user:
        return CheckPhoneResponse(exists=True, phone=phone, name=user.name)
    return CheckPhoneResponse(exists=False, phone=phone, name=None)


@router.post("/create-account", response_model=AuthResponse)
async def create_account(body: CreateAccountRequest, db: AsyncSession = Depends(get_db)):
    phone = normalize_phone(body.phone)

    # Check if user already exists
    result = await db.execute(select(User).where(User.phone == phone))
    existing = result.scalar_one_or_none()

    if existing:
        if body.name:
            existing.name = body.name
            await db.commit()
            await db.refresh(existing)
        return AuthResponse(
            access_token=create_access_token(existing.id),
            refresh_token=create_refresh_token(existing.id),
            user=AuthUser(id=existing.id, phone=existing.phone, name=existing.name),
        )

    # Create new user
    user = User(
        phone=phone,
        pin_hash=hash_pin(body.pin),
        name=body.name,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one()
    else:
        await db.refresh(user)

    return AuthResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=AuthUser(id=user.id, phone=user.phone, name=user.name),
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    phone = normalize_phone(body.phone)

    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()

    if not user or not verify_pin(body.pin, user.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or PIN",
        )

    return AuthResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=AuthUser(id=user.id, phone=user.phone, name=user.name),
    )


@router.get("/forgot-pin", response_model=ForgotPinResponse)
async def forgot_pin():
    return ForgotPinResponse(
        wa_link=f"https://wa.me/{settings.WHATSAPP_NUMBER}?text=Hi%2C%20I%20forgot%20my%20PIN.%20Please%20help%20me%20reset%20it."
    )


@router.post("/refresh-token", response_model=AuthResponse)
async def refresh_token(body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return AuthResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=AuthUser(id=user.id, phone=user.phone, name=user.name),
    )


@router.get("/me", response_model=AuthUser)
async def get_me(user: User = Depends(get_current_user)):
    """Fetch the profile of the currently logged-in user."""
    return AuthUser(id=user.id, phone=user.phone, name=user.name)


@router.put("/profile", response_model=AuthUser)
async def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the name of the currently logged-in user."""
    user.name = body.name
    await db.commit()
    await db.refresh(user)
    return AuthUser(id=user.id, phone=user.phone, name=user.name)
