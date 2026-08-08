from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
import json
import urllib.request
import urllib.error
import os
import re
import uuid
from datetime import datetime, timezone
from database import get_db, Delivery, User, ChatSession, ChatMessage
from auth import get_current_user
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
            "temperature": 0.3
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
    "CUSTOMER": ["get_my_deliveries", "get_delivery_status", "calculate_delivery_price"],
    "AGENT": ["get_my_deliveries", "get_delivery_status", "get_delivery_details"],
    "DISPATCHER": ["get_delivery_status", "get_delivery_details", "get_available_agents", "get_agent_workload", "get_pending_deliveries", "get_delivery_history", "calculate_delivery_price"],
    "ADMIN": ["get_delivery_status", "get_delivery_details", "get_available_agents", "get_agent_workload", "get_pending_deliveries", "get_delivery_history", "get_dashboard_statistics", "calculate_delivery_price"]
}

def execute_tool(tool_name: str, args: dict, user_role: str, current_user: User, db: Session) -> dict:
    """Enforce security boundaries and execute the requested tool function on the database."""
    role_upper = user_role.upper()
    if tool_name not in ALLOWED_TOOLS.get(role_upper, []):
        return {"error": f"Security restriction: Role {user_role} is not authorized to invoke {tool_name}."}

    try:
        # Tool 1: Get My Deliveries
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

        # Tool 2: Get Delivery Status
        elif tool_name == "get_delivery_status":
            tracking = str(args.get("tracking_number", "")).strip()
            if not tracking:
                return {"error": "Tracking number is required."}
            
            d = db.query(Delivery).filter(
                or_(Delivery.delivery_id.ilike(tracking), Delivery.tracking_number.ilike(tracking))
            ).first()
            if not d:
                return {"error": f"Shipment '{tracking}' not found."}

            # Customer privacy boundary
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

        # Tool 3: Get Delivery Details
        elif tool_name == "get_delivery_details":
            tracking = str(args.get("tracking_number", "")).strip()
            if not tracking:
                return {"error": "Tracking number or delivery ID is required."}

            d = db.query(Delivery).filter(
                or_(Delivery.delivery_id.ilike(tracking), Delivery.tracking_number.ilike(tracking))
            ).first()
            if not d:
                return {"error": f"Shipment '{tracking}' not found."}

            # Agent boundary
            if role_upper == "AGENT" and d.agent_id != current_user.id:
                return {"error": "Access denied. This shipment is not assigned to you."}

            # Dispatcher city boundary
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

        # Tool 4: Get Available Agents
        elif tool_name == "get_available_agents":
            # Filter active delivery agents (role_id = 2 is Agent)
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

        # Tool 5: Get Agent Workload
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

            # Dispatcher city check
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

        # Tool 6: Get Pending Deliveries
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

        # Tool 7: Get Delivery History
        elif tool_name == "get_delivery_history":
            tracking = str(args.get("tracking_number", "")).strip()
            if not tracking:
                return {"error": "Tracking number is required."}

            d = db.query(Delivery).filter(
                or_(Delivery.delivery_id.ilike(tracking), Delivery.tracking_number.ilike(tracking))
            ).first()
            if not d:
                return {"error": "Delivery not found."}

            # Dispatcher city check
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
                "arrived_origin_at": d.arrived_origin_at.isoformat() if d.arrived_origin_at else None,
                "in_transit_hub_at": d.in_transit_hub_at.isoformat() if d.in_transit_hub_at else None,
                "arrived_destination_at": d.arrived_destination_at.isoformat() if d.arrived_destination_at else None,
                "out_for_delivery_at": d.out_for_delivery_at.isoformat() if d.out_for_delivery_at else None,
                "delivered_at": d.delivered_at.isoformat() if d.delivered_at else None
            }

        # Tool 8: Get Dashboard Statistics
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

        # Tool 9: Calculate Delivery Price
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

            # Step 2: Volumetric Weight
            vol_weight = (length * width * height) / 5000.0
            
            # Step 3: Billable Weight
            billable_weight = max(weight, vol_weight)
            billable_weight = math_ceil_half(billable_weight)

            # Step 4: Weight Slab Charge
            base_charge = 0.0
            if billable_weight <= 0.5: base_charge = 50.0
            elif billable_weight <= 1.0: base_charge = 60.0
            elif billable_weight <= 2.0: base_charge = 75.0
            elif billable_weight <= 3.0: base_charge = 90.0
            elif billable_weight <= 5.0: base_charge = 120.0
            elif billable_weight <= 10.0: base_charge = 180.0
            elif billable_weight <= 15.0: base_charge = 240.0
            elif billable_weight <= 20.0: base_charge = 300.0
            elif billable_weight <= 25.0: base_charge = 360.0
            else: base_charge = 420.0

            # Step 5: Distance Slab Charge
            dist_charge = 0.0
            if distance <= 5.0: dist_charge = 20.0
            elif distance <= 10.0: dist_charge = 30.0
            elif distance <= 20.0: dist_charge = 50.0
            elif distance <= 50.0: dist_charge = 80.0
            elif distance <= 100.0: dist_charge = 120.0
            elif distance <= 250.0: dist_charge = 180.0
            elif distance <= 500.0: dist_charge = 250.0
            elif distance <= 1000.0: dist_charge = 350.0
            else: dist_charge = 500.0

            # Step 6: Service Charge
            service_charge = 0.0
            prio_lower = priority.lower()
            if "express" in prio_lower: service_charge = 100.0
            elif "next day" in prio_lower: service_charge = 75.0
            elif "same day" in prio_lower: service_charge = 150.0

            # Step 7: COD Charge
            cod_charge = 0.0
            if payment_method.upper() == "COD":
                cod_charge = max(30.0, 0.02 * declared_value)

            # Step 8: Fragile Handling
            fragile_charge = 50.0 if is_fragile else 0.0

            # Step 9: Insurance Protection
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

    messages = [{"role": "system", "content": system_instruction}]
    for msg in history_records:
        messages.append({"role": msg.sender, "content": msg.content})
    messages.append({"role": "user", "content": question})

    # 3. Detect and call Ollama server
    installed_models = get_installed_ollama_models()
    if not installed_models:
        # Fallback to local matching engine if Ollama is offline/not ready
        fallback_reply = run_local_fallback_query(question, role, current_user, db)
        
        # Save assistant fallback reply to DB
        assistant_msg = ChatMessage(session_id=session.id, sender="assistant", content=fallback_reply)
        db.add(assistant_msg)
        db.commit()
        return {"response": fallback_reply}

    # Auto-detect models, prioritizing instruct/chat models
    model_name = "qwen2.5:1.5b-instruct"
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

        # Parse custom JSON text tool calls if native tool calling was not triggered
        if not tool_calls:
            # Regex match ```json {"tool": "..."} ``` or inline JSON
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

        # 4. Handle Tool Calls & verify RBAC boundaries
        if tool_calls:
            messages.append(choice_message)
            
            for call in tool_calls:
                call_id = call.get("id")
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

        # Save final response to PostgreSQL
        new_assistant_msg = ChatMessage(session_id=session.id, sender="assistant", content=final_content)
        db.add(new_assistant_msg)
        db.commit()

        return {"response": final_content}

    except Exception as e:
        print("Error during Ollama execution:", e)
        # Fallback to local queries
        fallback_reply = run_local_fallback_query(question, role, current_user, db)
        assistant_msg = ChatMessage(session_id=session.id, sender="assistant", content=fallback_reply)
        db.add(assistant_msg)
        db.commit()
        return {"response": fallback_reply}
