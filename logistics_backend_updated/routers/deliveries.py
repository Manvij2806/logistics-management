"""
routers/deliveries.py - Full CRUD for the deliveries table
"""
import random
import string
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel



from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db, Delivery, User
from schemas import DeliveryCreate, DeliveryResponse, DeliveryUpdate, DeliveryListResponse
from auth import require_role, get_current_user

router = APIRouter(
    prefix="/api/deliveries",
    tags=["Deliveries"],
    dependencies=[Depends(require_role("Admin", "Dispatcher", "Agent", "Customer"))],  # Allowed roles
)


def _gen_tracking() -> str:
    return "TRK" + "".join(random.choices(string.digits, k=7))


def get_address_offset_hours(pickup: str, drop: str) -> int:
    if not pickup or not drop:
        return 0
    import re
    p1 = re.findall(r'\b\d{6}\b', pickup)
    p2 = re.findall(r'\b\d{6}\b', drop)
    
    # Check by pincodes
    if p1 and p2:
        pin1, pin2 = p1[0], p2[0]
        if pin1[0] != pin2[0] or pin1[:2] != pin2[:2]:
            return 96 # different states (+4 days)
            
    # Check by city name text comparison
    def clean_words(addr: str):
        words = re.findall(r'[a-zA-Z]+', addr.lower())
        ignore = {'street', 'colony', 'road', 'plot', 'floor', 'near', 'opp', 'contact', 'phone', 'india', 'residency', 'professor'}
        return [w for w in words if w not in ignore and len(w) > 2]
        
    words1 = clean_words(pickup)
    words2 = clean_words(drop)
    
    cities = {'delhi', 'noida', 'gurugram', 'gurgaon', 'faridabad', 'ghaziabad', 'agra', 'mumbai', 'bangalore', 'bengaluru', 'chennai', 'kolkata', 'pune', 'hyderabad', 'jaipur', 'lucknow', 'kanpur'}
    
    city1 = next((w for w in words1 if w in cities), None)
    city2 = next((w for w in words2 if w in cities), None)
    
    if city1 and city2 and city1 != city2:
        state_map = {
            'delhi': 'delhi',
            'noida': 'up',
            'ghaziabad': 'up',
            'agra': 'up',
            'lucknow': 'up',
            'kanpur': 'up',
            'gurugram': 'haryana',
            'gurgaon': 'haryana',
            'faridabad': 'haryana',
        }
        st1 = state_map.get(city1)
        st2 = state_map.get(city2)
        if st1 and st2 and st1 != st2:
            return 96 # different states (+4 days)
        return 48 # different cities (+2 days)
        
    # Check string similarity/last parts
    parts1 = [p.strip().lower() for p in pickup.split(',')]
    parts2 = [p.strip().lower() for p in drop.split(',')]
    
    c1 = parts1[-2] if len(parts1) >= 2 else ""
    c2 = parts2[-2] if len(parts2) >= 2 else ""
    
    c1_clean = re.sub(r'\d+', '', c1).strip()
    c2_clean = re.sub(r'\d+', '', c2).strip()
    
    if c1_clean and c2_clean and c1_clean != c2_clean:
        return 48 # different cities (+2 days)
        
    return 0


def calculate_dynamic_eta(delivery: Delivery) -> datetime:
    start_time = delivery.assigned_at if delivery.assigned_at else (delivery.created_at or datetime.now(timezone.utc))
    
    offset_hours = get_address_offset_hours(delivery.pickup_address, delivery.drop_address)
    if offset_hours == 96:
        total_transit_hours = 84  # 3.5 days (different states)
    elif offset_hours == 48:
        total_transit_hours = 36  # 1.5 days (different cities, same state)
    else:
        total_transit_hours = 6   # 6 hours (same city)
        
    status_lower = delivery.status.lower() if delivery.status else ""
    now_utc = datetime.now(timezone.utc)
    
    if status_lower == "delivered":
        return delivery.delivered_at or now_utc
    elif status_lower == "out for delivery":
        return now_utc + timedelta(hours=2)
    elif "destination hub" in status_lower:
        return now_utc + timedelta(hours=6)
    elif "hub-to-hub" in status_lower:
        dispatch_time = delivery.in_transit_at or now_utc
        elapsed = (now_utc - dispatch_time).total_seconds() / 3600.0
        remaining = max(6, total_transit_hours - elapsed)
        return now_utc + timedelta(hours=remaining)
        
    return start_time + timedelta(hours=total_transit_hours)


