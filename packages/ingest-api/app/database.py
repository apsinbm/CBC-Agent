from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Integer, Float, JSON, Index, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from datetime import datetime, timedelta
import os
import json
from typing import Dict, Any, List, Optional
import structlog

logger = structlog.get_logger()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://cbc:cbc@localhost/cbc_analytics")

Base = declarative_base()

# Entities
class Guest(Base):
    __tablename__ = "guests"
    
    pseudonymous_id = Column(String, primary_key=True)
    consent_given = Column(Boolean, default=False)
    consent_purposes = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    locale = Column(String, nullable=True)
    device_type = Column(String)
    app_version = Column(String)
    membership_tier = Column(String, nullable=True)
    marketing_opt_in = Column(Boolean, default=False)
    
    __table_args__ = (
        Index('idx_guest_created', 'created_at'),
        Index('idx_guest_membership', 'membership_tier'),
    )

class GuestProfile(Base):
    __tablename__ = "guest_profiles"
    
    guest_id = Column(String, primary_key=True)
    name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    country = Column(String, nullable=True)
    member_id = Column(String, nullable=True)
    preferred_contact_method = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_profile_member', 'member_id'),
        Index('idx_profile_country', 'country'),
    )

class SessionData(Base):
    __tablename__ = "sessions"
    
    session_id = Column(String, primary_key=True)
    guest_id = Column(String, index=True)
    channel = Column(String)
    started_at = Column(DateTime)
    ended_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    entry_point = Column(String)
    pages_viewed = Column(Integer, default=0)
    device_type = Column(String)
    os = Column(String)
    app_version = Column(String)
    geo_country = Column(String, nullable=True)
    geo_region = Column(String, nullable=True)
    geo_city = Column(String, nullable=True)
    ip_trunc = Column(String)
    ip_hash = Column(String)
    
    __table_args__ = (
        Index('idx_session_guest', 'guest_id'),
        Index('idx_session_started', 'started_at'),
        Index('idx_session_channel', 'channel'),
        Index('idx_session_geo', 'geo_country', 'geo_city'),
    )

# Events (append-only)
class Event(Base):
    __tablename__ = "events"
    
    id = Column(String, primary_key=True)
    event_type = Column(String, index=True)
    ts = Column(DateTime, index=True)
    session_id = Column(String, index=True)
    guest_id = Column(String, index=True)
    data = Column(JSON)
    ip_data = Column(JSON)
    received_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_event_type_ts', 'event_type', 'ts'),
        Index('idx_event_guest_ts', 'guest_id', 'ts'),
        Index('idx_event_session', 'session_id'),
    )

class ServiceRequestData(Base):
    __tablename__ = "service_requests"
    
    id = Column(String, primary_key=True)
    guest_id = Column(String, index=True)
    channel = Column(String)
    category = Column(String, index=True)
    subcategory = Column(String, nullable=True)
    status = Column(String, index=True)
    priority = Column(String)
    created_at = Column(DateTime, index=True)
    closed_at = Column(DateTime, nullable=True)
    sla_breached = Column(Boolean, default=False)
    tags = Column(JSON, default=list)
    
    __table_args__ = (
        Index('idx_request_status_category', 'status', 'category'),
        Index('idx_request_created', 'created_at'),
        Index('idx_request_sla', 'sla_breached'),
    )

