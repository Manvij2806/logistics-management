"""
schemas.py - Pydantic models for Deliveries and Packages
"""
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class StatusEnum(str, Enum):
    created    = "Created"
    in_transit = "In Transit"
    picked_up  = "Picked Up"
    assigned   = "Assigned"
    pending    = "Pending"
    delivered  = "Delivered"
    cancelled  = "Cancelled"
    unassigned = "Unassigned"
    hub_transit = "In Transit (Hub-to-Hub)"
    dest_hub   = "Arrived at Destination Hub"
    origin_hub = "Arrived at Origin Hub"


class DeliveryCreate(BaseModel):
    pickup_address: str
    drop_address: str
    customer_name: str
    customer_phone: str
    status: Optional[StatusEnum] = StatusEnum.created
    agent: Optional[str] = None
    agent_id: Optional[int] = None
    notes: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_address: Optional[str] = None
    recipient_pincode: Optional[str] = None
    sender_name: Optional[str] = None
    sender_address: Optional[str] = None
    sender_pincode: Optional[str] = None
    sender_phone: Optional[str] = None
    recipient_phone: Optional[str] = None
    assigned_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    in_transit_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    estimated_delivery_at: Optional[datetime] = None

    package_description: Optional[str] = None
    package_weight: Optional[str] = None
    package_dimensions: Optional[str] = None
    priority: Optional[str] = "Normal"
    accepted: Optional[str] = "Pending"
    payment_status: Optional[str] = "Unpaid"
    payment_method: Optional[str] = None

    @field_validator("customer_phone")
    @classmethod
    def validate_phone(cls, v):
        digits = v.replace(" ", "").replace("-", "")
        if not digits.isdigit():
            raise ValueError("Phone number must contain digits only")
        if len(digits) != 10:
            raise ValueError("Phone number must be exactly 10 digits")
        return digits

    @field_validator("sender_phone", "recipient_phone")
    @classmethod
    def validate_other_phones(cls, v):
        if v is None:
            return v
        digits = v.replace(" ", "").replace("-", "")
        if not digits.isdigit():
            raise ValueError("Phone number must contain digits only")
        if len(digits) != 10:
            raise ValueError("Phone number must be exactly 10 digits")
        return digits

    @field_validator("customer_name")
    @classmethod
    def validate_name(cls, v):
        v = v.strip()
        if not v.replace(" ", "").isalpha():
            raise ValueError("Customer name must contain letters only")
        return v

    @field_validator("pickup_address", "drop_address")
    @classmethod
    def validate_address(cls, v):
        if not v or not v.strip():
            raise ValueError("Address cannot be empty")
        return v.strip()

    @model_validator(mode="after")
    def pickup_not_same_as_drop(self):
        if self.pickup_address and self.drop_address:
            if self.pickup_address.strip().lower() == self.drop_address.strip().lower():
                raise ValueError("Pickup address and drop address cannot be the same")
        return self


class DeliveryUpdate(BaseModel):
    """Partial update – all fields optional."""
    pickup_address: Optional[str] = None
    drop_address: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    status: Optional[StatusEnum] = None
    agent: Optional[str] = None
    agent_id: Optional[int] = None
    notes: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_address: Optional[str] = None
    recipient_pincode: Optional[str] = None
    sender_name: Optional[str] = None
    sender_address: Optional[str] = None
    sender_pincode: Optional[str] = None
    sender_phone: Optional[str] = None
    recipient_phone: Optional[str] = None
    assigned_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    in_transit_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    estimated_delivery_at: Optional[datetime] = None

    package_description: Optional[str] = None
    package_weight: Optional[str] = None
    package_dimensions: Optional[str] = None
    priority: Optional[str] = None
    accepted: Optional[str] = None
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None


class DeliveryResponse(BaseModel):
    id: int
    delivery_id: str
    tracking_number: Optional[str] = None
    pickup_address: str
    drop_address: str
    customer_name: str
    customer_phone: str
    status: str
    agent: Optional[str] = "Unassigned"
    agent_id: Optional[int] = None
    notes: str
    created_at: datetime
    recipient_name: Optional[str] = None
    recipient_address: Optional[str] = None
    recipient_pincode: Optional[str] = None
    sender_name: Optional[str] = None
    sender_address: Optional[str] = None
    sender_pincode: Optional[str] = None
    sender_phone: Optional[str] = None
    recipient_phone: Optional[str] = None
    verification_pin: Optional[str] = None
    assigned_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    in_transit_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    estimated_delivery_at: Optional[datetime] = None

    package_description: Optional[str] = None
    package_weight: Optional[str] = None
    package_dimensions: Optional[str] = None
    priority: Optional[str] = "Normal"
    accepted: Optional[str] = "Pending"
    payment_status: Optional[str] = "Unpaid"
    payment_method: Optional[str] = None
    agent_deactivating: Optional[bool] = False

    @model_validator(mode="after")
    def hide_unaccepted_agent(self):
        if self.accepted not in ("Accepted", "Acknowledged"):
            self.agent = "Unassigned"
            self.agent_id = None
        return self

    class Config:
        from_attributes = True


class DeliveryListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    deliveries: List[DeliveryResponse]


# ── Packages ──────────────────────────────────────────────────────────────────

class PackageCreate(BaseModel):
    description: Optional[str] = None
    weight: Optional[str] = None
    dimensions: Optional[str] = None
    delivery_id: Optional[int] = None


class PackageResponse(BaseModel):
    id: int
    package_id: str
    description: Optional[str] = None
    weight: Optional[str] = None
    dimensions: Optional[str] = None
    delivery_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True