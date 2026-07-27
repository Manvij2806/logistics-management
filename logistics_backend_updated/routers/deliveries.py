# ── DYNAMIC ETA AND GEOGRAPHY ESTIMATORS ──────────────────────────────────────

def get_address_offset_hours(pickup: str, drop: str) -> int:
    import re
    p_addr = (pickup or "").lower()
    d_addr = (drop or "").lower()

    p_pin = re.search(r"\b\d{6}\b", p_addr)
    d_pin = re.search(r"\b\d{6}\b", d_addr)
    
    if p_pin and d_pin:
        p_str, d_str = p_pin.group(), d_pin.group()
        if p_str[:2] != d_str[:2]:  # Different states
            return 96  # +4 days
            
    # City matching
    known_cities = ["delhi", "noida", "agra", "ghaziabad", "gurugram", "gurgaon", "mumbai", "pune"]
    p_city = next((c for c in known_cities if c in p_addr), None)
    d_city = next((c for c in known_cities if c in d_addr), None)

    if p_city and d_city and p_city != d_city:
        return 48  # +2 days (different cities)
        
    return 0


def calculate_dynamic_eta(delivery: Delivery) -> datetime:
    base_time = delivery.created_at if delivery.created_at else datetime.now(timezone.utc)
    priority_hours = {"express": 1, "high": 2, "normal": 4, "low": 8}
    p_lower = (delivery.priority or "normal").strip().lower()
    transit_hours = priority_hours.get(p_lower, 4)

    address_offset = get_address_offset_hours(delivery.pickup_address, delivery.drop_address)
    total_transit_hours = transit_hours + address_offset

    status_lower = (delivery.status or "").strip().lower()
    if status_lower == "delivered":
        return datetime.now(timezone.utc)
    elif status_lower == "out for delivery":
        return datetime.now(timezone.utc) + timedelta(hours=2)
    elif status_lower == "arrived at destination hub":
        return datetime.now(timezone.utc) + timedelta(hours=6)
    elif status_lower == "in transit (hub-to-hub)":
        elapsed_hours = 0
        if delivery.in_transit_at:
            elapsed_hours = max(0, (datetime.now(timezone.utc) - delivery.in_transit_at).total_seconds() / 3600)
        remaining_transit = max(6, total_transit_hours - elapsed_hours)
        return datetime.now(timezone.utc) + timedelta(hours=remaining_transit)

    return base_time + timedelta(hours=total_transit_hours)


# ── LOCKOUT & TRANSIT ENFORCEMENT (inside PATCH endpoint) ──────────────────────

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
        
    # (Existing authorization code...)

    if current_user.role and current_user.role.name.lower() != 'customer':
        # Gather values
        s_name = payload.sender_name if payload.sender_name is not None else delivery.sender_name
        s_phone = payload.sender_phone if payload.sender_phone is not None else delivery.sender_phone
        r_name = payload.recipient_name if payload.recipient_name is not None else delivery.recipient_name
        r_phone = payload.recipient_phone if payload.recipient_phone is not None else delivery.recipient_phone
        c_phone = payload.customer_phone if payload.customer_phone is not None else delivery.customer_phone
        validate_delivery_phones(db, s_name, s_phone, r_name, r_phone, c_phone)

        target_status = payload.status.value if payload.status is not None else delivery.status
        target_status_lower = target_status.lower() if target_status else ""
        
        is_intercity = get_address_offset_hours(
            payload.pickup_address if payload.pickup_address is not None else delivery.pickup_address,
            payload.drop_address if payload.drop_address is not None else delivery.drop_address
        ) > 0
        
        # Only validate agent lockout if the agent is actually changing or newly assigned
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
        
        # Clear agent if dispatched to hub-to-hub transit
        if target_status == "In Transit (Hub-to-Hub)":
            delivery.agent = None
            delivery.agent_id = None
            delivery.accepted = "Pending"
        else:
            if payload.agent is not None:
                delivery.agent = payload.agent
            if payload.agent_id is not None:
                delivery.agent_id = payload.agent_id

        # (Save other fields...)
        db.commit()