class ChatSessionData(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(String, primary_key=True)
    guest_id = Column(String, index=True)
    started_at = Column(DateTime, index=True)
    ended_at = Column(DateTime, nullable=True)
    locale = Column(String, nullable=True)
    resolved = Column(Boolean, default=False)
    handoff_to_agent = Column(Boolean, default=False)
    csat = Column(Integer, nullable=True)
    
    __table_args__ = (
        Index('idx_chat_guest', 'guest_id'),
        Index('idx_chat_started', 'started_at'),
        Index('idx_chat_resolved', 'resolved'),
        Index('idx_chat_csat', 'csat'),
    )

# Database connection class
class Database:
    def __init__(self):
        self.engine = None
        self.async_session = None
    
    async def connect(self):
        self.engine = create_async_engine(DATABASE_URL, echo=False)
        self.async_session = async_sessionmaker(
            self.engine, 
            class_=AsyncSession, 
            expire_on_commit=False
        )
        
        # Create tables
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database connected")
    
    async def disconnect(self):
        if self.engine:
            await self.engine.dispose()
        logger.info("Database disconnected")
    
    async def store_event(self, event_data: Dict[str, Any]):
        async with self.async_session() as session:
            try:
                # Generate event ID
                import uuid
                event_id = str(uuid.uuid4())
                
                # Extract envelope data
                envelope = event_data.get("envelope", {})
                
                # Create event record
                event = Event(
                    id=event_id,
                    event_type=envelope.get("event_type"),
                    ts=envelope.get("ts"),
                    session_id=envelope.get("session_id"),
                    guest_id=envelope.get("guest_pseudonymous_id"),
                    data=envelope,
                    ip_data=event_data.get("ip_data"),
                    received_at=datetime.utcnow()
                )
                
                session.add(event)
                await session.commit()
                
                event_data["id"] = event_id
                return event_id
                
            except Exception as e:
                await session.rollback()
                logger.error("Failed to store event", error=str(e))
                raise
    
    async def store_webhook(self, webhook_type: str, data: Dict[str, Any]):
        async with self.async_session() as session:
            try:
                # Store as event with webhook type
                import uuid
                event_id = str(uuid.uuid4())
                
                event = Event(
                    id=event_id,
                    event_type=f"webhook_{webhook_type}",
                    ts=data.get("ts", datetime.utcnow()),
                    session_id=data.get("session_id", ""),
                    guest_id=data.get("guest_id", ""),
                    data=data,
                    received_at=datetime.utcnow()
                )
                
                session.add(event)
                await session.commit()
                
            except Exception as e:
                await session.rollback()
                logger.error("Failed to store webhook", error=str(e))
                raise
    
    async def get_guest_consent(self, guest_id: str) -> Optional[Dict[str, Any]]:
        async with self.async_session() as session:
            result = await session.execute(
                text("SELECT consent_given, consent_purposes FROM guests WHERE pseudonymous_id = :guest_id"),
                {"guest_id": guest_id}
            )
            row = result.first()
            if row:
                return {
                    "consent_given": row[0],
                    "consent_purposes": row[1]
                }
            return None
    
    async def upsert_guest_profile(self, profile_data: Dict[str, Any]):
        async with self.async_session() as session:
            try:
                # Check if profile exists
                result = await session.execute(
                    text("SELECT guest_id FROM guest_profiles WHERE guest_id = :guest_id"),
                    {"guest_id": profile_data["guest_id"]}
                )
                
                if result.first():
                    # Update existing
                    await session.execute(
                        text("""
                            UPDATE guest_profiles 
                            SET name = :name, email = :email, phone = :phone,
                                country = :country, member_id = :member_id,
                                preferred_contact_method = :preferred_contact_method,
                                updated_at = NOW()
                            WHERE guest_id = :guest_id
                        """),
                        profile_data
                    )
                else:
                    # Insert new
                    profile = GuestProfile(**profile_data)
                    session.add(profile)
                
                await session.commit()
                
            except Exception as e:
                await session.rollback()
                logger.error("Failed to upsert guest profile", error=str(e))
                raise
    
    async def update_consent(self, guest_id: str, consent_given: bool, purposes: List[str]):
        async with self.async_session() as session:
            try:
                await session.execute(
                    text("""
                        INSERT INTO guests (pseudonymous_id, consent_given, consent_purposes)
                        VALUES (:guest_id, :consent_given, :purposes)
                        ON CONFLICT (pseudonymous_id) 
                        DO UPDATE SET 
                            consent_given = :consent_given,
                            consent_purposes = :purposes
                    """),
                    {
                        "guest_id": guest_id,
                        "consent_given": consent_given,
                        "purposes": json.dumps(purposes)
                    }
                )
                await session.commit()
                
            except Exception as e:
                await session.rollback()
                logger.error("Failed to update consent", error=str(e))
                raise
    
    async def verify_privacy_token(self, guest_id: str, token: str) -> bool:
        # In production, implement proper token verification
        # This is a placeholder
        return token == f"privacy_{guest_id}_token"
    
    async def export_guest_data(self, guest_id: str) -> Dict[str, Any]:
        async with self.async_session() as session:
            data = {}
            
            # Get guest record
            result = await session.execute(
                text("SELECT * FROM guests WHERE pseudonymous_id = :guest_id"),
                {"guest_id": guest_id}
            )
            guest = result.first()
            if guest:
                data["guest"] = dict(guest._mapping)
            
            # Get profile if exists
            result = await session.execute(
                text("SELECT * FROM guest_profiles WHERE guest_id = :guest_id"),
                {"guest_id": guest_id}
            )
            profile = result.first()
            if profile:
                data["profile"] = dict(profile._mapping)
            
            # Get events
            result = await session.execute(
                text("SELECT * FROM events WHERE guest_id = :guest_id ORDER BY ts"),
                {"guest_id": guest_id}
            )
            data["events"] = [dict(row._mapping) for row in result]
            
            # Get sessions
            result = await session.execute(
                text("SELECT * FROM sessions WHERE guest_id = :guest_id ORDER BY started_at"),
                {"guest_id": guest_id}
            )
            data["sessions"] = [dict(row._mapping) for row in result]
            
            return data
    
    async def delete_guest_data(self, guest_id: str):
        async with self.async_session() as session:
            try:
                # Delete in order of dependencies
                await session.execute(
                    text("DELETE FROM events WHERE guest_id = :guest_id"),
                    {"guest_id": guest_id}
                )
                await session.execute(
                    text("DELETE FROM sessions WHERE guest_id = :guest_id"),
                    {"guest_id": guest_id}
                )
                await session.execute(
                    text("DELETE FROM chat_sessions WHERE guest_id = :guest_id"),
                    {"guest_id": guest_id}
                )
                await session.execute(
                    text("DELETE FROM service_requests WHERE guest_id = :guest_id"),
                    {"guest_id": guest_id}
                )
                await session.execute(
                    text("DELETE FROM guest_profiles WHERE guest_id = :guest_id"),
                    {"guest_id": guest_id}
                )
                await session.execute(
                    text("DELETE FROM guests WHERE pseudonymous_id = :guest_id"),
                    {"guest_id": guest_id}
                )
                
                await session.commit()
                logger.info("Guest data deleted", guest_id=guest_id)
                
            except Exception as e:
                await session.rollback()
                logger.error("Failed to delete guest data", error=str(e))
                raise

# Singleton database instance
db_instance = Database()

async def init_db():
    await db_instance.connect()

async def get_db():
    return db_instance