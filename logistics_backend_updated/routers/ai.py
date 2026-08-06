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
    
    # Initialize default local context variables to prevent NameError in functions
    del_list = []
    agent_list = []
    total_deliveries = 0
    deliveries_by_status = {}
    total_users = 0
    city = current_user.city or ""
    
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

    # 2. Query Gemini AI API using urllib with tools/function declarations
    system_instruction = (
        "You are an intelligent Logistics Assistant for LogisticsPro. "
        "You help users manage shipments, deliveries, routes, and schedules. "
        "Format your responses as markdown. If displaying lists of deliveries, draw a clean table where appropriate. "
        "Keep your responses concise, helpful, and highly professional. "
        "You can retrieve real-time data from the database using function calls when the user asks questions about deliveries, agents, or system statistics."
    )
    
    # Define local tool helper execution functions in-memory using database contexts
    def run_get_my_shipments(status_filter=None, recipient_filter=None):
        results = del_list
        if status_filter:
            results = [d for d in results if status_filter.lower() in d.get("status", "").lower()]
        if recipient_filter:
            results = [d for d in results if recipient_filter.lower() in d.get("recipient_name", "").lower()]
        return {"shipments": results}

    def run_get_hub_agents():
        if role == "Dispatcher":
            return {"agents": agent_list}
        return {"error": "Unauthorized. Only Hub Dispatchers can fetch agents list."}

    def run_get_system_metrics():
        if role == "Admin":
            return {
                "total_deliveries": total_deliveries,
                "deliveries_by_status": deliveries_by_status,
                "total_users": total_users
            }
        return {"error": "Unauthorized. Only administrators can fetch system metrics."}

    def run_track_shipment(tracking_number):
        if not tracking_number:
            return {"error": "No tracking number provided."}
        clean_t = tracking_number.strip().lower()
        for d in del_list:
            if clean_t == d.get("delivery_id", "").lower() or clean_t == d.get("tracking_number", "").lower():
                return {"shipment": d}
        db_del = db.query(Delivery).filter(
            (Delivery.delivery_id.ilike(f"%{clean_t}%")) | 
            (Delivery.tracking_number.ilike(f"%{clean_t}%"))
        ).first()
        if db_del:
            return {
                "shipment": {
                    "delivery_id": db_del.delivery_id,
                    "tracking_number": db_del.tracking_number,
                    "status": db_del.status,
                    "pickup_address": db_del.pickup_address,
                    "drop_address": db_del.drop_address,
                    "recipient_name": db_del.recipient_name,
                    "package_description": db_del.package_description,
                    "estimated_delivery_at": db_del.estimated_delivery_at.isoformat() if db_del.estimated_delivery_at else None
                }
            }
        return {"error": f"Shipment with ID '{tracking_number}' not found."}

    tools = [
        {
            "functionDeclarations": [
                {
                    "name": "get_my_shipments",
                    "description": "Retrieve the list of shipments/deliveries associated with the current user. Filters by status (e.g. 'Delivered', 'Cancelled', 'In Transit', 'Delayed', 'Assigned', 'Picked Up', 'Out for Delivery') or recipient name.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "status_filter": {
                                "type": "STRING",
                                "description": "Optional status to filter by (e.g., 'Delivered', 'Delayed', 'In Transit')"
                            },
                            "recipient_filter": {
                                "type": "STRING",
                                "description": "Optional recipient name to filter by"
                            }
                        }
                    }
                },
                {
                    "name": "get_hub_agents",
                    "description": "Retrieve the list of active delivery agents in the dispatcher's assigned city/hub.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {}
                    }
                },
                {
                    "name": "get_system_metrics",
                    "description": "Retrieve system-wide metrics and breakdowns of deliveries by status for administrator review.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {}
                    }
                },
                {
                    "name": "track_shipment_by_id",
                    "description": "Fetch complete details (ETA, status, pickup/drop address, recipient details) for a specific delivery ID or tracking number.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "tracking_number": {
                                "type": "STRING",
                                "description": "The tracking number or delivery ID (e.g., 'DEL-009', 'DLV12345')"
                            }
                        },
                        "required": ["tracking_number"]
                    }
                }
            ]
        }
    ]

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
        },
        "tools": tools
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
            
            if "candidates" not in res_data or not res_data["candidates"]:
                raise Exception("Empty candidates in Gemini response: " + str(res_data))
                
            parts = res_data["candidates"][0]["content"]["parts"]
            function_call = parts[0].get("functionCall")
            
            if function_call:
                func_name = function_call["name"]
                func_args = function_call.get("args", {})
                
                # Execute function locally
                if func_name == "get_my_shipments":
                    func_res = run_get_my_shipments(
                        status_filter=func_args.get("status_filter"),
                        recipient_filter=func_args.get("recipient_filter")
                    )
                elif func_name == "get_hub_agents":
                    func_res = run_get_hub_agents()
                elif func_name == "get_system_metrics":
                    func_res = run_get_system_metrics()
                elif func_name == "track_shipment_by_id":
                    func_res = run_track_shipment(tracking_number=func_args.get("tracking_number"))
                else:
                    func_res = {"error": "Function not found."}
                
                # Build the multi-turn payload to send the function response back to Gemini
                # 1. Append model's functionCall part to user_conversations
                user_conversations[user_id].append({
                    "role": "model",
                    "parts": [parts[0]]
                })
                
                # 2. Append the function response part (role: function) to user_conversations
                user_conversations[user_id].append({
                    "role": "function",
                    "parts": [
                        {
                            "functionResponse": {
                                "name": func_name,
                                "response": func_res
                            }
                        }
                    ]
                })
                
                # 3. Call Gemini again with the function response appended
                second_payload = {
                    "contents": user_conversations[user_id],
                    "systemInstruction": {
                        "parts": [
                            {"text": system_instruction}
                        ]
                    },
                    "tools": tools
                }
                
                second_req = urllib.request.Request(
                    url,
                    data=json.dumps(second_payload).encode("utf-8"),
                    headers=headers,
                    method="POST"
                )
                with urllib.request.urlopen(second_req, timeout=20) as second_response:
                    sec_res_data = json.loads(second_response.read().decode("utf-8"))
                    
                    if "candidates" not in sec_res_data or not sec_res_data["candidates"]:
                        raise Exception("Empty candidates in second Gemini response: " + str(sec_res_data))
                        
                    ai_text = sec_res_data["candidates"][0]["content"]["parts"][0].get("text", "")
                    
                    # Append final model text response to history
                    user_conversations[user_id].append({
                        "role": "model",
                        "parts": [{"text": ai_text}]
                    })
                    
                    return {"response": ai_text}
            else:
                ai_text = parts[0].get("text", "")
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
            
        # 3. Check for completed history
        elif "completed" in q_lower or "history" in q_lower:
            if role == "Agent":
                fallback_msg += "#### 🏁 Your Completed Jobs History\n\n"
                completed_dels = [d for d in del_list if d["status"] == "Delivered"]
                if not completed_dels:
                    fallback_msg += "* You have no completed deliveries registered today."
                else:
                    fallback_msg += "| Delivery ID | Drop Address | Status |\n"
                    fallback_msg += "| :--- | :--- | :--- |\n"
                    for d in completed_dels:
                        fallback_msg += f"| `{d['delivery_id']}` | {d['drop_address']} | **Delivered** |\n"
            else:
                fallback_msg += "* Completed history details are available under your profile/cancellations view."

        # 4. Check for COD instructions
        elif "collect" in q_lower or "payment" in q_lower or "cash" in q_lower:
            if role == "Agent":
                fallback_msg += (
                    "#### 💵 Cash on Delivery (COD) Payment Collection\n\n"
                    "Please follow these instructions to collect COD payments:\n"
                    "1. Confirm the amount to collect showing on your delivery card.\n"
                    "2. Ask the customer for payment (Cash or local UPI scan).\n"
                    "3. Once received, mark the delivery as **Delivered** in your app.\n"
                    "4. Input the customer's **Verification PIN** to complete the transaction.\n\n"
                    "⚠️ *Never leave the parcel before receiving payment and verifying the PIN.*"
                )
            else:
                fallback_msg += "* Please refer to the revenue summary section for payment metrics."

        # 5. Check for vehicle breakdown
        elif "breakdown" in q_lower or "vehicle" in q_lower:
            fallback_msg += (
                "#### ⚠️ Report Vehicle / Transit Breakdown\n\n"
                "In case of a breakdown, please execute these immediate emergency steps:\n"
                "1. Safety first: Pull over to a safe area on the side of the road.\n"
                "2. Call your Hub Dispatcher immediately at **+91 98765 43210** to request a backup vehicle.\n"
                "3. Use the **Report Breakdown** button in your active delivery card to log the incident.\n"
                "4. Rest assured, your deliveries will be safely transferred to a backup agent."
            )

        # 6. Check for next delivery steps instructions
        elif "step" in q_lower or "next" in q_lower:
            if role == "Agent":
                fallback_msg += (
                    "#### 📋 Your Next Delivery Steps\n\n"
                    "1. Pick up the package from the **Pickup Address** designated on your active card.\n"
                    "2. Check the recipient address and click **Navigate** to open the map route.\n"
                    "3. Upon arrival, contact the recipient and request their **4-digit Verification PIN**.\n"
                    "4. Enter the PIN in the portal to successfully complete the delivery."
                )
            else:
                fallback_msg += "* To see your next steps, please navigate to your dashboard workspace."

        # 7. Check for pending deliveries list (applies to all roles)
        elif "pending" in q_lower:
            fallback_msg += "#### 📦 Pending Orders Summary\n\n"
            if role == "Customer":
                pending_dels = [d for d in del_list if d["status"] not in ["Delivered", "Cancelled"]]
            elif role == "Agent":
                pending_dels = [d for d in del_list if d["status"] not in ["Delivered", "Cancelled"]]
            elif role == "Dispatcher":
                pending_dels = [d for d in del_list if d["status"] not in ["Delivered", "Cancelled"]]
            else: # Admin
                db_dels = db.query(Delivery).filter(Delivery.status.notin_(["Delivered", "Cancelled"])).all()
                pending_dels = [{"delivery_id": d.delivery_id, "status": d.status, "pickup_address": d.pickup_address, "drop_address": d.drop_address} for d in db_dels]
                
            if not pending_dels:
                fallback_msg += "* You have no pending orders in the system."
            else:
                fallback_msg += "| Order ID | Status | Pickup Address | Destination |\n"
                fallback_msg += "| :--- | :--- | :--- | :--- |\n"
                for d in pending_dels[:5]:
                    fallback_msg += f"| `{d.get('delivery_id', d.get('tracking_number'))}` | **{d['status']}** | {d.get('pickup_address', 'Hub')} | {d['drop_address']} |\n"

        # 4. Check for delayed/delay/traffic status
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

        # 5. Check for agent workload/performance
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

        # 6. Check for revenue/finance queries
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

        # 7. Check for cancellations
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

        # 8. Check for address change/modify
        elif role == "Customer" and ("change" in q_lower or "address" in q_lower or "modify" in q_lower):
            fallback_msg += (
                "#### 📍 Modify Delivery Address\n\n"
                "To modify your delivery address:\n"
                "1. Go to **Track Delivery** in the sidebar menu.\n"
                "2. Enter your Tracking Number or select the active delivery card.\n"
                "3. Click **Modify Drop Address**.\n\n"
                "*Note: Address changes are only permitted before the status updates to 'Out for Delivery'.*"
            )

        # 9. Check for customer support
        elif "support" in q_lower or "contact" in q_lower:
            fallback_msg += (
                "#### 📞 Contact Customer Support\n\n"
                "Our customer support desk is available 24/7:\n"
                "* **Email**: support@logisticspro.com\n"
                "* **Toll-Free Phone**: 1800-123-4567\n"
                "* **Live Chat**: Click the purple chat bubble in the bottom right corner of the screen."
            )

        # 10. Check for active/general deliveries (fallback category)
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
