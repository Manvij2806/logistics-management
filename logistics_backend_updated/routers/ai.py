from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
import json
import urllib.request
import urllib.error
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from database import get_db, Delivery, User, ChatSession, ChatMessage, Role
from auth import get_current_user
from auth_utils import hash_password
from pydantic import BaseModel
from typing import Optional

router = APIRouter(
    prefix="/api/ai",
    tags=["AI Chatbot"],
)

class ChatRequest(BaseModel):
    question: str

# ── OLLAMA CONNECTIVITY HELPERS ──────────────────────────────────────────────

def get_installed_ollama_models() -> list:
    """Query the local Ollama instance for installed models."""
    try:
        req = urllib.request.Request("http://localhost:11434/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return [m["name"] for m in data.get("models", [])]
    except Exception:
        return []

def call_ollama(model_name: str, messages: list, tools: list = None) -> dict:
    """Post chat query to local Ollama server."""
    url = "http://localhost:11434/api/chat"
    payload = {
        "model": model_name,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.2
        }
    }
    if tools and any(t in model_name.lower() for t in ["qwen2.5", "llama3.1", "llama3.2"]):
        payload["tools"] = tools

    headers = {"Content-Type": "application/json"}
    try:
        req_obj = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req_obj, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as e:
        raise Exception(f"Ollama server offline: {e}")
    except Exception as e:
        raise Exception(f"Ollama invocation failed: {e}")


# ── SECURE ROLE-BASED TOOLS (RBAC) ──────────────────────────────────────────

ALLOWED_TOOLS = {
    "CUSTOMER": [
        "get_my_deliveries", "get_delivery_status", "calculate_delivery_price", 
        "create_delivery", "request_reschedule", "create_ticket"
    ],
    "AGENT": [
        "get_my_deliveries", "get_delivery_status", "get_delivery_details",
        "mark_picked_up", "mark_in_transit", "mark_out_for_delivery", 
        "mark_delivered", "mark_failed", "report_delivery_issue"
    ],
    "DISPATCHER": [
        "get_delivery_status", "get_delivery_details", "get_available_agents", 
        "get_agent_workload", "get_pending_deliveries", "get_delivery_history", 
        "calculate_delivery_price", "create_delivery", "assign_delivery", "reassign_delivery",
        "cancel_delivery", "notify_agent"
    ],
    "ADMIN": [
        "get_delivery_status", "get_delivery_details", "get_available_agents", 
        "get_agent_workload", "get_pending_deliveries", "get_delivery_history", 
        "get_dashboard_statistics", "calculate_delivery_price", "get_users_list", 
        "get_user_details", "create_user", "update_user", "delete_user",
        "create_delivery", "assign_delivery", "reassign_delivery", "cancel_delivery",
        "mark_picked_up", "mark_in_transit", "mark_out_for_delivery", 
        "mark_delivered", "mark_failed", "report_delivery_issue", "request_reschedule",
        "create_ticket", "get_delivery_metrics", "get_failure_metrics", "get_agent_metrics",
        "get_revenue_metrics"
    ]
}

