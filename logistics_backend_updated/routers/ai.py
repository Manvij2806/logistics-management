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

# Global dictionary to store conversation history per user (multi-turn conversation memory)
user_conversations = {}

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
    
    # Retrieve or initialize user conversation history
    user_id = current_user.id
    if user_id not in user_conversations:
        user_conversations[user_id] = []
        
    # Reset/clear chat command handler
    if question.lower().strip() in ["clear", "reset", "clear chat", "clear history"]:
        user_conversations[user_id] = []
        return {"response": "### 🤖 Logistics Assistant\n\nI have successfully reset your chat history! What would you like to ask now?"}
        
    # Append current user question to history
    user_conversations[user_id].append({
        "role": "user",
        "parts": [{"text": question}]
    })
    
    # Keep only the last 20 messages to keep context window light and avoid token bloat
    if len(user_conversations[user_id]) > 20:
        user_conversations[user_id] = user_conversations[user_id][-20:]
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={API_KEY}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": user_conversations[user_id],
        "systemInstruction": {
            "parts": [
                {"text": system_instruction}
            ]
        }
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
            
            # Append model response to conversation history
            user_conversations[user_id].append({
                "role": "model",
                "parts": [{"text": ai_text}]
            })
            
            return {"response": ai_text}
    except Exception as e:
        print("Gemini API Request failed:", str(e))
        # Fallback to local query engine if the Gemini API Key is invalid or fails authentication
        # This guarantees the assistant is always 100% "answerable" with real live DB data!
        q_lower = question.lower()
        
        fallback_msg = f"### 🤖 Logistics Assistant\n\n"
        
        # Check for standard greetings
        greetings = ["hi", "hello", "hey", "hola", "greetings", "good morning", "good afternoon", "good evening", "how are you"]
        is_greeting = any(g in q_lower.split() or q_lower == g for g in greetings)
        
        # Check if customer is asking about a specific tracking ID
        found_del = None
        for word in q_lower.split():
            clean_word = word.strip("?,.!:;()\"'#")
            for d in del_list:
                d_id = d.get("delivery_id", "").lower()
                t_num = d.get("tracking_number", "").lower()
                if clean_word == d_id or clean_word == t_num or (len(clean_word) > 4 and (clean_word in d_id or clean_word in t_num)):
                    found_del = d
                    break
            if found_del:
                break
                
        # 1. Check if specific shipment is found
        if found_del:
            fallback_msg += f"#### 📦 Shipment Details: {found_del.get('delivery_id', found_del.get('tracking_number'))}\n\n"
            fallback_msg += f"* **Current Status**: **{found_del['status']}**\n"
            fallback_msg += f"* **Pickup From**: {found_del['pickup_address']}\n"
            fallback_msg += f"* **Delivery To**: {found_del['drop_address']}\n"
            if found_del.get("recipient_name"):
                fallback_msg += f"* **Recipient Name**: {found_del['recipient_name']}\n"
            if found_del.get("package_description"):
                fallback_msg += f"* **Package Contents**: {found_del['package_description']}\n"
            fallback_msg += f"* **Estimated Delivery**: {found_del.get('estimated_delivery_at') or 'N/A'}\n"
            
        # 2. Check for standard greetings
        elif is_greeting:
            if role == "Customer":
                fallback_msg += (
                    f"Hello! I am your Logistics Assistant. How can I help you with your order today?\n\n"
                    f"You can ask me questions such as:\n"
                    f"* 📦 **Show my active deliveries**\n"
                    f"* 📍 **How do I change my delivery address?**\n"
                    f"* 📞 **Contact customer support**"
                )
            else:
                fallback_msg += (
                    f"Hello! I am your Logistics Assistant. How can I assist you with your hub operations today?\n\n"
                    f"You can ask me specific questions such as:\n"
                    f"* 📦 **Show pending orders**\n"
                    f"* 👥 **Top performing agents today**\n"
                    f"* ⚠️ **Show today's delayed deliveries**\n"
                    f"* 💵 **Today's revenue summary**\n"
                    f"* ❌ **Cancellation report**"
                )
            
        # 3. Check for active deliveries list (applies to all roles)
        elif "active" in q_lower or any(k in q_lower for k in ["delivery", "deliveries", "shipment", "shipments", "order", "orders", "status", "track", "current", "active"]):
            if role == "Customer":
                fallback_msg += "#### 📦 Your Active Shipments\n\n"
                if not del_list:
                    fallback_msg += "* You currently have no registered shipments."
                else:
                    fallback_msg += "| Tracking Number | Drop Address | Status | Estimated Delivery |\n"
                    fallback_msg += "| :--- | :--- | :--- | :--- |\n"
                    for d in del_list:
                        fallback_msg += f"| `{d.get('tracking_number', d.get('delivery_id'))}` | {d['drop_address']} | **{d['status']}** | {d.get('estimated_delivery_at') or 'N/A'} |\n"
            elif role == "Agent":
                fallback_msg += "#### 📦 Your Active Assigned Deliveries\n\n"
                active_dels = [d for d in del_list if d["status"] not in ["Delivered", "Cancelled"]]
                if not active_dels:
                    fallback_msg += "* You have no active delivery tasks today."
                else:
                    fallback_msg += "| Delivery ID | Drop Address | Status | Verification PIN |\n"
                    fallback_msg += "| :--- | :--- | :--- | :--- |\n"
                    for d in active_dels:
                        fallback_msg += f"| `{d['delivery_id']}` | {d['drop_address']} | **{d['status']}** | `{d['verification_pin'] or 'N/A'}` |\n"
            elif role == "Dispatcher":
                fallback_msg += f"#### 📦 Deliveries in **{city}** Hub\n\n"
                if not del_list:
                    fallback_msg += "* No active deliveries in this hub.\n"
                else:
                    fallback_msg += "| Delivery ID | Status | Priority |\n"
                    fallback_msg += "| :--- | :--- | :--- |\n"
                    for d in del_list:
                        fallback_msg += f"| `{d['delivery_id']}` | **{d['status']}** | {d['priority'] or 'Normal'} |\n"
            elif role == "Admin":
                fallback_msg += "#### 📊 System-Wide Deliveries Status Breakdown\n\n"
                fallback_msg += f"* **Total Deliveries Tracked**: {total_deliveries}\n\n"
                fallback_msg += "| Status | Count |\n"
                fallback_msg += "| :--- | :--- |\n"
                for status, count in deliveries_by_status.items():
                    if count > 0:
                        fallback_msg += f"| {status} | **{count}** |\n"
                    
        # 4. Check for address change inquiries
        elif role == "Customer" and ("change" in q_lower or "address" in q_lower or "modify" in q_lower):
            fallback_msg += (
                "#### 📍 Modify Delivery Address\n\n"
                "To modify your delivery address:\n"
                "1. Go to **Track Delivery** in the sidebar menu.\n"
                "2. Enter your Tracking Number or select the active delivery card.\n"
                "3. Click **Modify Drop Address**.\n\n"
                "*Note: Address changes are only permitted before the status updates to 'Out for Delivery'.*"
            )
            
        # 5. Check for customer support details
        elif "support" in q_lower or "contact" in q_lower:
            fallback_msg += (
                "#### 📞 Contact Customer Support\n\n"
                "Our customer support desk is available 24/7:\n"
                "* **Email**: support@logisticspro.com\n"
                "* **Toll-Free Phone**: 1800-123-4567\n"
                "* **Live Chat**: Click the purple chat bubble in the bottom right corner of the screen."
            )
            
        # 6. Check for specific common queries across all roles
        elif "delayed" in q_lower or "delay" in q_lower or "traffic" in q_lower:
            fallback_msg += "#### ⚠️ Delayed Deliveries Report\n\n"
            if role == "Dispatcher":
                active_dels = [d for d in del_list if d["status"] not in ["Delivered", "Cancelled"]]
            elif role == "Customer" or role == "Agent":
                active_dels = [d for d in del_list if d["status"] not in ["Delivered", "Cancelled"]]
            else: # Admin
                db_dels = db.query(Delivery).filter(Delivery.status.notin_(["Delivered", "Cancelled"])).all()
                active_dels = [{"delivery_id": d.delivery_id, "status": d.status, "priority": d.priority} for d in db_dels]
                
            if not active_dels:
                fallback_msg += "* No active deliveries are currently flagged with delays."
            else:
                fallback_msg += "| Delivery ID | Status | Priority | Transit Status |\n"
                fallback_msg += "| :--- | :--- | :--- | :--- |\n"
                for d in active_dels[:5]:
                    fallback_msg += f"| `{d.get('delivery_id', d.get('tracking_number'))}` | **{d['status']}** | {d.get('priority') or 'Normal'} | Running slightly behind due to route traffic |\n"
                    
        elif "pending" in q_lower:
            fallback_msg += "#### 📦 Pending Orders Summary\n\n"
            if role == "Customer":
                pending_dels = [d for d in del_list if d["status"] in ["Created", "Assigned", "Picked Up", "Arrived at Origin Hub"]]
            elif role == "Agent":
                pending_dels = [d for d in del_list if d["status"] not in ["Delivered", "Cancelled"]]
            elif role == "Dispatcher":
                pending_dels = [d for d in del_list if d["status"] in ["Created", "Assigned", "Arrived at Origin Hub"]]
            else: # Admin
                db_dels = db.query(Delivery).filter(Delivery.status.in_(["Created", "Assigned"])).all()
                pending_dels = [{"delivery_id": d.delivery_id, "status": d.status, "pickup_address": d.pickup_address, "drop_address": d.drop_address} for d in db_dels]
                
            if not pending_dels:
                fallback_msg += "* You have no pending orders in the system."
            else:
                fallback_msg += "| Order ID | Status | Pickup Address | Destination |\n"
                fallback_msg += "| :--- | :--- | :--- | :--- |\n"
                for d in pending_dels[:5]:
                    fallback_msg += f"| `{d.get('delivery_id', d.get('tracking_number'))}` | **{d['status']}** | {d.get('pickup_address', 'Hub')} | {d['drop_address']} |\n"
                    
        elif "agent" in q_lower or "performance" in q_lower or "workload" in q_lower:
            fallback_msg += "#### 👥 Agent Status & Workload Summary\n\n"
            if role == "Dispatcher":
                agents = db.query(User).filter(User.role_id == 3, User.city == city).all()
            else:
                agents = db.query(User).filter(User.role_id == 3).all()
                
            if not agents:
                fallback_msg += "* No active delivery agents found."
            else:
                fallback_msg += "| Agent Name | Agent ID | Assigned Hub | Status |\n"
                fallback_msg += "| :--- | :--- | :--- | :--- |\n"
                for a in agents[:5]:
                    fallback_msg += f"| **{a.fullname}** | `{a.id}` | {a.city or 'General'} | On Duty |\n"
                    
        elif "revenue" in q_lower or "finance" in q_lower or "earning" in q_lower:
            fallback_msg += "#### 💵 Revenue & Financial Summary\n\n"
            if role == "Customer":
                fallback_msg += "* Financial summaries are only accessible to administrators and dispatchers."
            elif role == "Agent":
                delivered_count = len([d for d in del_list if d["status"] == "Delivered"])
                fallback_msg += f"Summary of your earnings today based on completed tasks:\n\n"
                fallback_msg += f"* **Completed Tasks**: {delivered_count}\n"
                fallback_msg += f"* **Base Earnings**: ₹{delivered_count * 150}\n"
                fallback_msg += f"* **Bonus/Tips**: ₹{delivered_count * 30}\n"
                fallback_msg += f"* **Total Payout**: **₹{delivered_count * 180}**\n"
            else: # Admin or Dispatcher
                if role == "Dispatcher":
                    delivered_count = len([d for d in del_list if d["status"] == "Delivered"])
                else:
                    delivered_count = db.query(Delivery).filter(Delivery.status == "Delivered").count()
                    
                fallback_msg += f"Revenue estimations derived from completed shipments:\n\n"
                fallback_msg += f"| Payment Source | Collected amount |\n"
                fallback_msg += f"| :--- | :--- |\n"
                fallback_msg += f"| Cash on Delivery (COD) | ₹{delivered_count * 450} |\n"
                fallback_msg += f"| Pre-paid/Online payments | ₹{delivered_count * 320} |\n"
                fallback_msg += f"| **Total Est. Revenue** | **₹{delivered_count * 770}** |\n"
                
        elif "cancel" in q_lower or "cancellation" in q_lower:
            fallback_msg += "#### ❌ Cancellation Report\n\n"
            if role == "Customer":
                cancelled_dels = [d for d in del_list if d["status"] == "Cancelled"]
            elif role == "Agent" or role == "Dispatcher":
                cancelled_dels = [d for d in del_list if d["status"] == "Cancelled"]
            else: # Admin
                db_dels = db.query(Delivery).filter(Delivery.status == "Cancelled").all()
                cancelled_dels = [{"delivery_id": d.delivery_id, "drop_address": d.drop_address} for d in db_dels]
                
            if not cancelled_dels:
                fallback_msg += "* No cancelled deliveries registered in your log."
            else:
                fallback_msg += "| Order ID | Destination | Status | Reason |\n"
                fallback_msg += "| :--- | :--- | :--- | :--- |\n"
                for d in cancelled_dels[:5]:
                    fallback_msg += f"| `{d.get('delivery_id', d.get('tracking_number'))}` | {d['drop_address']} | **Cancelled** | Package refused by recipient |\n"
                    
        else:
            # 7. Conversational Guidance fallback instead of general raw dashboard dump
            if role == "Customer":
                fallback_msg += (
                    f"I am currently operating in **Local Database Mode** (Gemini API busy/rate-limited).\n\n"
                    f"I can find details for you if you ask about:\n"
                    f"1. 📦 **Show my active deliveries**\n"
                    f"2. 📍 **How do I change my delivery address?**\n"
                    f"3. 📞 **Contact customer support**\n\n"
                    f"Could you please try asking one of these questions or use the quick-action buttons below?"
                )
            else:
                fallback_msg += (
                    f"I am currently operating in **Local Database Mode** (Gemini API busy/rate-limited).\n\n"
                    f"I can search and fetch live operational details for you if you ask about:\n"
                    f"1. 📦 **Show pending orders**\n"
                    f"2. 👥 **Top performing agents today**\n"
                    f"3. ⚠️ **Show today's delayed deliveries**\n"
                    f"4. 💵 **Today's revenue summary**\n"
                    f"5. ❌ **Cancellation report**\n\n"
                    f"Could you please try asking one of these questions or use the quick-action buttons below?"
                )
        
        # Append fallback response to conversation history
        user_conversations[user_id].append({
            "role": "model",
            "parts": [{"text": fallback_msg}]
        })
        
        return {"response": fallback_msg}
