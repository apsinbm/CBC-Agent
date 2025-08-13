#!/usr/bin/env python3
"""
Seed data generator for CBC Analytics
Generates realistic test data for development and testing
"""

import random
import json
import uuid
from datetime import datetime, timedelta
import asyncio
import httpx
from typing import List, Dict, Any
import hashlib
import hmac

# Configuration
API_BASE_URL = "http://localhost:8001"
HMAC_SECRET = "change-me-in-production"
NUM_GUESTS = 100
NUM_SESSIONS_PER_GUEST = 5
NUM_EVENTS_PER_SESSION = 20

# Sample data
PAGE_PATHS = [
    "/", "/dining", "/accommodations", "/activities", "/weather",
    "/faq", "/about", "/contact", "/services", "/events",
    "/dining/restaurant", "/dining/bar", "/activities/golf",
    "/activities/tennis", "/activities/pool"
]

FAQ_CATEGORIES = [
    "Dining", "Accommodations", "Activities", 
    "Transportation", "Club Info", "Events"
]

FAQ_IDS = [f"faq_{cat.lower()}_{i}" for cat in FAQ_CATEGORIES for i in range(1, 6)]

SEARCH_QUERIES = [
    "pool hours", "restaurant menu", "wifi password", "tennis booking",
    "golf tee times", "room service", "spa services", "beach access",
    "parking", "dress code", "happy hour", "breakfast hours",
    "gym facilities", "shuttle schedule", "check in time"
]

SERVICE_CATEGORIES = [
    "room_service", "concierge", "housekeeping", 
    "maintenance", "dining_reservation", "activity_booking"
]

DEVICE_TYPES = ["mobile", "desktop", "tablet"]
LOCALES = ["en-US", "en-GB", "en-CA"]
COUNTRIES = ["US", "CA", "GB", "BM"]

