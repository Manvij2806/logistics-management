from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
import urllib.request
from database import get_db, Delivery, User
from auth import get_current_user
from pydantic import BaseModel

router = APIRouter(
    prefix="/api/ai",
    tags=["AI Chatbot"],
)

import os

class ChatRequest(BaseModel):
    question: str

API_KEY = os.getenv("GEMINI_API_KEY", "")

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
    
    # 1. Fetch relevant logistics data based on user role
    logistics_context = ""
    
    if role == "Customer":
        # Find deliveries associated with customer phone or email or name
        deliveries = db.query(Delivery).filter(
            (Delivery.customer_phone == current_user.phone_number) | 
            (Delivery.sender_phone == current_user.phone_number) | 
            (Delivery.recipient_phone == current_user.phone_number) |
            (Delivery.customer_name == current_user.fullname)
        ).all()
        
        del_list = []
        for d in deliveries:
            del_list.append({
                "delivery_id": d.delivery_id,
                "tracking_number": d.tracking_number,
                "status": d.status,
                "pickup_address": d.pickup_address,
                "drop_address": d.drop_address,
                "recipient_name": d.recipient_name,
                "package_description": d.package_description,
                "estimated_delivery_at": d.estimated_delivery_at.isoformat() if d.estimated_delivery_at else None,
                "created_at": d.created_at.isoformat() if d.created_at else None
            })
        
        logistics_context = f"User is a Customer named {current_user.fullname} (Phone: {current_user.phone_number}). Their associated shipments: {json.dumps(del_list)}"
        
    elif role == "Agent":
        # Find deliveries assigned to this agent
        deliveries = db.query(Delivery).filter(Delivery.agent_id == current_user.id).all()
        
        del_list = []
        for d in deliveries:
            del_list.append({
                "delivery_id": d.delivery_id,
                "tracking_number": d.tracking_number,
                "status": d.status,
                "pickup_address": d.pickup_address,
                "drop_address": d.drop_address,
                "recipient_name": d.recipient_name,
                "recipient_phone": d.recipient_phone,
                "priority": d.priority,
                "payment_status": d.payment_status,
                "payment_method": d.payment_method,
                "verification_pin": d.verification_pin
            })
        
        logistics_context = f"User is a Delivery Agent named {current_user.fullname} (City: {current_user.city}). Their active/assigned deliveries: {json.dumps(del_list)}"
        
    elif role == "Dispatcher":
        city = current_user.city or ""
        # Find deliveries starting or ending in dispatcher's city
        deliveries = db.query(Delivery).filter(
            (Delivery.pickup_address.ilike(f"%{city}%")) | 
            (Delivery.drop_address.ilike(f"%{city}%"))
        ).all()
        
        del_list = []
        for d in deliveries:
            del_list.append({
                "delivery_id": d.delivery_id,
                "tracking_number": d.tracking_number,
                "status": d.status,
                "pickup_address": d.pickup_address,
                "drop_address": d.drop_address,
                "agent": d.agent,
                "priority": d.priority
            })
            
        # Find available agents in dispatcher's city
        agents = db.query(User).filter(User.role_id == 3, User.city == city).all()
        agent_list = [{"id": a.id, "name": a.fullname, "city": a.city} for a in agents]
        
        logistics_context = f"User is a Hub Dispatcher for city {city}. Deliveries in this hub/city: {json.dumps(del_list)}. Available Agents in city {city}: {json.dumps(agent_list)}"
        
    elif role == "Admin":
        # Summarize system-wide metrics
        total_deliveries = db.query(Delivery).count()
        deliveries_by_status = {}
        for status in ["Created", "Assigned", "Picked Up", "Arrived at Origin Hub", "In Transit Hub-to-Hub", "Arrived at Destination Hub", "Out for Delivery", "Delivered", "Cancelled"]:
            count = db.query(Delivery).filter(Delivery.status == status).count()
            deliveries_by_status[status] = count
            
        total_users = db.query(User).count()
        
        logistics_context = f"User is an Administrator. System-wide metrics: Total Deliveries: {total_deliveries}, Deliveries by Status: {json.dumps(deliveries_by_status)}, Total Users: {total_users}."

    # 2. Query Gemini AI API using urllib
    system_instruction = (
        "You are an intelligent Logistics Assistant for LogisticsPro. "
        "You help users manage shipments, deliveries, routes, and schedules. "
        "Format your responses as markdown. If displaying lists of deliveries, draw a clean table where appropriate. "
        "Keep your responses concise, helpful, and highly professional. "
        "Here is the database context of the current logged-in user:\n"
        f"{logistics_context}\n\n"
        "Please respond to the user's question accordingly."
    )
    
    prompt = f"{system_instruction}\n\nUser Question: {question}"
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ]
    }
    
    try:
        req_obj = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req_obj, timeout=20) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            ai_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
            return {"response": ai_text}
    except Exception as e:
        # Fallback to local query engine if the Gemini API Key is invalid or fails authentication
        # This guarantees the assistant is always 100% "answerable" with real live DB data!
        
        fallback_msg = (
            f"### 🤖 Logistics Assistant (Offline Fallback)\n\n"
            f"I encountered an issue querying the Gemini API (Error: {str(e)}).\n\n"
            f"However, using the live database, here is the operations summary for your **{role}** account:\n\n"
        )
        
        if role == "Customer":
            fallback_msg += f"Welcome **{current_user.fullname}**! Here are your registered shipments:\n\n"
            if not del_list:
                fallback_msg += "* You currently have no registered shipments."
            else:
                fallback_msg += "| Tracking Number | Drop Address | Status | Estimated Delivery |\n"
                fallback_msg += "| :--- | :--- | :--- | :--- |\n"
                for d in del_list:
                    fallback_msg += f"| `{d['tracking_number']}` | {d['drop_address']} | **{d['status']}** | {d['estimated_delivery_at'] or 'N/A'} |\n"
        
        elif role == "Agent":
            fallback_msg += f"Hello Agent **{current_user.fullname}**! Here is your assigned deliveries list:\n\n"
            if not del_list:
                fallback_msg += "* You have no assigned tasks today."
            else:
                fallback_msg += "| Delivery ID | Drop Address | Status | Verification PIN |\n"
                fallback_msg += "| :--- | :--- | :--- | :--- |\n"
                for d in del_list:
                    fallback_msg += f"| `{d['delivery_id']}` | {d['drop_address']} | **{d['status']}** | `{d['verification_pin'] or 'N/A'}` |\n"
        
        elif role == "Dispatcher":
            fallback_msg += f"Dispatcher Dashboard for **{city}** Hub:\n\n"
            fallback_msg += "#### 📦 Deliveries in Hub\n"
            if not del_list:
                fallback_msg += "* No active deliveries in this hub.\n"
            else:
                fallback_msg += "| Delivery ID | Status | Priority |\n"
                fallback_msg += "| :--- | :--- | :--- |\n"
                for d in del_list:
                    fallback_msg += f"| `{d['delivery_id']}` | **{d['status']}** | {d['priority'] or 'Normal'} |\n"
            
            fallback_msg += "\n#### 👥 Available Agents in Hub\n"
            if not agent_list:
                fallback_msg += "* No agents logged in this hub.\n"
            else:
                for a in agent_list:
                    fallback_msg += f"* Agent ID: `{a['id']}` - **{a['name']}**\n"
                    
        elif role == "Admin":
            fallback_msg += "#### 📊 System Metrics Summary\n"
            fallback_msg += f"* **Total registered users**: {total_users}\n"
            fallback_msg += f"* **Total deliveries tracked**: {total_deliveries}\n\n"
            fallback_msg += "#### 📈 Deliveries status breakdown:\n"
            for status, count in deliveries_by_status.items():
                if count > 0:
                    fallback_msg += f"* **{status}**: {count} shipments\n"
                    
        fallback_msg += f"\n\n*If you are the administrator, please check the `GEMINI_API_KEY` in the `.env` file on the backend server or verify its permissions in the Google Cloud Console.*"
        
        return {"response": fallback_msg}
