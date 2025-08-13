import re
import hashlib
import hmac
import ipaddress
from typing import Dict, Any, Optional
import structlog

logger = structlog.get_logger()

# PII patterns
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
PHONE_PATTERN = re.compile(r'\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')
SSN_PATTERN = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')
CC_PATTERN = re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}\b')
BOOKING_REF_PATTERN = re.compile(r'\b[A-Z0-9]{6,10}\b')

def redact_pii(text: str) -> str:
    """Redact PII from text"""
    if not text:
        return text
    
    # Redact emails
    text = EMAIL_PATTERN.sub('[EMAIL_REDACTED]', text)
    
    # Redact phone numbers
    text = PHONE_PATTERN.sub('[PHONE_REDACTED]', text)
    
    # Redact SSN-like patterns
    text = SSN_PATTERN.sub('[SSN_REDACTED]', text)
    
    # Redact credit card numbers
    text = CC_PATTERN.sub('[CC_REDACTED]', text)
    
    # Optionally redact booking references
    # text = BOOKING_REF_PATTERN.sub('[BOOKING_REF]', text)
    
    return text

def truncate_ip(ip_str: str) -> str:
    """Truncate IP address for privacy (/24 for IPv4, /48 for IPv6)"""
    try:
        ip = ipaddress.ip_address(ip_str)
        
        if isinstance(ip, ipaddress.IPv4Address):
            # Keep first 3 octets for IPv4
            network = ipaddress.ip_network(f"{ip}/24", strict=False)
            return str(network.network_address)
        else:
            # Keep first 48 bits for IPv6
            network = ipaddress.ip_network(f"{ip}/48", strict=False)
            return str(network.network_address)
    except Exception as e:
        logger.error("Failed to truncate IP", ip=ip_str, error=str(e))
        return "0.0.0.0"

def hash_ip(ip_str: str, salt: str) -> str:
    """Hash IP address with HMAC-SHA256"""
    try:
        return hmac.new(
            salt.encode(),
            ip_str.encode(),
            hashlib.sha256
        ).hexdigest()
    except Exception as e:
        logger.error("Failed to hash IP", error=str(e))
        return ""

def process_ip_data(ip_str: str, salt: str) -> Dict[str, str]:
    """Process IP address for privacy-safe storage"""
    return {
        "ip_trunc": truncate_ip(ip_str),
        "ip_hash": hash_ip(ip_str, salt)
    }

def validate_consent(consent_flags: Dict[str, Any]) -> bool:
    """Validate if analytics consent is given"""
    return consent_flags.get("analytics", False)

def anonymize_guest_id(guest_id: str, salt: str) -> str:
    """Create anonymized guest ID"""
    return hashlib.sha256(f"{guest_id}{salt}".encode()).hexdigest()

def redact_json(data: Dict[str, Any], fields_to_redact: list = None) -> Dict[str, Any]:
    """Redact PII from JSON data"""
    if fields_to_redact is None:
        fields_to_redact = ['email', 'phone', 'name', 'address', 'ssn', 'credit_card']
    
    result = {}
    for key, value in data.items():
        if key in fields_to_redact:
            result[key] = '[REDACTED]'
        elif isinstance(value, str):
            result[key] = redact_pii(value)
        elif isinstance(value, dict):
            result[key] = redact_json(value, fields_to_redact)
        elif isinstance(value, list):
            result[key] = [
                redact_json(item, fields_to_redact) if isinstance(item, dict) 
                else redact_pii(item) if isinstance(item, str)
                else item
                for item in value
            ]
        else:
            result[key] = value
    
    return result

def get_retention_period(event_type: str) -> int:
    """Get retention period in days for event type"""
    retention_map = {
        "page_view": 365,  # 12 months
        "search": 365,
        "faq_view": 365,
        "chat_start": 730,  # 24 months for service interactions
        "chat_end": 730,
        "service_request_created": 730,
        "service_request_status_change": 730,
        "preference_signal": 365,
        "selection": 365,
        "consent_change": 2555  # 7 years for consent records
    }
    return retention_map.get(event_type, 365)