def validate_delivery_phones(db: Session, sender_name: str, sender_phone: str, recipient_name: str, recipient_phone: str, customer_phone: str = None):
    # Normalize phone numbers
    s_phone = sender_phone.replace(" ", "").replace("-", "") if sender_phone else None
    r_phone = recipient_phone.replace(" ", "").replace("-", "") if recipient_phone else None
    c_phone = customer_phone.replace(" ", "").replace("-", "") if customer_phone else None

    # Check that sender and recipient phone numbers are not the same for two different users
    if s_phone and r_phone and s_phone == r_phone:
        if sender_name and recipient_name and sender_name.strip().lower() != recipient_name.strip().lower():
            raise HTTPException(
                status_code=400,
                detail="Sender phone number and Recipient phone number cannot be the same for two different users."
            )


    # Check sender phone
    if s_phone and s_phone != "0000000000":
        user = db.query(User).filter(User.phone_number == s_phone).first()
        if user:
            if user.role and user.role.name in ("Admin", "Agent"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Sender phone number {sender_phone} is registered to an {user.role.name} ({user.fullname}) and cannot be used."
                )
            if sender_name and sender_name.strip().lower() != user.fullname.strip().lower():
                raise HTTPException(
                    status_code=400,
                    detail=f"Sender phone number {sender_phone} is registered to '{user.fullname}'. Please enter the correct registered name."
                )

    # Check recipient phone
    if r_phone and r_phone != "0000000000":
        user = db.query(User).filter(User.phone_number == r_phone).first()
        if user:
            if user.role and user.role.name in ("Admin", "Agent"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Recipient phone number {recipient_phone} is registered to an {user.role.name} ({user.fullname}) and cannot be used."
                )
            if recipient_name and recipient_name.strip().lower() != user.fullname.strip().lower():
                raise HTTPException(
                    status_code=400,
                    detail=f"Recipient phone number {recipient_phone} is registered to '{user.fullname}'. Please enter the correct registered name."
                )

    # Check customer phone
    if c_phone and c_phone != "0000000000":
        user = db.query(User).filter(User.phone_number == c_phone).first()
        if user:
            if user.role and user.role.name in ("Admin", "Agent"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Customer phone number {customer_phone} is registered to an {user.role.name} ({user.fullname}) and cannot be used."
                )



def update_status_timestamps(delivery: Delivery, new_status: str):
    if not new_status:
        return
    status_lower = new_status.strip().lower()
    now = datetime.now(timezone.utc)
    
    if status_lower == "assigned" and delivery.assigned_at is None:
        delivery.assigned_at = now
    elif status_lower == "picked up" and delivery.picked_up_at is None:
        delivery.picked_up_at = now
    elif status_lower == "in transit" and delivery.in_transit_at is None:
        delivery.in_transit_at = now
    elif status_lower == "delivered" and delivery.delivered_at is None:
        delivery.delivered_at = now


def populate_agent_deactivating(res_d: DeliveryResponse, d: Delivery, db: Session):
    agent_user = None
    if d.agent_id:
        agent_user = db.query(User).filter(User.id == d.agent_id).first()
    if not agent_user and d.agent:
        agent_user = db.query(User).filter(User.fullname == d.agent, User.role_id == 2).first()
    if agent_user and getattr(agent_user, "deactivate_after_delivery", False):
        res_d.agent_deactivating = True
    else:
        res_d.agent_deactivating = False


# ── CREATE ────────────────────────────────────────────────────────────────────

