from fastapi import FastAPI, HTTPException, Depends, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import os
import sys
import logging
import structlog
from datetime import datetime
from typing import Optional, Dict, Any
import hmac
import hashlib
import ipaddress
import json
from dotenv import load_dotenv

# Add parent directory to path for shared schemas
sys.path.append(os.path.join(os.path.dirname(__file__), '../../shared/src'))
from python_schemas import *

from .database import init_db, get_db
from .privacy import redact_pii, process_ip_data, validate_consent
from .geo import get_geo_data
from .metrics import track_event, get_metrics
from .webhooks import verify_webhook_signature

load_dotenv()

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    logger.info("CBC-Agent Analytics Ingest API started", 
                env=os.getenv("ENVIRONMENT", "development"))
    yield
    # Shutdown
    logger.info("CBC-Agent Analytics Ingest API shutting down")

app = FastAPI(
    title="CBC-Agent Analytics Ingest API",
    description="Internal analytics data ingestion for CBC-Agent",
    version="1.0.0",
    docs_url="/docs" if os.getenv("ENVIRONMENT") == "development" else None,
    redoc_url=None,
    lifespan=lifespan
)

# Security middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# Configuration
COLLECT_PII = os.getenv("COLLECT_PII", "false").lower() == "true"
STORE_RAW_IP = os.getenv("STORE_RAW_IP", "false").lower() == "true"
SOURCE_APP = os.getenv("SOURCE_APP", "CBC-Agent")
HMAC_SECRET = os.getenv("HMAC_SECRET", "change-me-in-production")
IP_SALT = os.getenv("IP_SALT", "rotate-quarterly")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "app": "cbc-agent-analytics-ingest"}

@app.post("/ingest/event")
async def ingest_event(
    envelope: EventEnvelope,
    request: Request,
    db=Depends(get_db)
):
    """Main event ingestion endpoint"""
    try:
        # Validate source app
        if envelope.app_id != SOURCE_APP:
            raise HTTPException(status_code=400, detail="Invalid app_id")
        
        # Check Do-Not-Track
        if request.headers.get("DNT") == "1":
            logger.info("Respecting DNT header, event not stored")
            return {"status": "ok", "dnt": True}
        
        # Process IP data
        client_ip = envelope.ip_raw or request.client.host
        ip_data = None
        if client_ip and not STORE_RAW_IP:
            ip_data = process_ip_data(client_ip, IP_SALT)
            geo_data = await get_geo_data(client_ip)
            if geo_data:
                ip_data.update(geo_data)
        
        # Validate consent for PII operations
        if not validate_consent(envelope.consent_flags):
            logger.info("Consent not given for analytics", 
                       guest_id=envelope.guest_pseudonymous_id)
            return {"status": "ok", "consent": False}
        
        # Store event
        event_data = {
            "envelope": envelope.dict(),
            "ip_data": ip_data,
            "received_at": datetime.utcnow().isoformat()
        }
        
        # Track metrics
        await track_event(envelope.event_type, envelope.guest_pseudonymous_id)
        
        # Store in database (implementation depends on your DB choice)
        await db.store_event(event_data)
        
        logger.info("Event ingested", 
                   event_type=envelope.event_type,
                   guest_id=envelope.guest_pseudonymous_id)
        
        return {"status": "ok", "event_id": event_data.get("id")}
        
    except Exception as e:
        logger.error("Failed to ingest event", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/webhook/cbc-agent/{webhook_type}")
async def receive_webhook(
    webhook_type: str,
    payload: WebhookPayload,
    request: Request,
    x_signature: str = Header(None),
    db=Depends(get_db)
):
    """Secure webhook receiver for CBC-Agent events"""
    try:
        # Verify HMAC signature
        if not verify_webhook_signature(
            payload.dict(), 
            x_signature or payload.signature, 
            HMAC_SECRET
        ):
            logger.warning("Invalid webhook signature", webhook_type=webhook_type)
            raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Process webhook based on type
        if webhook_type == "service_request":
            event = ServiceRequestCreatedEvent(**payload.payload)
        elif webhook_type == "chat_session":
            event = ChatStartEvent(**payload.payload)
        elif webhook_type == "booking":
            # Handle booking webhooks
            pass
        else:
            logger.warning("Unknown webhook type", webhook_type=webhook_type)
            raise HTTPException(status_code=400, detail="Unknown webhook type")
        
        # Store webhook data
        await db.store_webhook(webhook_type, event.dict())
        
        logger.info("Webhook processed", webhook_type=webhook_type)
        return {"status": "ok"}
        
    except Exception as e:
        logger.error("Failed to process webhook", 
                    webhook_type=webhook_type, error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/guest/profile")
async def update_guest_profile(
    profile: GuestProfileOptional,
    db=Depends(get_db)
):
    """Update guest profile (requires consent)"""
    if not COLLECT_PII:
        raise HTTPException(status_code=403, detail="PII collection disabled")
    
    try:
        # Verify consent is given for this guest
        consent = await db.get_guest_consent(profile.guest_id)
        if not consent or not consent.get("consent_given"):
            raise HTTPException(status_code=403, detail="Consent not given")
        
        # Store profile
        await db.upsert_guest_profile(profile.dict())
        
        logger.info("Guest profile updated", guest_id=profile.guest_id)
        return {"status": "ok"}
        
    except Exception as e:
        logger.error("Failed to update guest profile", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/consent")
async def update_consent(
    event: ConsentChangeEvent,
    db=Depends(get_db)
):
    """Update guest consent preferences"""
    try:
        await db.update_consent(
            event.guest_id,
            event.consent_given,
            event.purposes
        )
        
        # Track consent change event
        await track_event("consent_change", event.guest_id)
        
        logger.info("Consent updated", 
                   guest_id=event.guest_id,
                   consent_given=event.consent_given)
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error("Failed to update consent", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/metrics/{metric_type}")
async def get_metrics_endpoint(
    metric_type: str,
    window: str = "7d",
    segment: Optional[str] = None
):
    """Get metrics for admin dashboard"""
    try:
        metrics = await get_metrics(metric_type, window, segment)
        return metrics
    except Exception as e:
        logger.error("Failed to get metrics", 
                    metric_type=metric_type, error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/privacy/export")
async def export_guest_data(
    guest_id: str,
    token: str,
    db=Depends(get_db)
):
    """Export all data for a guest (GDPR)"""
    try:
        # Verify token
        if not await db.verify_privacy_token(guest_id, token):
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Gather all data
        data = await db.export_guest_data(guest_id)
        
        logger.info("Guest data exported", guest_id=guest_id)
        return data
        
    except Exception as e:
        logger.error("Failed to export guest data", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/privacy/delete")
async def delete_guest_data(
    guest_id: str,
    token: str,
    db=Depends(get_db)
):
    """Delete all data for a guest (GDPR)"""
    try:
        # Verify token
        if not await db.verify_privacy_token(guest_id, token):
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Delete all data
        await db.delete_guest_data(guest_id)
        
        logger.info("Guest data deleted", guest_id=guest_id)
        return {"status": "deleted"}
        
    except Exception as e:
        logger.error("Failed to delete guest data", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8001)),
        reload=os.getenv("ENVIRONMENT") == "development"
    )