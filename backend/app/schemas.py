from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str
    model_config = ConfigDict(from_attributes=True)

class RoleChangeIn(BaseModel):
    role: str
    @field_validator("role")
    @classmethod
    def valid_role(cls, v):
        if v not in {"user", "admin"}: raise ValueError("Role must be 'user' or 'admin'")
        return v

class ProductIn(BaseModel):
    code: str = Field(default="", max_length=100)
    name: str = Field(min_length=1, max_length=180)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    stock: Decimal = Field(ge=0, max_digits=12, decimal_places=3)
    unit: str = "Piece"
    @field_validator("unit")
    @classmethod
    def valid_unit(cls, v):
        if v not in {"Piece", "kg", "g", "Litre", "ml"}: raise ValueError("Unsupported unit")
        return v

class ProductOut(ProductIn):
    id: int
    model_config = ConfigDict(from_attributes=True)

class ShopSettingsIn(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    address: str = Field(default="", max_length=500)
    phone: str = Field(default="", max_length=40)
    receipt_width: str = "80mm"
    receipt_font_size: int = Field(default=12, ge=8, le=24)
    @field_validator("receipt_width")
    @classmethod
    def valid_width(cls, v):
        if v not in {"58mm", "75mm", "80mm", "A4"}: raise ValueError("Unsupported receipt width")
        return v

class CheckoutItem(BaseModel):
    product_id: int
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)

class CheckoutIn(BaseModel):
    items: list[CheckoutItem] = Field(min_length=1, max_length=200)
    customer_name: str = Field(default="Walk-in Customer", max_length=180)
    customer_phone: str = Field(default="", max_length=40)
    discount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    payment_method: str
    @field_validator("payment_method")
    @classmethod
    def valid_payment(cls, v):
        if v not in {"Cash", "UPI/QR", "Card", "Credit (Khata)"}: raise ValueError("Unsupported payment method")
        return v

class InvoiceOut(BaseModel):
    id: int
    invoice_number: str
    customer_name: str
    customer_phone: str
    subtotal: Decimal
    discount: Decimal
    total: Decimal
    payment_method: str
    created_at: datetime
    items: list[dict]