@router.post("/", response_model=DeliveryResponse, status_code=201)
def create_delivery(
    payload: DeliveryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Dispatcher")),
):
    validate_delivery_phones(
        db,
        payload.sender_name,
        payload.sender_phone,
        payload.recipient_name,
        payload.recipient_phone,
        payload.customer_phone
    )
    last = db.query(Delivery).order_by(Delivery.id.desc()).first()

    next_num = (last.id + 1) if last else 1
    delivery_id = f"DEL-{str(next_num).zfill(3)}"

    while True:
        tracking_number = _gen_tracking()
        if not db.query(Delivery).filter(Delivery.tracking_number == tracking_number).first():
            break

    agent_id = payload.agent_id
    if payload.agent and not agent_id:
        agent_user = db.query(User).filter(User.fullname == payload.agent, User.role_id == 2).first()
        if agent_user:
            agent_id = agent_user.id

    new_delivery = Delivery(
        delivery_id=delivery_id,
        tracking_number=tracking_number,
        pickup_address=payload.pickup_address,
        drop_address=payload.drop_address,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        status=payload.status.value if payload.status else "Created",
        agent=payload.agent,
        agent_id=agent_id,
        accepted=payload.accepted if payload.accepted else "Pending",
        notes=payload.notes if payload.notes and payload.notes.strip() else "Notes are empty",
        recipient_name=payload.recipient_name,
        recipient_address=payload.recipient_address,
        recipient_pincode=payload.recipient_pincode,
        sender_name=payload.sender_name,
        sender_address=payload.sender_address,
        sender_pincode=payload.sender_pincode,
        sender_phone=payload.sender_phone,
        recipient_phone=payload.recipient_phone,
        package_description=payload.package_description,
        package_weight=payload.package_weight,
        package_dimensions=payload.package_dimensions,
        priority=payload.priority if payload.priority else "Normal",
        payment_status=payload.payment_status if payload.payment_status else "Unpaid",
        payment_method=payload.payment_method,
    )


    new_delivery.estimated_delivery_at = calculate_dynamic_eta(new_delivery)
    update_status_timestamps(new_delivery, new_delivery.status)
    db.add(new_delivery)
    db.commit()
    db.refresh(new_delivery)
    return new_delivery


# ── LIST (with pagination, search, status filter) ────────────────────────────