def generate_hmac_signature(payload: Dict[str, Any]) -> str:
    """Generate HMAC signature for webhook"""
    message = json.dumps(payload, sort_keys=True)
    signature = hmac.new(
        HMAC_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature

def generate_guest_id() -> str:
    """Generate pseudonymous guest ID"""
    return hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()[:16]

def generate_session_id() -> str:
    """Generate session ID"""
    return f"ses_{uuid.uuid4().hex[:12]}"

def generate_page_view_event(session_id: str, guest_id: str, ts: datetime) -> Dict[str, Any]:
    """Generate page view event"""
    path = random.choice(PAGE_PATHS)
    return {
        "app_id": "CBC-Agent",
        "event_type": "page_view",
        "ts": ts.isoformat(),
        "session_id": session_id,
        "guest_pseudonymous_id": guest_id,
        "channel": "web",
        "locale": random.choice(LOCALES),
        "device_type": random.choice(DEVICE_TYPES),
        "app_version": "1.0.0",
        "consent_flags": {
            "analytics": True,
            "marketing": random.choice([True, False])
        },
        "path": path,
        "referrer": random.choice([None, "https://google.com", "https://facebook.com"]),
        "ms_on_page": random.randint(1000, 60000)
    }

def generate_search_event(session_id: str, guest_id: str, ts: datetime) -> Dict[str, Any]:
    """Generate search event"""
    query = random.choice(SEARCH_QUERIES)
    results_count = random.randint(0, 20)
    return {
        "app_id": "CBC-Agent",
        "event_type": "search",
        "ts": ts.isoformat(),
        "session_id": session_id,
        "guest_pseudonymous_id": guest_id,
        "channel": "web",
        "locale": random.choice(LOCALES),
        "device_type": random.choice(DEVICE_TYPES),
        "app_version": "1.0.0",
        "consent_flags": {
            "analytics": True,
            "marketing": random.choice([True, False])
        },
        "query_redacted": f"[REDACTED_{len(query)}]",
        "results_count": results_count,
        "zero_result": results_count == 0
    }

def generate_faq_view_event(session_id: str, guest_id: str, ts: datetime) -> Dict[str, Any]:
    """Generate FAQ view event"""
    faq_id = random.choice(FAQ_IDS)
    return {
        "app_id": "CBC-Agent",
        "event_type": "faq_view",
        "ts": ts.isoformat(),
        "session_id": session_id,
        "guest_pseudonymous_id": guest_id,
        "channel": "web",
        "locale": random.choice(LOCALES),
        "device_type": random.choice(DEVICE_TYPES),
        "app_version": "1.0.0",
        "consent_flags": {
            "analytics": True,
            "marketing": random.choice([True, False])
        },
        "faq_id": faq_id,
        "dwell_ms": random.randint(5000, 120000)
    }

def generate_chat_start_event(session_id: str, guest_id: str, ts: datetime) -> Dict[str, Any]:
    """Generate chat start event"""
    return {
        "app_id": "CBC-Agent",
        "event_type": "chat_start",
        "ts": ts.isoformat(),
        "session_id": session_id,
        "guest_pseudonymous_id": guest_id,
        "channel": "web",
        "locale": random.choice(LOCALES),
        "device_type": random.choice(DEVICE_TYPES),
        "app_version": "1.0.0",
        "consent_flags": {
            "analytics": True,
            "marketing": random.choice([True, False])
        },
        "entry_point": random.choice(["floating_button", "help_menu", "faq_escalation"])
    }

def generate_service_request_event(guest_id: str, ts: datetime) -> Dict[str, Any]:
    """Generate service request webhook event"""
    request_id = f"req_{uuid.uuid4().hex[:8]}"
    category = random.choice(SERVICE_CATEGORIES)
    
    payload = {
        "request_id": request_id,
        "guest_id": guest_id,
        "channel": "chatbot",
        "category": category,
        "subcategory": f"{category}_sub",
        "priority": random.choice(["low", "medium", "high", "urgent"]),
        "ts": ts.isoformat()
    }
    
    return {
        "payload": payload,
        "signature": generate_hmac_signature(payload),
        "ts": ts.isoformat()
    }

async def send_event(client: httpx.AsyncClient, event_data: Dict[str, Any]):
    """Send event to ingest API"""
    try:
        response = await client.post(
            f"{API_BASE_URL}/ingest/event",
            json=event_data,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code != 200:
            print(f"Failed to send event: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error sending event: {e}")

async def send_webhook(client: httpx.AsyncClient, webhook_type: str, webhook_data: Dict[str, Any]):
    """Send webhook to ingest API"""
    try:
        response = await client.post(
            f"{API_BASE_URL}/webhook/cbc-agent/{webhook_type}",
            json=webhook_data,
            headers={
                "Content-Type": "application/json",
                "X-Signature": webhook_data.get("signature", "")
            }
        )
        if response.status_code != 200:
            print(f"Failed to send webhook: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error sending webhook: {e}")

async def generate_guest_session(client: httpx.AsyncClient, guest_id: str, start_time: datetime):
    """Generate a complete session for a guest"""
    session_id = generate_session_id()
    current_time = start_time
    
    # Generate various events for the session
    event_types = [
        generate_page_view_event,
        generate_search_event,
        generate_faq_view_event,
        generate_chat_start_event
    ]
    
    for _ in range(random.randint(5, NUM_EVENTS_PER_SESSION)):
        event_generator = random.choice(event_types[:3])  # More page views, searches, FAQs
        event = event_generator(session_id, guest_id, current_time)
        await send_event(client, event)
        
        # Advance time
        current_time += timedelta(seconds=random.randint(10, 300))
        
        # Small delay to avoid overwhelming the API
        await asyncio.sleep(0.01)
    
    # Occasionally create a service request
    if random.random() < 0.2:
        webhook_data = generate_service_request_event(guest_id, current_time)
        await send_webhook(client, "service_request", webhook_data)
    
    print(f"Generated session {session_id} for guest {guest_id}")

async def main():
    """Main function to generate seed data"""
    print(f"Starting seed data generation...")
    print(f"API URL: {API_BASE_URL}")
    print(f"Generating data for {NUM_GUESTS} guests")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test connection
        try:
            response = await client.get(f"{API_BASE_URL}/health")
            if response.status_code != 200:
                print(f"API health check failed: {response.status_code}")
                return
            print("API connection successful")
        except Exception as e:
            print(f"Cannot connect to API: {e}")
            print("Make sure the API is running (docker-compose up)")
            return
        
        # Generate data for each guest
        tasks = []
        base_time = datetime.utcnow() - timedelta(days=30)
        
        for i in range(NUM_GUESTS):
            guest_id = generate_guest_id()
            
            # Generate multiple sessions for each guest over time
            for j in range(random.randint(1, NUM_SESSIONS_PER_GUEST)):
                session_start = base_time + timedelta(
                    days=random.randint(0, 30),
                    hours=random.randint(0, 23),
                    minutes=random.randint(0, 59)
                )
                tasks.append(generate_guest_session(client, guest_id, session_start))
            
            # Process in batches to avoid overwhelming the system
            if len(tasks) >= 10:
                await asyncio.gather(*tasks)
                tasks = []
                print(f"Progress: {i+1}/{NUM_GUESTS} guests")
        
        # Process remaining tasks
        if tasks:
            await asyncio.gather(*tasks)
        
        print(f"\nSeed data generation complete!")
        print(f"Generated approximately:")
        print(f"  - {NUM_GUESTS} unique guests")
        print(f"  - {NUM_GUESTS * 3} sessions (average)")
        print(f"  - {NUM_GUESTS * 3 * 10} events (average)")

if __name__ == "__main__":
    asyncio.run(main())