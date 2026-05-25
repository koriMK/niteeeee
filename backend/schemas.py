from pydantic import BaseModel, Field


# ── Auth ──────────────────────────────────────────────────


class CheckPhoneRequest(BaseModel):
    phone: str


class CheckPhoneResponse(BaseModel):
    exists: bool
    phone: str
    name: str | None = None


class CreateAccountRequest(BaseModel):
    phone: str
    pin: str = Field(min_length=4, max_length=4)
    name: str | None = None


class LoginRequest(BaseModel):
    phone: str
    pin: str = Field(min_length=4, max_length=4)


class AuthUser(BaseModel):
    id: int
    phone: str
    name: str | None = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: AuthUser


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UpdateProfileRequest(BaseModel):
    name: str


class ForgotPinResponse(BaseModel):
    wa_link: str


# ── Products ──────────────────────────────────────────────


class ProductOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    category: str
    price: float
    stock: int
    unit: str
    image_urls: list[str] = []
    is_active: bool = True

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    items: list[ProductOut]
    total: int


# ── Orders ────────────────────────────────────────────────


class OrderItemPayload(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class CreateOrderRequest(BaseModel):
    vendor_id: int | None = None
    items: list[OrderItemPayload]
    delivery_type: str = "delivery"
    delivery_address: str | None = None


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    vendor_id: int | None
    delivery_type: str
    delivery_address: str | None
    status: str
    total: float
    items: list[OrderItemOut] = []
    created_at: str

    class Config:
        from_attributes = True


# ── Payments ──────────────────────────────────────────────


class STKPushRequest(BaseModel):
    phone: str
    amount: float
    order_id: int | None = None


class STKPushResponse(BaseModel):
    checkout_request_id: str
