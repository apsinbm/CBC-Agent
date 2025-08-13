from datetime import datetime
from typing import Optional, List, Literal, Any
from enum import Enum
from pydantic import BaseModel, Field, EmailStr

class DeviceType(str, Enum):
    DESKTOP = "desktop"
    MOBILE = "mobile"
    TABLET = "tablet"

class Channel(str, Enum):
    WEB = "web"
    APP = "app"
    WHATSAPP = "whatsapp"
    SMS = "sms"
    PHONE = "phone"
    EMAIL = "email"

class ServiceCategory(str, Enum):
    HOUSEKEEPING = "housekeeping"
    MAINTENANCE = "maintenance"
    DINING = "dining"
    SPA = "spa"
    TENNIS = "tennis"
    TRANSPORT = "transport"
    IT = "it"
    OTHER = "other"

class RequestStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"
    CANCELLED = "cancelled"

class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class SelectionType(str, Enum):
    DINING = "dining"
    SPA = "spa"
    TENNIS = "tennis"
    TRANSPORT = "transport"
    ACTIVITY = "activity"
    FAQ = "faq"

class ConsentFlags(BaseModel):
    analytics: bool
    marketing: Optional[bool] = None
    functional: bool = True

class DeviceInfo(BaseModel):
    type: DeviceType
    os: str
    browser: Optional[str] = None

class EventEnvelope(BaseModel):
    app_id: Literal["CBC-Agent"] = "CBC-Agent"
    schema_version: str = "1.0.0"
    event_type: str
    ts: datetime
    session_id: str
    guest_pseudonymous_id: str
    device: DeviceInfo
    app_version: str
    consent_flags: ConsentFlags
    ip_raw: Optional[str] = None  # Will be processed and discarded

class IPData(BaseModel):
    ip_trunc: str  # /24 for IPv4, /48 for IPv6
    ip_hash: str   # HMAC-SHA256 with rotating salt
    geo_country: Optional[str] = None
    geo_region: Optional[str] = None
    geo_city: Optional[str] = None

# Entities
class GuestEntity(BaseModel):
    pseudonymous_id: str
    consent_given: bool
    consent_purposes: List[str]
    created_at: datetime
    locale: Optional[str] = None
    device_type: DeviceType
    app_version: str
    membership_tier: Optional[Literal["member", "guest", "vip"]] = None
    marketing_opt_in: bool = False

class GuestProfileOptional(BaseModel):
    guest_id: str
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    member_id: Optional[str] = None
    preferred_contact_method: Optional[Literal["email", "phone", "sms", "whatsapp"]] = None
    updated_at: datetime

class SessionEntity(BaseModel):
    session_id: str
    guest_id: str
    channel: Channel
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    entry_point: str
    pages_viewed: int = 0
    device_type: DeviceType
    os: str
    app_version: str
    geo_country: Optional[str] = None
    geo_region: Optional[str] = None
    geo_city: Optional[str] = None
    ip_trunc: str
    ip_hash: str

class FAQArticle(BaseModel):
    id: str
    slug: str
    title: str
    category: str
    published_at: datetime
    last_updated_at: datetime

class ServiceRequest(BaseModel):
    id: str
    guest_id: str
    channel: Channel
    category: ServiceCategory
    subcategory: Optional[str] = None
    status: RequestStatus
    priority: Priority
    created_at: datetime
    closed_at: Optional[datetime] = None
    sla_breached: bool = False
    tags: List[str] = Field(default_factory=list)

class ChatSession(BaseModel):
    id: str
    guest_id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    locale: Optional[str] = None
    resolved: bool = False
    handoff_to_agent: bool = False
    csat: Optional[int] = Field(None, ge=1, le=5)

class ChatMessage(BaseModel):
    id: str
    session_id: str
    sender: Literal["guest", "agent", "bot"]
    ts: datetime
    text_redacted: str  # PII removed
    intent: Optional[str] = None
    entities: List[str] = Field(default_factory=list)
    tokens: Optional[int] = None

# Events
class PageViewEvent(BaseModel):
    event_type: Literal["page_view"] = "page_view"
    ts: datetime
    session_id: str
    guest_id: str
    path: str
    ms_on_page: int
    referrer: Optional[str] = None

class SearchEvent(BaseModel):
    event_type: Literal["search"] = "search"
    ts: datetime
    guest_id: str
    query_redacted: str
    results_count: int
    clicked_faq_id: Optional[str] = None
    zero_result: bool

class FAQViewEvent(BaseModel):
    event_type: Literal["faq_view"] = "faq_view"
    ts: datetime
    guest_id: str
    faq_id: str
    dwell_ms: int
    from_search: bool
    helpful_vote: Optional[bool] = None

class ChatStartEvent(BaseModel):
    event_type: Literal["chat_start"] = "chat_start"
    ts: datetime
    chat_session_id: str
    guest_id: str
    entrypoint: str
    intent_initial: Optional[str] = None

class ChatEndEvent(BaseModel):
    event_type: Literal["chat_end"] = "chat_end"
    ts: datetime
    chat_session_id: str
    resolved: bool
    handoff_to_agent: bool
    csat: Optional[int] = Field(None, ge=1, le=5)

class ServiceRequestCreatedEvent(BaseModel):
    event_type: Literal["service_request_created"] = "service_request_created"
    ts: datetime
    request_id: str
    guest_id: str
    category: ServiceCategory
    subcategory: Optional[str] = None
    source: str

class ServiceRequestStatusChangeEvent(BaseModel):
    event_type: Literal["service_request_status_change"] = "service_request_status_change"
    ts: datetime
    request_id: str
    old_status: str
    new_status: str
    ts_change: datetime

class PreferenceSignalEvent(BaseModel):
    event_type: Literal["preference_signal"] = "preference_signal"
    ts: datetime
    guest_id: str
    key: str
    value: str
    weight: float = Field(ge=0, le=1)
    source: Literal["choice", "search", "click"]

class SelectionEvent(BaseModel):
    event_type: Literal["selection"] = "selection"
    ts: datetime
    guest_id: str
    selection_type: SelectionType
    selection_value: str
    context: Optional[str] = None
    path: str

class ConsentChangeEvent(BaseModel):
    event_type: Literal["consent_change"] = "consent_change"
    ts: datetime
    guest_id: str
    consent_given: bool
    purposes: List[str]

# Webhook payload with HMAC
class WebhookPayload(BaseModel):
    timestamp: datetime
    signature: str
    payload: Any