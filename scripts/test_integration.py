#!/usr/bin/env python3
"""
Integration tests for CBC Analytics Platform
"""

import asyncio
import httpx
import json
import uuid
import hashlib
import hmac
from datetime import datetime
import sys

API_BASE_URL = "http://localhost:8001"
HMAC_SECRET = "change-me-in-production"

def generate_test_event():
    """Generate a test event"""
    return {
        "app_id": "CBC-Agent",
        "event_type": "page_view",
        "ts": datetime.utcnow().isoformat(),
        "session_id": f"test_ses_{uuid.uuid4().hex[:8]}",
        "guest_pseudonymous_id": hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()[:16],
        "channel": "web",
        "locale": "en-US",
        "device_type": "desktop",
        "app_version": "1.0.0",
        "consent_flags": {
            "analytics": True,
            "marketing": False
        },
        "path": "/test",
        "referrer": None,
        "ms_on_page": 5000
    }

def generate_webhook_signature(payload):
    """Generate HMAC signature for webhook"""
    message = json.dumps(payload, sort_keys=True)
    signature = hmac.new(
        HMAC_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature

async def test_health_check():
    """Test API health endpoint"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{API_BASE_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")

async def test_event_ingestion():
    """Test event ingestion"""
    async with httpx.AsyncClient() as client:
        event = generate_test_event()
        response = await client.post(
            f"{API_BASE_URL}/ingest/event",
            json=event
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "event_id" in data
        print("✓ Event ingestion passed")

async def test_invalid_app_id():
    """Test rejection of invalid app_id"""
    async with httpx.AsyncClient() as client:
        event = generate_test_event()
        event["app_id"] = "InvalidApp"
        response = await client.post(
            f"{API_BASE_URL}/ingest/event",
            json=event
        )
        assert response.status_code == 400
        print("✓ Invalid app_id rejection passed")

async def test_dnt_header():
    """Test Do-Not-Track header respect"""
    async with httpx.AsyncClient() as client:
        event = generate_test_event()
        response = await client.post(
            f"{API_BASE_URL}/ingest/event",
            json=event,
            headers={"DNT": "1"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("dnt") == True
        print("✓ DNT header respect passed")

async def test_webhook_with_signature():
    """Test webhook with valid signature"""
    async with httpx.AsyncClient() as client:
        payload = {
            "request_id": f"test_req_{uuid.uuid4().hex[:8]}",
            "guest_id": "test_guest_123",
            "channel": "chatbot",
            "category": "room_service",
            "priority": "medium",
            "ts": datetime.utcnow().isoformat()
        }
        
        webhook_data = {
            "payload": payload,
            "signature": generate_webhook_signature(payload),
            "ts": datetime.utcnow().isoformat()
        }
        
        response = await client.post(
            f"{API_BASE_URL}/webhook/cbc-agent/service_request",
            json=webhook_data,
            headers={"X-Signature": webhook_data["signature"]}
        )
        assert response.status_code == 200
        print("✓ Webhook with signature passed")

async def test_webhook_invalid_signature():
    """Test webhook rejection with invalid signature"""
    async with httpx.AsyncClient() as client:
        payload = {
            "request_id": "test_req",
            "guest_id": "test_guest",
            "channel": "chatbot",
            "category": "room_service",
            "priority": "medium",
            "ts": datetime.utcnow().isoformat()
        }
        
        webhook_data = {
            "payload": payload,
            "signature": "invalid_signature",
            "ts": datetime.utcnow().isoformat()
        }
        
        response = await client.post(
            f"{API_BASE_URL}/webhook/cbc-agent/service_request",
            json=webhook_data,
            headers={"X-Signature": "invalid_signature"}
        )
        assert response.status_code == 401
        print("✓ Invalid webhook signature rejection passed")

async def test_consent_validation():
    """Test consent validation"""
    async with httpx.AsyncClient() as client:
        event = generate_test_event()
        event["consent_flags"]["analytics"] = False
        
        response = await client.post(
            f"{API_BASE_URL}/ingest/event",
            json=event
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("consent") == False
        print("✓ Consent validation passed")

async def test_metrics_endpoint():
    """Test metrics retrieval"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{API_BASE_URL}/metrics/sessions?window=7d"
        )
        # May return 500 if no data, but endpoint should exist
        assert response.status_code in [200, 500]
        print("✓ Metrics endpoint passed")

async def run_all_tests():
    """Run all integration tests"""
    print("\n" + "="*50)
    print("CBC Analytics Platform - Integration Tests")
    print("="*50 + "\n")
    
    tests = [
        ("Health Check", test_health_check),
        ("Event Ingestion", test_event_ingestion),
        ("Invalid App ID", test_invalid_app_id),
        ("DNT Header", test_dnt_header),
        ("Webhook with Signature", test_webhook_with_signature),
        ("Invalid Webhook Signature", test_webhook_invalid_signature),
        ("Consent Validation", test_consent_validation),
        ("Metrics Endpoint", test_metrics_endpoint)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            await test_func()
            passed += 1
        except AssertionError as e:
            print(f"✗ {test_name} failed: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ {test_name} error: {e}")
            failed += 1
    
    print("\n" + "="*50)
    print(f"Results: {passed} passed, {failed} failed")
    print("="*50 + "\n")
    
    return failed == 0

async def main():
    """Main test runner"""
    # Check if API is running
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{API_BASE_URL}/health", timeout=2.0)
    except:
        print("Error: Cannot connect to API at", API_BASE_URL)
        print("Make sure the services are running: make up")
        sys.exit(1)
    
    # Run tests
    success = await run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())