def execute_tool(tool_name: str, args: dict, user_role: str, current_user: User, db: Session) -> dict:
    """Enforce security boundaries and execute the requested tool function on the database."""
    role_upper = user_role.upper()
    if tool_name not in ALLOWED_TOOLS.get(role_upper, []):
        return {"error": f"Security restriction: Role {user_role} is not authorized to invoke {tool_name}."}

    try:
        # 1. Personal Deliveries
        if tool_name == "get_my_deliveries":
            if role_upper == "CUSTOMER":
                shipments = db.query(Delivery).filter(
                    or_(
                        Delivery.customer_phone == current_user.phone_number,
                        Delivery.customer_name == current_user.fullname,
                        Delivery.sender_name == current_user.fullname,
                        Delivery.recipient_name == current_user.fullname,
                        Delivery.sender_phone == current_user.phone_number,
                        Delivery.recipient_phone == current_user.phone_number
                    )
                ).all()
            elif role_upper == "AGENT":
                shipments = db.query(Delivery).filter(Delivery.agent_id == current_user.id).all()
            else:
                return {"error": "Role not authorized for personal deliveries query."}

            return {
                "deliveries": [
                    {
                        "delivery_id": s.delivery_id,
                        "tracking_number": s.tracking_number,
                        "status": s.status,
                        "pickup": s.pickup_address,
                        "drop": s.drop_address,
                        "recipient": s.recipient_name,
                        "weight": s.package_weight,
                        "price": s.delivery_charge,
                        "payment_status": s.payment_status,
                        "eta": s.estimated_delivery_at.isoformat() if s.estimated_delivery_at else None
                    }
                    for s in shipments
                ]
            }

        # 2. General Tracking Status
        elif tool_name == "get_delivery_status":
            tracking = str(args.get("tracking_number", "")).strip()
            if not tracking:
                return {"error": "Tracking number is required."}
            
            d = db.query(Delivery).filter(
                or_(Delivery.delivery_id.ilike(tracking), Delivery.tracking_number.ilike(tracking))
            ).first()
            if not d:
                return {"error": f"Shipment '{tracking}' not found."}

            # Customer privacy check
            if role_upper == "CUSTOMER" and not (
                d.customer_phone == current_user.phone_number or
                d.customer_name == current_user.fullname or
                d.sender_name == current_user.fullname or
                d.recipient_name == current_user.fullname or
                d.sender_phone == current_user.phone_number or
                d.recipient_phone == current_user.phone_number
            ):
                return {"error": "Access denied. You are not associated with this shipment."}

            return {
                "delivery_id": d.delivery_id,
                "tracking_number": d.tracking_number,
                "status": d.status,
                "pickup": d.pickup_address,
                "drop": d.drop_address,
                "eta": d.estimated_delivery_at.isoformat() if d.estimated_delivery_at else None
            }

        # 3. Detailed Shipment View
        elif tool_name == "get_delivery_details":
            tracking = str(args.get("tracking_number", "")).strip()
            if not tracking:
                return {"error": "Tracking number or delivery ID is required."}

            d = db.query(Delivery).filter(
                or_(Delivery.delivery_id.ilike(tracking), Delivery.tracking_number.ilike(tracking))
            ).first()
            if not d:
                return {"error": f"Shipment '{tracking}' not found."}

            # Agent check
            if role_upper == "AGENT" and d.agent_id != current_user.id:
                return {"error": "Access denied. This shipment is not assigned to you."}

            # Dispatcher city check
            if role_upper == "DISPATCHER" and current_user.city:
                city_lower = current_user.city.strip().lower()
                p_addr = (d.pickup_address or "").lower()
                d_addr = (d.drop_address or "").lower()
                if city_lower not in p_addr and city_lower not in d_addr:
                    return {"error": f"Access denied. Shipment is outside your hub city ({current_user.city})."}

            return {
                "delivery_id": d.delivery_id,
                "tracking_number": d.tracking_number,
                "status": d.status,
                "sender_name": d.sender_name,
                "recipient_name": d.recipient_name,
                "recipient_phone": d.recipient_phone,
                "pickup": d.pickup_address,
                "drop": d.drop_address,
                "weight_kg": d.package_weight,
                "dimensions": d.package_dimensions,
                "priority": d.priority,
                "payment_responsibility": d.payment_responsibility,
                "payment_method": d.payment_method,
                "payment_status": d.payment_status,
                "delivery_charge": d.delivery_charge,
                "cod_amount": d.cod_amount,
                "is_fragile": d.is_fragile,
                "declared_value": d.declared_value,
                "insurance_opt_in": d.insurance_opt_in,
                "verification_pin": d.verification_pin if role_upper != "AGENT" else None,
                "notes": d.notes,
                "eta": d.estimated_delivery_at.isoformat() if d.estimated_delivery_at else None
            }

        # 4. List Active Agents
        elif tool_name == "get_available_agents":
            query = db.query(User).filter(User.role_id == 2, User.status == "Active")
            if role_upper == "DISPATCHER" and current_user.city:
                query = query.filter(User.city.ilike(f"%{current_user.city.strip()}%"))
            
            agents = query.all()
            return {
                "agents": [
                    {
                        "agent_id": a.id,
                        "name": a.fullname,
                        "city": a.city,
                        "active_jobs_count": db.query(Delivery).filter(Delivery.agent_id == a.id, Delivery.status.notin_(["Delivered", "Cancelled"])).count()
                    }
                    for a in agents
                ]
            }

        # 5. Agent Workload Details
        elif tool_name == "get_agent_workload":
            agent_id = args.get("agent_id")
            agent_name = args.get("agent_name")
            
            query = db.query(User).filter(User.role_id == 2)
            if agent_id:
                query = query.filter(User.id == int(agent_id))
            elif agent_name:
                query = query.filter(User.fullname.ilike(f"%{str(agent_name).strip()}%"))
            else:
                return {"error": "Provide agent_id or agent_name."}
                
            agent = query.first()
            if not agent:
                return {"error": "Agent not found."}

            if role_upper == "DISPATCHER" and current_user.city:
                agent_city = (agent.city or "").lower()
                dispatcher_city = current_user.city.lower()
                if dispatcher_city not in agent_city:
                    return {"error": f"Access denied. Agent {agent.fullname} is located in {agent.city}, outside your hub."}

            active_jobs = db.query(Delivery).filter(Delivery.agent_id == agent.id, Delivery.status.notin_(["Delivered", "Cancelled"])).all()
            return {
                "agent_name": agent.fullname,
                "agent_id": agent.id,
                "city": agent.city,
                "active_jobs_count": len(active_jobs),
                "active_jobs": [{"delivery_id": j.delivery_id, "status": j.status, "drop": j.drop_address} for j in active_jobs]
            }

        # 6. Unassigned/Pending Deliveries
        elif tool_name == "get_pending_deliveries":
            query = db.query(Delivery).filter(Delivery.status.in_(["Created", "Pending"]))
            if role_upper == "DISPATCHER" and current_user.city:
                city_lower = f"%{current_user.city.strip().lower()}%"
                query = query.filter(
                    or_(Delivery.pickup_address.ilike(city_lower), Delivery.drop_address.ilike(city_lower))
                )

            dels = query.all()
            return {
                "pending_deliveries": [
                    {
                        "delivery_id": d.delivery_id,
                        "pickup": d.pickup_address,
                        "drop": d.drop_address,
                        "created_at": d.created_at.isoformat() if d.created_at else None
                    }
                    for d in dels
                ]
            }

        # 7. Transit Logs
        elif tool_name == "get_delivery_history":
            tracking = str(args.get("tracking_number", "")).strip()
            if not tracking:
                return {"error": "Tracking number is required."}

            d = db.query(Delivery).filter(
                or_(Delivery.delivery_id.ilike(tracking), Delivery.tracking_number.ilike(tracking))
            ).first()
            if not d:
                return {"error": "Delivery not found."}

            if role_upper == "DISPATCHER" and current_user.city:
                city_lower = current_user.city.strip().lower()
                p_addr = (d.pickup_address or "").lower()
                d_addr = (d.drop_address or "").lower()
                if city_lower not in p_addr and city_lower not in d_addr:
                    return {"error": "Access denied. Shipment is outside your hub."}

            return {
                "delivery_id": d.delivery_id,
                "status": d.status,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "assigned_at": d.assigned_at.isoformat() if d.assigned_at else None,
                "picked_up_at": d.picked_up_at.isoformat() if d.picked_up_at else None,
                "in_transit_at": d.in_transit_at.isoformat() if d.in_transit_at else None,
                "delivered_at": d.delivered_at.isoformat() if d.delivered_at else None
            }

        # 8. Dashboard Quick Stats
        elif tool_name == "get_dashboard_statistics":
            total = db.query(Delivery).count()
            delivered = db.query(Delivery).filter(Delivery.status == "Delivered").count()
            cancelled = db.query(Delivery).filter(Delivery.status == "Cancelled").count()
            active = total - delivered - cancelled
            agents = db.query(User).filter(User.role_id == 2).count()
            return {
                "total_shipments": total,
                "active_shipments": active,
                "delivered_shipments": delivered,
                "cancelled_shipments": cancelled,
                "total_agents": agents
            }

        # 9. Dynamic Pricing Engine
        elif tool_name == "calculate_delivery_price":
            weight = float(args.get("weight", 0.5))
            length = float(args.get("length", 10.0))
            width = float(args.get("width", 10.0))
            height = float(args.get("height", 10.0))
            distance = float(args.get("distance", 1.0))
            priority = str(args.get("priority", "Standard"))
            payment_method = str(args.get("payment_method", "Prepaid"))
            is_fragile = bool(args.get("is_fragile", False))
            declared_value = float(args.get("declared_value", 0.0))
            insurance_opt_in = bool(args.get("insurance_opt_in", False))

            vol_weight = (length * width * height) / 5000.0
            billable_weight = max(weight, vol_weight)
            billable_weight = math_ceil_half(billable_weight)

            base_charge = 0.0
            if billable_weight <= 0.5: base_charge = 50.0
            elif billable_weight <= 1.0: base_charge = 60.0
            elif billable_weight <= 2.0: base_charge = 75.0
            elif billable_weight <= 3.0: base_charge = 90.0
            elif billable_weight <= 5.0: base_charge = 120.0
            elif billable_weight <= 10.0: base_charge = 180.0
            else: base_charge = 300.0

            dist_charge = 0.0
            if distance <= 5.0: dist_charge = 20.0
            elif distance <= 10.0: dist_charge = 30.0
            elif distance <= 20.0: dist_charge = 50.0
            elif distance <= 50.0: dist_charge = 80.0
            else: dist_charge = 150.0

            service_charge = 0.0
            prio_lower = priority.lower()
            if "express" in prio_lower: service_charge = 100.0
            elif "next day" in prio_lower: service_charge = 75.0
            elif "same day" in prio_lower: service_charge = 150.0

            cod_charge = 0.0
            if payment_method.upper() == "COD":
                cod_charge = max(30.0, 0.02 * declared_value)

            fragile_charge = 50.0 if is_fragile else 0.0
            insurance_charge = 0.01 * declared_value if insurance_opt_in else 0.0
            total = base_charge + dist_charge + service_charge + cod_charge + fragile_charge + insurance_charge

            return {
                "volumetric_weight_kg": vol_weight,
                "billable_weight_kg": billable_weight,
                "base_weight_charge": base_charge,
                "distance_charge": dist_charge,
                "service_charge": service_charge,
                "cod_charge": cod_charge,
                "fragile_charge": fragile_charge,
                "insurance_charge": insurance_charge,
                "total_delivery_charge": total
            }

        # 10. Users List View
        elif tool_name == "get_users_list":
            users = db.query(User).all()
            return {
                "users": [
                    {
                        "user_id": u.id,
                        "fullname": u.fullname,
                        "username": u.username,
                        "email": u.email,
                        "phone": u.phone_number,
                        "role": u.role.name if u.role else "Unknown",
                        "status": u.status,
                        "city": u.city
                    }
                    for u in users
                ]
            }

        # 11. User Profile Detail Query
        elif tool_name == "get_user_details":
            name_query = str(args.get("username_or_name", "")).strip()
            if not name_query:
                return {"error": "Username or full name is required."}
            u = db.query(User).filter(
                or_(
                    User.fullname.ilike(f"%{name_query}%"),
                    User.username.ilike(f"%{name_query}%"),
                    User.email.ilike(f"%{name_query}%")
                )
            ).first()
            if not u:
                return {"error": f"User '{name_query}' not found."}
            return {
                "user_id": u.id,
                "fullname": u.fullname,
                "username": u.username,
                "email": u.email,
                "phone": u.phone_number,
                "role": u.role.name if u.role else "Unknown",
                "status": u.status,
                "city": u.city,
                "active_deliveries": u.active_deliveries,
                "deactivate_after_delivery": u.deactivate_after_delivery,
                "created_at": u.created_at.isoformat() if u.created_at else None
            }

        # 12. Create New User
        elif tool_name == "create_user":
            fullname = str(args.get("fullname", "")).strip()
            username = str(args.get("username", "")).strip()
            email = str(args.get("email", "")).strip()
            password = str(args.get("password", ""))
            role_name = str(args.get("role", "Customer")).strip()
            phone_number = str(args.get("phone_number", "")).strip()
            city = str(args.get("city", "")).strip()

            if not fullname or not username or not email or not password or not role_name:
                return {"error": "Missing required fields."}

            db_role = db.query(Role).filter(Role.name.ilike(role_name)).first()
            if not db_role:
                return {"error": f"Role '{role_name}' does not exist."}

            existing = db.query(User).filter(or_(User.username.ilike(username), User.email.ilike(email))).first()
            if existing:
                return {"error": f"A user with username '{username}' or email '{email}' already exists."}

            new_user = User(
                fullname=fullname,
                username=username,
                email=email,
                phone_number=phone_number if phone_number else None,
                hashed_password=hash_password(password),
                role_id=db_role.id,
                status="Active",
                city=city if city else None
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)

            return {
                "success": True,
                "user": {"fullname": new_user.fullname, "role": db_role.name, "user_id": new_user.id}
            }

        # 13. Update User
        elif tool_name == "update_user":
            uid = args.get("user_id")
            if not uid:
                return {"error": "user_id is required."}
            u = db.query(User).filter(User.id == int(uid)).first()
            if not u:
                return {"error": f"User {uid} not found."}
            
            fullname = args.get("fullname")
            role_name = args.get("role")
            status = args.get("status")
            password = args.get("password")
            city = args.get("city")
            
            if fullname: u.fullname = fullname
            if status: u.status = status
            if city: u.city = city
            if password: u.hashed_password = hash_password(password)
            if role_name:
                r = db.query(Role).filter(Role.name.ilike(role_name)).first()
                if r: u.role_id = r.id
            db.commit()
            return {"success": True, "message": f"User {u.fullname} updated."}

        # 14. Delete User
        elif tool_name == "delete_user":
            uid = args.get("user_id")
            u = db.query(User).filter(User.id == int(uid)).first()
            if not u:
                return {"error": f"User {uid} not found."}
            db.delete(u)
            db.commit()
            return {"success": True, "message": f"User {u.fullname} deleted."}

        # 15. Create Delivery
        elif tool_name == "create_delivery":
            sender = args.get("sender_name", "Unknown")
            recipient = args.get("recipient_name", "Unknown")
            pickup = args.get("pickup_address", "")
            drop = args.get("drop_address", "")
            weight = float(args.get("weight", 1.0))
            
            del_id = f"DEL-{str(uuid.uuid4())[:8].upper()}"
            trk_num = f"TRK{str(uuid.uuid4())[:12].upper()}"
            d = Delivery(
                delivery_id=del_id,
                tracking_number=trk_num,
                sender_name=sender,
                recipient_name=recipient,
                pickup_address=pickup,
                drop_address=drop,
                package_weight=weight,
                status="Created",
                created_at=datetime.now(timezone.utc)
            )
            db.add(d)
            db.commit()
            return {"success": True, "delivery_id": del_id, "tracking_number": trk_num}

        # 16. Assign Delivery Agent
        elif tool_name in ["assign_delivery", "reassign_delivery"]:
            trkid = args.get("tracking_number")
            agent_id = args.get("agent_id")
            
            d = db.query(Delivery).filter(or_(Delivery.delivery_id.ilike(trkid), Delivery.tracking_number.ilike(trkid))).first()
            if not d: return {"error": f"Shipment '{trkid}' not found."}
            
            a = db.query(User).filter(User.id == int(agent_id), User.role_id == 2).first()
            if not a: return {"error": f"Agent {agent_id} not found."}
            
            d.agent_id = a.id
            d.status = "Assigned"
            d.assigned_at = datetime.now(timezone.utc)
            db.commit()
            return {"success": True, "message": f"Shipment {d.delivery_id} assigned to Agent {a.fullname}."}

        # 17. Cancel Delivery
        elif tool_name == "cancel_delivery":
            trkid = args.get("tracking_number")
            d = db.query(Delivery).filter(or_(Delivery.delivery_id.ilike(trkid), Delivery.tracking_number.ilike(trkid))).first()
            if not d: return {"error": f"Shipment '{trkid}' not found."}
            d.status = "Cancelled"
            db.commit()
            return {"success": True, "message": f"Shipment {d.delivery_id} has been cancelled."}

        # 18. Agent Actions
        elif tool_name in ["mark_picked_up", "mark_in_transit", "mark_out_for_delivery", "mark_delivered", "mark_failed"]:
            trkid = args.get("tracking_number")
            d = db.query(Delivery).filter(or_(Delivery.delivery_id.ilike(trkid), Delivery.tracking_number.ilike(trkid))).first()
            if not d: return {"error": f"Shipment '{trkid}' not found."}
            
            if role_upper == "AGENT" and d.agent_id != current_user.id:
                return {"error": "Access denied. Delivery is not assigned to you."}
                
            status_map = {
                "mark_picked_up": "Picked Up",
                "mark_in_transit": "In Transit",
                "mark_out_for_delivery": "Out for Delivery",
                "mark_delivered": "Delivered",
                "mark_failed": "Failed"
            }
            target_status = status_map[tool_name]
            d.status = target_status
            
            now_time = datetime.now(timezone.utc)
            if target_status == "Picked Up": d.picked_up_at = now_time
            elif target_status == "In Transit": d.in_transit_at = now_time
            elif target_status == "Out for Delivery": d.out_for_delivery_at = now_time
            elif target_status == "Delivered": d.delivered_at = now_time
            
            db.commit()
            return {"success": True, "message": f"Successfully updated {d.delivery_id} status to '{target_status}'."}

        # 19. Agent Problem Reporting
        elif tool_name == "report_delivery_issue":
            trkid = args.get("tracking_number")
            issue = args.get("issue_description", "Unknown issue")
            d = db.query(Delivery).filter(or_(Delivery.delivery_id.ilike(trkid), Delivery.tracking_number.ilike(trkid))).first()
            if not d: return {"error": f"Shipment '{trkid}' not found."}
            
            if role_upper == "AGENT" and d.agent_id != current_user.id:
                return {"error": "Access denied."}
                
            d.status = "Failed"
            d.notes = f"Issue: {issue}"
            db.commit()
            return {"success": True, "message": f"Logged delivery issue for {d.delivery_id}: {issue}."}

        # 20. Reschedule Request
        elif tool_name == "request_reschedule":
            trkid = args.get("tracking_number")
            new_date = args.get("new_date")
            d = db.query(Delivery).filter(or_(Delivery.delivery_id.ilike(trkid), Delivery.tracking_number.ilike(trkid))).first()
            if not d: return {"error": f"Shipment '{trkid}' not found."}
            
            if role_upper == "CUSTOMER" and d.customer_phone != current_user.phone_number:
                return {"error": "Access denied."}
                
            d.notes = f"Reschedule to: {new_date}"
            db.commit()
            return {"success": True, "message": f"Rescheduled {d.delivery_id} to {new_date}."}

        # 21. Create Support Ticket
        elif tool_name == "create_ticket":
            trkid = args.get("tracking_number")
            desc = args.get("description", "Issue report")
            t_id = f"TCK-{str(uuid.uuid4())[:6].upper()}"
            return {"success": True, "ticket_id": t_id, "message": f"Ticket {t_id} created successfully."}

        # 22. Admin Analytics - Delivery Metrics
        elif tool_name == "get_delivery_metrics":
            total = db.query(Delivery).count()
            completed = db.query(Delivery).filter(Delivery.status == "Delivered").all()
            
            total_minutes = 0
            completed_count = len(completed)
            for c in completed:
                if c.delivered_at and c.created_at:
                    diff = c.delivered_at - c.created_at
                    total_minutes += int(diff.total_seconds() / 60)
            
            avg_time = f"{int(total_minutes / completed_count)} minutes" if completed_count > 0 else "N/A"
            return {
                "total_completed": completed_count,
                "active_shipments": db.query(Delivery).filter(Delivery.status.notin_(["Delivered", "Cancelled"])).count(),
                "average_delivery_time": avg_time
            }

        # 23. Admin Analytics - Location Metrics
        elif tool_name == "get_failure_metrics":
            failed_dels = db.query(Delivery).filter(Delivery.status == "Failed").all()
            city_counts = {}
            for f in failed_dels:
                city = "Other"
                addr = (f.drop_address or "").lower()
                if "agra" in addr: city = "Agra"
                elif "delhi" in addr: city = "Delhi"
                elif "bangalore" in addr: city = "Bangalore"
                elif "mumbai" in addr: city = "Mumbai"
                elif "noida" in addr: city = "Noida"
                elif "ghaziabad" in addr: city = "Ghaziabad"
                city_counts[city] = city_counts.get(city, 0) + 1
            return {"failed_deliveries_by_city": city_counts}

        # 24. Admin Analytics - Agent Metrics
        elif tool_name == "get_agent_metrics":
            agents = db.query(User).filter(User.role_id == 2).all()
            top_agent = None
            max_completed = -1
            for a in agents:
                comp = db.query(Delivery).filter(Delivery.agent_id == a.id, Delivery.status == "Delivered").count()
                if comp > max_completed:
                    max_completed = comp
                    top_agent = a.fullname
            return {
                "top_performing_agent": top_agent or "N/A",
                "completed_count": max_completed
            }

        # 25. Admin Analytics - Financial Metrics
        elif tool_name == "get_revenue_metrics":
            completed = db.query(Delivery).filter(Delivery.status == "Delivered").all()
            total_rev = sum(float(c.delivery_charge or 0) for c in completed)
            unpaid_count = db.query(Delivery).filter(Delivery.payment_status == "Unpaid").count()
            return {
                "total_completed_revenue_inr": total_rev,
                "unpaid_deliveries_count": unpaid_count
            }

        # 26. Dispatcher Notifications Tool
        elif tool_name == "notify_agent":
            return {"success": True, "message": "Notification broadcast sent successfully."}

    except Exception as ex:
        return {"error": f"Tool execution failed: {ex}"}

    return {"error": f"Unknown tool name: {tool_name}"}