@router.get("/", response_model=DeliveryListResponse)
def list_deliveries(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Delivery)

    if current_user.role_id == 2 or (current_user.role and current_user.role.name == 'Agent'):
        query = query.filter(
            or_(Delivery.agent == current_user.fullname, Delivery.agent_id == current_user.id)
        )
    elif current_user.role and current_user.role.name.lower() == 'customer':
        query = query.filter(
            or_(
                Delivery.customer_phone == current_user.phone_number,
                Delivery.customer_name == current_user.fullname,
                Delivery.sender_name == current_user.fullname,
                Delivery.recipient_name == current_user.fullname,
                Delivery.sender_phone == current_user.phone_number,
                Delivery.recipient_phone == current_user.phone_number
            )
        )


    if status:
        query = query.filter(Delivery.status == status)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Delivery.delivery_id.ilike(pattern),
                Delivery.tracking_number.ilike(pattern),
                Delivery.customer_name.ilike(pattern),
                Delivery.customer_phone.ilike(pattern),
                Delivery.pickup_address.ilike(pattern),
                Delivery.drop_address.ilike(pattern),
                Delivery.agent.ilike(pattern),
                Delivery.sender_name.ilike(pattern),
                Delivery.recipient_name.ilike(pattern),
            )
        )

    total = query.count()
    deliveries = (
        query.order_by(Delivery.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Hide verification_pin from Agent users
    is_agent = current_user.role_id == 2 or (current_user.role and current_user.role.name == 'Agent')
    res_deliveries = []
    for d in deliveries:
        res_d = DeliveryResponse.from_orm(d)
        if is_agent:
            res_d.verification_pin = None
        populate_agent_deactivating(res_d, d, db)
        res_deliveries.append(res_d)

    return DeliveryListResponse(
        total=total,
        page=page,
        page_size=page_size,
        deliveries=res_deliveries,
    )



# ── GET ONE ───────────────────────────────────────────────────────────────────

@router.get("/{delivery_id}", response_model=DeliveryResponse)
def get_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    if current_user.role and current_user.role.name.lower() == 'customer':
        if (delivery.customer_phone != current_user.phone_number and 
            delivery.customer_name != current_user.fullname and
            delivery.sender_name != current_user.fullname and
            delivery.recipient_name != current_user.fullname and
            delivery.sender_phone != current_user.phone_number and
            delivery.recipient_phone != current_user.phone_number):
            raise HTTPException(status_code=403, detail="Not authorized to view this delivery")


    res_d = DeliveryResponse.from_orm(delivery)
    is_agent = current_user.role_id == 2 or (current_user.role and current_user.role.name == 'Agent')
    if is_agent:
        res_d.verification_pin = None
    populate_agent_deactivating(res_d, delivery, db)
    return res_d



# ── UPDATE (full replace) ─────────────────────────────────────────────────────

@router.put("/{delivery_id}", response_model=DeliveryResponse)
def update_delivery(
    delivery_id: int,
    payload: DeliveryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Dispatcher", "Agent")),
):
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    validate_delivery_phones(
        db,
        payload.sender_name,
        payload.sender_phone,
        payload.recipient_name,
        payload.recipient_phone,
        payload.customer_phone
    )


    delivery.pickup_address = payload.pickup_address
    delivery.drop_address   = payload.drop_address
    delivery.customer_name  = payload.customer_name
    delivery.customer_phone = payload.customer_phone
    new_status = payload.status.value if payload.status else delivery.status
    new_status_lower = new_status.lower() if new_status else ""
    is_intercity = get_address_offset_hours(delivery.pickup_address, delivery.drop_address) > 0
    # Check if agent is actually changing or newly assigned
    agent_is_changing = False
    if payload.agent != delivery.agent:
        agent_is_changing = True
    if payload.agent_id is not None and payload.agent_id != delivery.agent_id:
        agent_is_changing = True

    if is_intercity and agent_is_changing:
        if new_status_lower in ("picked up", "in transit (hub-to-hub)"):
            raise HTTPException(
                status_code=400,
                detail="For intercity/interstate shipments, a delivery agent can only be assigned once the package has arrived at the destination hub."
            )

    delivery.status = new_status

    if new_status == "In Transit (Hub-to-Hub)":
        delivery.agent = None
        delivery.agent_id = None
        delivery.accepted = "Pending"
    else:
        if payload.agent != delivery.agent:
            delivery.agent = payload.agent
            if payload.agent:
                agent_user = db.query(User).filter(User.fullname == payload.agent, User.role_id == 2).first()
                if agent_user:
                    delivery.agent_id = agent_user.id
                else:
                    delivery.agent_id = payload.agent_id
            else:
                delivery.agent_id = None
            delivery.accepted = "Pending"
        else:
            if payload.agent_id is not None:
                delivery.agent_id = payload.agent_id
            elif payload.agent and not delivery.agent_id:
                agent_user = db.query(User).filter(User.fullname == payload.agent, User.role_id == 2).first()
                if agent_user:
                    delivery.agent_id = agent_user.id
    
    delivery.notes          = payload.notes if payload.notes and payload.notes.strip() else "Notes are empty"
    delivery.recipient_name = payload.recipient_name
    delivery.recipient_address = payload.recipient_address
    delivery.recipient_pincode = payload.recipient_pincode
    delivery.sender_name = payload.sender_name
    delivery.sender_address = payload.sender_address
    delivery.sender_pincode = payload.sender_pincode
    delivery.sender_phone = payload.sender_phone
    delivery.recipient_phone = payload.recipient_phone
    delivery.package_description = payload.package_description

    delivery.package_weight = payload.package_weight
    delivery.package_dimensions = payload.package_dimensions
    delivery.priority = payload.priority if payload.priority else "Normal"
    
    delivery.estimated_delivery_at = calculate_dynamic_eta(delivery)
    delivery.payment_status = payload.payment_status if payload.payment_status else delivery.payment_status
    delivery.payment_method = payload.payment_method if payload.payment_method else delivery.payment_method

    update_status_timestamps(delivery, delivery.status)
    db.commit()
    db.refresh(delivery)
    
    res_d = DeliveryResponse.from_orm(delivery)
    is_agent = current_user.role_id == 2 or (current_user.role and current_user.role.name == 'Agent')
    if is_agent:
        res_d.verification_pin = None
    populate_agent_deactivating(res_d, delivery, db)
    return res_d



# ── PARTIAL UPDATE ────────────────────────────────────────────────────────────

@router.patch("/{delivery_id}", response_model=DeliveryResponse)
def patch_delivery(
    delivery_id: int,
    payload: DeliveryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    if payload.payment_method == "COD":
        agent_user = None
        if delivery.agent_id:
            agent_user = db.query(User).filter(User.id == delivery.agent_id).first()
        if not agent_user and delivery.agent:
            agent_user = db.query(User).filter(User.fullname == delivery.agent, User.role_id == 2).first()
        if agent_user and getattr(agent_user, "deactivate_after_delivery", False):
            raise HTTPException(status_code=400, detail="COD payment is not available for this delivery.")

    if current_user.role and current_user.role.name.lower() == 'customer':
        if (delivery.customer_phone != current_user.phone_number and 
            delivery.customer_name != current_user.fullname and
            delivery.sender_name != current_user.fullname and
            delivery.recipient_name != current_user.fullname and
            delivery.sender_phone != current_user.phone_number and
            delivery.recipient_phone != current_user.phone_number):
            raise HTTPException(status_code=403, detail="Not authorized to modify this delivery")

        
        if payload.payment_status is not None:
            delivery.payment_status = payload.payment_status
        if payload.payment_method is not None:
            delivery.payment_method = payload.payment_method
    else:
        if payload.accepted == 'Rejected':
            delivery.agent = None
            delivery.agent_id = None
            delivery.status = 'Created'
            delivery.accepted = 'Rejected'
        else:
            # Gather merged values for validation
            s_name = payload.sender_name if payload.sender_name is not None else delivery.sender_name
            s_phone = payload.sender_phone if payload.sender_phone is not None else delivery.sender_phone
            r_name = payload.recipient_name if payload.recipient_name is not None else delivery.recipient_name
            r_phone = payload.recipient_phone if payload.recipient_phone is not None else delivery.recipient_phone
            c_phone = payload.customer_phone if payload.customer_phone is not None else delivery.customer_phone
            validate_delivery_phones(db, s_name, s_phone, r_name, r_phone, c_phone)

            if payload.pickup_address is not None:

                delivery.pickup_address = payload.pickup_address
            if payload.drop_address is not None:
                delivery.drop_address = payload.drop_address
            if payload.customer_name is not None:
                delivery.customer_name = payload.customer_name
            if payload.customer_phone is not None:
                delivery.customer_phone = payload.customer_phone
            target_status = payload.status.value if payload.status is not None else delivery.status
            target_status_lower = target_status.lower() if target_status else ""
            
            is_intercity = get_address_offset_hours(
                payload.pickup_address if payload.pickup_address is not None else delivery.pickup_address,
                payload.drop_address if payload.drop_address is not None else delivery.drop_address
            ) > 0
            
            # Check if agent is actually changing or newly assigned
            agent_is_changing = False
            if payload.agent is not None and payload.agent != delivery.agent:
                agent_is_changing = True
            if payload.agent_id is not None and payload.agent_id != delivery.agent_id:
                agent_is_changing = True

            if is_intercity and agent_is_changing:
                if target_status_lower in ("picked up", "in transit (hub-to-hub)"):
                    raise HTTPException(
                        status_code=400,
                        detail="For intercity/interstate shipments, a delivery agent can only be assigned once the package has arrived at the destination hub."
                    )

            if payload.status is not None:
                delivery.status = payload.status.value
            
            if target_status == "In Transit (Hub-to-Hub)":
                delivery.agent = None
                delivery.agent_id = None
                delivery.accepted = "Pending"
            else:
                if payload.agent is not None:
                    delivery.agent = payload.agent
                if payload.agent_id is not None:
                    delivery.agent_id = payload.agent_id
            if payload.notes is not None:
                delivery.notes = payload.notes if payload.notes.strip() else "Notes are empty"
            if payload.recipient_name is not None:
                delivery.recipient_name = payload.recipient_name
            if payload.recipient_address is not None:
                delivery.recipient_address = payload.recipient_address
            if payload.recipient_pincode is not None:
                delivery.recipient_pincode = payload.recipient_pincode
            if payload.sender_name is not None:
                delivery.sender_name = payload.sender_name
            if payload.sender_address is not None:
                delivery.sender_address = payload.sender_address
            if payload.sender_pincode is not None:
                delivery.sender_pincode = payload.sender_pincode

            if payload.sender_phone is not None:
                delivery.sender_phone = payload.sender_phone
            if payload.recipient_phone is not None:
                delivery.recipient_phone = payload.recipient_phone
            if payload.package_description is not None:

                delivery.package_description = payload.package_description
            if payload.package_weight is not None:
                delivery.package_weight = payload.package_weight
            if payload.package_dimensions is not None:
                delivery.package_dimensions = payload.package_dimensions
            if payload.priority is not None:
                delivery.priority = payload.priority
            if payload.accepted is not None:
                delivery.accepted = payload.accepted
            if payload.payment_status is not None:
                delivery.payment_status = payload.payment_status
            if payload.payment_method is not None:
                delivery.payment_method = payload.payment_method

    delivery.estimated_delivery_at = calculate_dynamic_eta(delivery)
    update_status_timestamps(delivery, delivery.status)
    db.commit()
    db.refresh(delivery)
    
    res_d = DeliveryResponse.from_orm(delivery)
    is_agent = current_user.role_id == 2 or (current_user.role and current_user.role.name == 'Agent')
    if is_agent:
        res_d.verification_pin = None
    populate_agent_deactivating(res_d, delivery, db)
    return res_d



# ── OTP VERIFICATION ─────────────────────────────────────────────────────────

class VerifyOtpRequest(BaseModel):
    pin: str

@router.post("/{delivery_id}/request-otp", status_code=200)
def request_otp(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Dispatcher", "Agent")),
):
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    # Generate a random 6-digit PIN
    pin = "".join(random.choices(string.digits, k=6))
    delivery.verification_pin = pin
    db.commit()
    db.refresh(delivery)
    return {"message": "OTP PIN requested successfully.", "status": "success"}

@router.post("/{delivery_id}/verify-otp", status_code=200)
def verify_otp(
    payload: VerifyOtpRequest,
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Dispatcher", "Agent")),
):
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    if not delivery.verification_pin:
        raise HTTPException(status_code=400, detail="No verification PIN has been requested for this delivery.")

    if delivery.verification_pin != payload.pin.strip():
        raise HTTPException(status_code=400, detail="Invalid verification PIN. Access denied.")

    # Verification successful! Update status to Delivered and clear PIN
    delivery.status = "Delivered"
    delivery.verification_pin = None
    update_status_timestamps(delivery, "Delivered")

    # Deactivate agent if flagged for deactivation
    agent_user = None
    if delivery.agent_id:
        agent_user = db.query(User).filter(User.id == delivery.agent_id).first()
    if not agent_user and delivery.agent:
        agent_user = db.query(User).filter(User.fullname == delivery.agent, User.role_id == 2).first()

    if agent_user and getattr(agent_user, "deactivate_after_delivery", False):
        agent_user.status = "Inactive"
        agent_user.deactivate_after_delivery = False

    db.commit()
    db.refresh(delivery)
    return {"message": "Delivery verified and completed successfully.", "status": "success"}


# ── DELETE ────────────────────────────────────────────────────────────────────


@router.delete("/{delivery_id}", status_code=204)
def delete_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin", "Dispatcher")),
):
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    db.delete(delivery)
    db.commit()
    return None