def math_ceil_half(val: float) -> float:
    """Round up to the next 0.5 kg."""
    import math
    return math.ceil(val * 2.0) / 2.0


# ── AI TOOL CATALOGUE (OLLAMA SYSTEM FORMAT) ──────────────────────────────────

SYSTEM_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_my_deliveries",
            "description": "Get active/pending deliveries belonging to the current user (Customer or Agent)."
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_delivery_status",
            "description": "Fetch simple status, ETA, and addresses for a tracking number.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_number": {"type": "string", "description": "The tracking ID or delivery number (e.g. DEL-001)"}
                },
                "required": ["tracking_number"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_delivery_details",
            "description": "Get comprehensive details (dimensions, weights, prices) for a shipment. Restricted to agents, dispatchers, admins.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_number": {"type": "string", "description": "The tracking ID or delivery number"}
                },
                "required": ["tracking_number"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_available_agents",
            "description": "List available delivery agents in the active hub. Restricted to dispatchers and admins."
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_agent_workload",
            "description": "Get active jobs and workload count for an agent. Restricted to dispatchers and admins.",
            "parameters": {
                "type": "object",
                "properties": {
                    "agent_id": {"type": "integer", "description": "ID of the agent"},
                    "agent_name": {"type": "string", "description": "Full name of the agent"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_pending_deliveries",
            "description": "Fetch deliveries that are Created/Pending. Restricted to dispatchers and admins."
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_delivery_history",
            "description": "Get transit history timestamps for a delivery. Restricted to dispatchers and admins.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_number": {"type": "string", "description": "Tracking number"}
                },
                "required": ["tracking_number"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_dashboard_statistics",
            "description": "Get system-wide total shipments and active metrics. Restricted to admins."
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_delivery_price",
            "description": "Calculate dynamic shipping charge with slabs breakdown.",
            "parameters": {
                "type": "object",
                "properties": {
                    "weight": {"type": "number", "description": "Actual weight in kg"},
                    "length": {"type": "number", "description": "Length in cm"},
                    "width": {"type": "number", "description": "Width in cm"},
                    "height": {"type": "number", "description": "Height in cm"},
                    "distance": {"type": "number", "description": "Distance in km"},
                    "priority": {"type": "string", "description": "Standard, Next Day, Express, or Same Day"},
                    "payment_method": {"type": "string", "description": "Prepaid or COD"},
                    "is_fragile": {"type": "boolean", "description": "True if item is fragile"},
                    "declared_value": {"type": "number", "description": "Declared price value in rupees"},
                    "insurance_opt_in": {"type": "boolean", "description": "True to add 1% insurance"}
                },
                "required": ["weight", "length", "width", "height", "distance"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_users_list",
            "description": "Retrieve the list of registered users in the system (Admins, Dispatchers, Agents, Customers). Restricted to admins."
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_details",
            "description": "Fetch complete details (fullname, phone, email, status, active deliveries, city) of a registered user. Restricted to admins.",
            "parameters": {
                "type": "object",
                "properties": {
                    "username_or_name": {"type": "string", "description": "The username or full name of the user"}
                },
                "required": ["username_or_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_user",
            "description": "Create a new user/agent/dispatcher/customer in the system. Restricted to admins.",
            "parameters": {
                "type": "object",
                "properties": {
                    "fullname": {"type": "string", "description": "The full name of the user"},
                    "username": {"type": "string", "description": "A unique username"},
                    "email": {"type": "string", "description": "Email address"},
                    "password": {"type": "string", "description": "Plain text password"},
                    "role": {"type": "string", "description": "Role: Admin, Dispatcher, Agent, or Customer"},
                    "phone_number": {"type": "string", "description": "Optional phone number"},
                    "city": {"type": "string", "description": "Optional city name"}
                },
                "required": ["fullname", "username", "email", "password", "role"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_user",
            "description": "Update details of a user. Restricted to admins.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "integer", "description": "ID of the user to update"},
                    "fullname": {"type": "string"},
                    "role": {"type": "string"},
                    "status": {"type": "string"},
                    "password": {"type": "string"},
                    "city": {"type": "string"}
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_user",
            "description": "Delete a user. Restricted to admins.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "integer", "description": "ID of the user to delete"}
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_delivery",
            "description": "Book a new delivery shipment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sender_name": {"type": "string"},
                    "recipient_name": {"type": "string"},
                    "pickup_address": {"type": "string"},
                    "drop_address": {"type": "string"},
                    "weight": {"type": "number"}
                },
                "required": ["pickup_address", "drop_address"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "assign_delivery",
            "description": "Assign or reassign an agent to a delivery.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_number": {"type": "string"},
                    "agent_id": {"type": "integer"}
                },
                "required": ["tracking_number", "agent_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_delivery",
            "description": "Cancel a delivery shipment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_number": {"type": "string"}
                },
                "required": ["tracking_number"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "mark_picked_up",
            "description": "Mark a delivery as Picked Up.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_number": {"type": "string"}
                },
                "required": ["tracking_number"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "mark_delivered",
            "description": "Mark a delivery as Delivered.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_number": {"type": "string"}
                },
                "required": ["tracking_number"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "report_delivery_issue",
            "description": "Log a delivery issue/failure.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_number": {"type": "string"},
                    "issue_description": {"type": "string"}
                },
                "required": ["tracking_number", "issue_description"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "request_reschedule",
            "description": "Reschedule a delivery appointment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_number": {"type": "string"},
                    "new_date": {"type": "string"}
                },
                "required": ["tracking_number", "new_date"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_ticket",
            "description": "Create a customer support ticket.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_number": {"type": "string"},
                    "description": {"type": "string"}
                },
                "required": ["tracking_number", "description"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_delivery_metrics",
            "description": "Get analytics metrics on average delivery times and active loads. Restricted to admins."
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_failure_metrics",
            "description": "Get location/city failure counts. Restricted to admins."
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_agent_metrics",
            "description": "Get agent performance metrics. Restricted to admins."
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_revenue_metrics",
            "description": "Get financial analytics and unpaid counts. Restricted to admins."
        }
    }
]


# ── FALLBACK LOCAL QUERY MATCHING ENGINE (If Ollama is Offline) ──────────────

def run_local_fallback_query(question: str, user_role: str, current_user: User, db: Session) -> str:
    """Pre-programmed logic to handle main questions if local Ollama server is offline."""
    q_lower = question.lower().strip()
    role_upper = user_role.upper()

    response = "### 🤖 Logistics Assistant (Local Mode)\n\n"
    
    # 1. Greetings
    if any(g in q_lower for g in ["hi", "hello", "hey", "hola", "greetings"]):
        response += f"Hello, {current_user.fullname}! I am running in local fallback mode because Ollama is offline.\n\n"
        if role_upper == "CUSTOMER":
            response += "Ask me about:\n* **My active deliveries**\n* **Track order [ID]**\n* **Pricing estimate**"
        elif role_upper in ("DISPATCHER", "ADMIN"):
            response += "Ask me about:\n* **Available agents**\n* **Pending deliveries**\n* **System metrics**"
        else:
            response += "Ask me about:\n* **My assigned deliveries**\n* **Delivery steps**"
        return response

    # 2. My deliveries
    elif "deliveries" in q_lower or "shipments" in q_lower or "my order" in q_lower:
        res = execute_tool("get_my_deliveries", {}, user_role, current_user, db)
        if "error" in res:
            return response + f"❌ {res['error']}"
        dels = res.get("deliveries", [])
        if not dels:
            return response + "You have no registered deliveries in your queue."
        
        response += "| Delivery ID | Status | Recipient | Destination |\n| :--- | :--- | :--- | :--- |\n"
        for d in dels:
            response += f"| `{d['delivery_id']}` | **{d['status']}** | {d['recipient']} | {d['drop']} |\n"
        return response

    # 3. Available agents
    elif "agent" in q_lower or "available" in q_lower:
        if role_upper not in ("DISPATCHER", "ADMIN"):
            return response + "❌ Security boundary restriction: You do not have permissions to view agents."
        res = execute_tool("get_available_agents", {}, user_role, current_user, db)
        agents = res.get("agents", [])
        if not agents:
            return response + "No active agents are currently available in the hub."
        
        response += "Here are the available agents in your hub:\n\n"
        response += "| Agent Name | ID | City | Active Jobs |\n| :--- | :--- | :--- | :--- |\n"
        for a in agents:
            response += f"| **{a['name']}** | `{a['agent_id']}` | {a['city']} | {a['active_jobs_count']} |\n"
        return response

    # 4. Pending Deliveries
    elif "pending" in q_lower:
        if role_upper not in ("DISPATCHER", "ADMIN"):
            return response + "❌ Access denied."
        res = execute_tool("get_pending_deliveries", {}, user_role, current_user, db)
        dels = res.get("pending_deliveries", [])
        if not dels:
            return response + "No pending deliveries in the hub."
        
        response += "| Order ID | Pickup From | Drop To |\n| :--- | :--- | :--- |\n"
        for d in dels:
            response += f"| `{d['delivery_id']}` | {d['pickup']} | {d['drop']} |\n"
        return response

    # 4a. Create User fallback
    elif ("create" in q_lower or "add" in q_lower or "register" in q_lower) and ("user" in q_lower or "agent" in q_lower or "dispatcher" in q_lower or "customer" in q_lower):
        if role_upper != "ADMIN":
            return response + "❌ Security restriction: Only Admins are authorized to create users."
        return response + "To register a new user, please start the Ollama service. The AI model is required to parse the registration parameters from your message."

    # 4b. Users list fallback
    elif "user" in q_lower:
        if role_upper != "ADMIN":
            return response + "❌ Security restriction: Only Admins can query user information."
        
        target_name = None
        for word in q_lower.split():
            clean_word = word.strip("?,.!:;()\"'")
            if clean_word not in ("user", "users", "list", "get", "show", "details", "info", "give", "of", "about", "describe", "find", "all"):
                target_name = clean_word
                break
        
        if target_name:
            res = execute_tool("get_user_details", {"username_or_name": target_name}, user_role, current_user, db)
            if "error" in res:
                return response + f"❌ {res['error']}"
            response += f"#### 👤 User Details: {res['fullname']} ({res['role']})\n\n"
            response += f"* **User ID**: `{res['user_id']}`\n"
            response += f"* **Username**: `{res['username']}`\n"
            response += f"* **Email**: {res['email']}\n"
            response += f"* **Phone**: {res['phone'] or 'N/A'}\n"
            response += f"* **City**: {res['city'] or 'N/A'}\n"
            response += f"* **Status**: {res['status']}\n"
            response += f"* **Active Deliveries**: {res['active_deliveries'] or 0}\n"
            return response
        else:
            res = execute_tool("get_users_list", {}, user_role, current_user, db)
            if "error" in res:
                return response + f"❌ {res['error']}"
            users = res.get("users", [])
            response += "| User ID | Name | Username | Role | City | Status |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n"
            for u in users:
                response += f"| `{u['user_id']}` | **{u['fullname']}** | `{u['username']}` | {u['role']} | {u['city'] or 'N/A'} | {u['status']} |\n"
            return response

    # 4c. Last/Latest status fallback when Ollama is offline
    elif ("status" in q_lower or "track" in q_lower) and ("last" in q_lower or "latest" in q_lower):
        d = None
        if role_upper == "CUSTOMER":
            d = db.query(Delivery).filter(
                or_(
                    Delivery.customer_phone == current_user.phone_number,
                    Delivery.customer_name == current_user.fullname,
                    Delivery.sender_name == current_user.fullname,
                    Delivery.recipient_name == current_user.fullname,
                    Delivery.sender_phone == current_user.phone_number,
                    Delivery.recipient_phone == current_user.phone_number
                )
            ).order_by(Delivery.created_at.desc()).first()
        elif role_upper == "AGENT":
            d = db.query(Delivery).filter(Delivery.agent_id == current_user.id).order_by(Delivery.created_at.desc()).first()
        elif role_upper == "DISPATCHER" and current_user.city:
            city_lower = f"%{current_user.city.strip().lower()}%"
            d = db.query(Delivery).filter(
                or_(Delivery.pickup_address.ilike(city_lower), Delivery.drop_address.ilike(city_lower))
            ).order_by(Delivery.created_at.desc()).first()
        else: # Admin
            d = db.query(Delivery).order_by(Delivery.created_at.desc()).first()
            
        if d:
            response += f"#### 📦 Latest Shipment Status: {d.delivery_id} ({d.tracking_number})\n\n"
            response += f"* **Current Status**: **{d.status}**\n"
            response += f"* **Pickup Address**: {d.pickup_address}\n"
            response += f"* **Drop Address**: {d.drop_address}\n"
            response += f"* **Estimated Delivery**: {d.estimated_delivery_at.isoformat() if d.estimated_delivery_at else 'N/A'}\n"
            return response
        else:
            return response + "No recent shipments found in your account."

    # 5. Specific tracking ID detection
    tracking_match = re.search(r'(del-\d+|trk\d+)', q_lower)
    if tracking_match:
        trkid = tracking_match.group(1).upper()
        res = execute_tool("get_delivery_status", {"tracking_number": trkid}, user_role, current_user, db)
        if "error" in res:
            return response + f"❌ {res['error']}"
        response += f"#### 📦 Shipment Status: {res['delivery_id']} ({res['tracking_number']})\n\n"
        response += f"* **Current Status**: **{res['status']}**\n"
        response += f"* **Pickup**: {res['pickup']}\n"
        response += f"* **Drop**: {res['drop']}\n"
        response += f"* **Estimated Delivery**: {res['eta'] or 'N/A'}\n"
        return response

    return response + "Ollama server is offline. Please start the Ollama service to enable full natural language responses."


# ── MAIN CHATBOT ROUTER ENDPOINT ───────────────────────────────────────────────

@router.post("/chat")
def get_ai_response(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role = current_user.role.name if current_user.role else "Customer"
    question = req.question.strip()
    
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    
    # 1. Manage ChatSession and retrieve active history
    session = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.created_at.desc()).first()
    
    # Check for reset/clear command
    if question.lower().strip() in ["clear", "reset", "clear chat", "clear history"] or not session:
        session = ChatSession(user_id=current_user.id, role=role)
        db.add(session)
        db.commit()
        db.refresh(session)
        
        # Delete old messages if reset requested
        if question.lower().strip() in ["clear", "reset", "clear chat", "clear history"]:
            db.query(ChatMessage).filter(ChatMessage.session_id == session.id).delete()
            db.commit()
            return {"response": "### 🤖 Logistics Assistant\n\nI have successfully reset your chat history! What would you like to ask now?"}

    # Fetch last 10 messages from DB
    history_records = db.query(ChatMessage).filter(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at.asc()).all()
    if len(history_records) > 10:
        history_records = history_records[-10:]

    # Write current user message to DB
    new_user_msg = ChatMessage(session_id=session.id, sender="user", content=question)
    db.add(new_user_msg)
    db.commit()

    # Intercept user creation queries and route directly to Admin User Management screen
    q_clean = question.lower()
    if ("create" in q_clean or "add" in q_clean or "register" in q_clean or "new" in q_clean) and ("user" in q_clean or "agent" in q_clean or "dispatcher" in q_clean or "customer" in q_clean):
        if role.upper() != "ADMIN":
            reply_text = "### ❌ Access Denied\n\nSecurity boundary: Only the Administrator has permissions to manage or create users in the system."
        else:
            reply_text = "### 👤 Redirecting to User Management...\n\nI am taking you directly to the User Management dashboard where you can add new users and agents.\n\n[REDIRECT:/users]"
        
        new_assistant_msg = ChatMessage(session_id=session.id, sender="assistant", content=reply_text)
        db.add(new_assistant_msg)
        db.commit()
        return {"response": reply_text}

    # Intercept delivery creation queries and route to booking screen
    if ("create" in q_clean or "book" in q_clean or "add" in q_clean) and ("delivery" in q_clean or "shipment" in q_clean or "parcel" in q_clean or "order" in q_clean):
        if role.upper() == "CUSTOMER":
            reply_text = "### 📦 Redirecting to Booking Screen...\n\nI am taking you to the shipment booking panel to create a new delivery order.\n\n[REDIRECT:book-shipment]"
        elif role.upper() in ["ADMIN", "DISPATCHER"]:
            reply_text = "### 📦 Redirecting to Create Delivery Page...\n\nI am taking you directly to the order creation form to register a new shipment.\n\n[REDIRECT:/deliveries/create]"
        else:
            reply_text = "### ❌ Action Restricted\n\nDelivery agents are not permitted to create or book new shipments."
            
        new_assistant_msg = ChatMessage(session_id=session.id, sender="assistant", content=reply_text)
        db.add(new_assistant_msg)
        db.commit()
        return {"response": reply_text}

    # Short-term Conversational Memory Extract
    last_delivery = None
    last_agent = None
    for record in reversed(history_records):
        content_lower = (record.content or "").lower()
        if not last_delivery:
            del_match = re.search(r'(del-\d+|trk\d+)', content_lower)
            if del_match:
                last_delivery = del_match.group(1).upper()
        if not last_agent:
            agent_match = re.search(r'agent\s+(\d+|[a-zA-Z]+)', content_lower)
            if agent_match:
                last_agent = agent_match.group(0)

    # Proactive alerts for Operations dashboard
    proactive_alerts = ""
    if role.upper() in ["ADMIN", "DISPATCHER"]:
        unassigned_count = db.query(Delivery).filter(Delivery.status.in_(["Created", "Pending"]), Delivery.agent_id.is_(None)).count()
        delayed_count = db.query(Delivery).filter(Delivery.status.notin_(["Delivered", "Cancelled"]), Delivery.estimated_delivery_at < datetime.now(timezone.utc)).count()
        proactive_alerts = (
            f"\n\nProactive Operations Alerts:\n"
            f"- There are currently {unassigned_count} unassigned deliveries.\n"
            f"- {delayed_count} deliveries are currently delayed.\n"
            f"If the user greets you or asks for overview, proactively highlight these alerts!"
        )

    # 2. Inject Role-specific System Prompt & formatting guidelines
    system_instruction = (
        f"You are the intelligent Logistics Assistant for LogisticsPro.\n"
        f"You are currently talking to a user whose ID is {current_user.id} and who has the role of {role}.\n\n"
        f"Strict Guidelines:\n"
        f"1. You have access to secure database functions (tools).\n"
        f"2. To fetch live database records, output a tool request as a JSON block:\n"
        f"   ```json\n"
        f"   {{\"tool\": \"tool_name\", \"arguments\": {{...}}}}\n"
        f"   ```\n"
        f"   Or invoke it via native tool calls if supported.\n"
        f"3. Only answer questions using information returned from tool executions. Do not hallucinate or make up details.\n"
        f"4. If the user asks for information outside the tools (or unauthorized tools), politely explain that your role prevents you from accessing that data.\n"
        f"5. Format all lists or grids of shipments in clean markdown tables. Keep responses brief, helpful, and professional."
    )

    if last_delivery or last_agent:
        system_instruction += "\n\nConversational Memory Context:\n"
        if last_delivery:
            system_instruction += f"- The user previously mentioned delivery ID: '{last_delivery}'. If they refer to 'it' or 'that delivery', assume '{last_delivery}'.\n"
        if last_agent:
            system_instruction += f"- The user previously mentioned agent: '{last_agent}'.\n"

    if proactive_alerts:
        system_instruction += proactive_alerts

    messages = [{"role": "system", "content": system_instruction}]
    for msg in history_records:
        messages.append({"role": msg.sender, "content": msg.content})
    messages.append({"role": "user", "content": question})

    # Intent pre-fetching/pre-routing logic for small models (like qwen2.5:0.5b)
    injected_tool_context = ""
    
    if "list" in q_clean and "user" in q_clean:
        res = execute_tool("get_users_list", {}, role, current_user, db)
        if "users" in res:
            injected_tool_context = f"\n[System Data: Here is the list of users from the database: {json.dumps(res['users'])}]"
            
    elif "detail" in q_clean and "user" in q_clean:
        target_name = None
        for word in question.split():
            clean_word = word.strip("?,.!:;()\"'")
            if clean_word.lower() not in ("user", "users", "list", "get", "show", "details", "info", "give", "of", "about", "describe", "find", "all"):
                target_name = clean_word
                break
        if target_name:
            res = execute_tool("get_user_details", {"username_or_name": target_name}, role, current_user, db)
            if "error" not in res:
                injected_tool_context = f"\n[System Data: Here are the details for user '{target_name}': {json.dumps(res)}]"
                
    elif "available" in q_clean and "agent" in q_clean:
        res = execute_tool("get_available_agents", {}, role, current_user, db)
        if "agents" in res:
            injected_tool_context = f"\n[System Data: Available agents: {json.dumps(res['agents'])}]"
            
    elif "pending" in q_clean and "deliver" in q_clean:
        res = execute_tool("get_pending_deliveries", {}, role, current_user, db)
        if "pending_deliveries" in res:
            injected_tool_context = f"\n[System Data: Pending deliveries: {json.dumps(res['pending_deliveries'])}]"

    elif "workload" in q_clean and "agent" in q_clean:
        target_agent = None
        for word in question.split():
            clean_word = word.strip("?,.!:;()\"'")
            if clean_word.lower() not in ("agent", "agents", "workload", "get", "show", "details", "info", "give", "of", "about", "describe", "find", "work"):
                target_agent = clean_word
                break
        if target_agent:
            res = execute_tool("get_agent_workload", {"agent_name": target_agent}, role, current_user, db)
            if "error" not in res:
                injected_tool_context = f"\n[System Data: Workload of agent '{target_agent}': {json.dumps(res)}]"

    elif "my deliveries" in q_clean or "my shipments" in q_clean or ("show" in q_clean and "deliver" in q_clean and role == "Customer"):
        res = execute_tool("get_my_deliveries", {}, role, current_user, db)
        if "deliveries" in res:
            injected_tool_context = f"\n[System Data: Your deliveries: {json.dumps(res['deliveries'])}]"

    elif "status" in q_clean or "track" in q_clean:
        tracking_match = re.search(r'(del-\d+|trk\d+)', q_clean)
        if tracking_match:
            trkid = tracking_match.group(1).upper()
            res = execute_tool("get_delivery_details", {"tracking_number": trkid}, role, current_user, db)
            if "error" not in res:
                injected_tool_context = f"\n[System Data: Status details of delivery {trkid}: {json.dumps(res)}]"
        elif "last" in q_clean or "latest" in q_clean:
            d = None
            if role == "Customer":
                d = db.query(Delivery).filter(
                    or_(
                        Delivery.customer_phone == current_user.phone_number,
                        Delivery.customer_name == current_user.fullname,
                        Delivery.sender_name == current_user.fullname,
                        Delivery.recipient_name == current_user.fullname,
                        Delivery.sender_phone == current_user.phone_number,
                        Delivery.recipient_phone == current_user.phone_number
                    )
                ).order_by(Delivery.created_at.desc()).first()
            elif role == "Agent":
                d = db.query(Delivery).filter(Delivery.agent_id == current_user.id).order_by(Delivery.created_at.desc()).first()
            elif role == "Dispatcher" and current_user.city:
                city_lower = f"%{current_user.city.strip().lower()}%"
                d = db.query(Delivery).filter(
                    or_(Delivery.pickup_address.ilike(city_lower), Delivery.drop_address.ilike(city_lower))
                ).order_by(Delivery.created_at.desc()).first()
            else: # Admin
                d = db.query(Delivery).order_by(Delivery.created_at.desc()).first()
                
            if d:
                injected_tool_context = f"\n[System Data: The most recent delivery in the system is {d.delivery_id} ({d.tracking_number}). Status: {d.status}, Pickup: {d.pickup_address}, Drop: {d.drop_address}, ETA: {d.estimated_delivery_at.isoformat() if d.estimated_delivery_at else 'N/A'}]"

    # Injected context formatting
    if injected_tool_context:
        messages[-1]["content"] += injected_tool_context

    # 3. Detect and call Ollama server
    installed_models = get_installed_ollama_models()
    if not installed_models:
        fallback_reply = run_local_fallback_query(question, role, current_user, db)
        assistant_msg = ChatMessage(session_id=session.id, sender="assistant", content=fallback_reply)
        db.add(assistant_msg)
        db.commit()
        return {"response": fallback_reply}

    # Model prioritization
    model_name = "qwen2.5:0.5b-instruct"
    instruct_variants = [m for m in installed_models if "instruct" in m or "chat" in m]
    if instruct_variants:
        model_name = instruct_variants[0]
    elif installed_models:
        model_name = installed_models[0]

    try:
        # First Chat Completion
        res_data = call_ollama(model_name, messages, SYSTEM_TOOLS)
        choice_message = res_data.get("message", {})
        content = choice_message.get("content", "")
        tool_calls = choice_message.get("tool_calls", [])

        # Parse text-based tool calling fallback JSON blocks
        if not tool_calls:
            json_blocks = re.findall(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)
            if not json_blocks:
                json_blocks = re.findall(r'(\{\s*"tool"\s*:\s*".*?\})', content, re.DOTALL)
            
            for block in json_blocks:
                try:
                    tool_data = json.loads(block)
                    if "tool" in tool_data:
                        tool_calls.append({
                            "id": "text_call_" + str(uuid.uuid4())[:8],
                            "function": {
                                "name": tool_data["tool"],
                                "arguments": tool_data.get("arguments", {})
                            }
                        })
                except Exception:
                    pass

        # 4. Handle Tool Calls
        if tool_calls:
            messages.append(choice_message)
            
            for call in tool_calls:
                func = call.get("function", {})
                func_name = func.get("name")
                func_args = func.get("arguments", {})
                if isinstance(func_args, str):
                    try:
                        func_args = json.loads(func_args)
                    except:
                        func_args = {}

                # Execute secure database query locally
                tool_res = execute_tool(func_name, func_args, role, current_user, db)
                
                messages.append({
                    "role": "tool",
                    "content": json.dumps(tool_res)
                })

            # Send secondary completions with the tool outputs fed back to LLM
            second_res = call_ollama(model_name, messages)
            final_content = second_res.get("message", {}).get("content", "")
        else:
            final_content = content

        # Save response to PostgreSQL
        new_assistant_msg = ChatMessage(session_id=session.id, sender="assistant", content=final_content)
        db.add(new_assistant_msg)
        db.commit()

        return {"response": final_content}

    except Exception as e:
        print("Error during Ollama execution:", e)
        fallback_reply = run_local_fallback_query(question, role, current_user, db)
        assistant_msg = ChatMessage(session_id=session.id, sender="assistant", content=fallback_reply)
        db.add(assistant_msg)
        db.commit()
        return {"response": fallback_reply}
