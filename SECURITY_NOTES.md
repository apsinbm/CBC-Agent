# Security Implementation Notes

## Overview

This document provides operational guidance for the CBC-Agent security hardening implementation.

## PII Flow and Masking

### How PII Protection Works
- **Location**: `/src/lib/pii-protection.js`
- **Flow**: Input → Validation → Sanitization → Safe Logging
- **Fields Protected**: name, email, phone, memberNumber, roomNumber, addresses

### Masking Behavior
```
Email: john.doe@example.com → ***oe@example.com
Phone: +1-441-555-1234 → ***-***-1234
Name: John Smith → J*** S***
Member#: MEMBER12345 → ***345
```

### Safe Logging
Replace `console.log(data)` with `safeLog('Context', data)` - automatically redacts PII.

## Rate Limiting

### Configuration
- **Location**: `/src/lib/rate-limit-tiers.js`
- **Tiers**:
  - Chat: 10 requests/minute
  - Forms: 5 requests/10 minutes
  - API: 50 requests/minute  
  - Global: 30 requests/minute (burst protection)

### Environment Variables
```bash
# Override defaults (optional)
RATE_LIMIT_CHAT_MAX=15        # Default: 10
RATE_LIMIT_FORM_MAX=8         # Default: 5
RATE_LIMIT_API_MAX=100        # Default: 50
```

### User Experience
Rate-limited users see friendly messages:
- Chat: "Please wait a moment before sending another message."
- Forms: "You've submitted several forms recently. Please wait a few minutes."

## Domain Allowlist

### How It Works
- **Location**: `/src/lib/outbound-allowlist.js`
- Server-side fetch calls are restricted to approved domains
- Prevents SSRF attacks and data exfilteration

### Current Allowed Domains
```javascript
// Weather services
'api.openweathermap.org'
'api.weather.gov'
'api.weatherapi.com'

// Bermuda news
'www.royalgazette.com'
'bernews.com'

// Internal
'localhost' (dev only)
'coralbeach.bm'
```

### Adding a Domain
```javascript
// Runtime addition (temporary)
import { addAllowedDomain } from '@/src/lib/outbound-allowlist';
addAllowedDomain('trusted-api.example.com');

// Permanent addition
// Edit ALLOWED_DOMAINS array in /src/lib/outbound-allowlist.js
```

### Blocked Requests
Blocked domains return error: "Domain 'example.com' is not on the allowed list."

## CORS/CSRF/CSP Headers

### Headers Implementation
- **CORS**: `/src/lib/cors-csrf.js` - Origin validation with allowlist
- **CSRF**: Token-based protection with 1-hour expiry
- **CSP**: Strict Content Security Policy

### Where Headers Are Set
1. **Middleware**: `/middleware.js` - Global security headers
2. **API Routes**: Individual CORS handling
3. **Security Utils**: `/src/lib/cors-csrf.js` - Header generation

### CORS Allowed Origins
```javascript
// Production
'https://coralbeach.bm'
'https://www.coralbeach.bm'

// Development  
'http://localhost:3000'
'http://localhost:3001'
```

### CSP Relaxations
- `'unsafe-inline'` for styles (Tailwind CSS requirement)
- `'unsafe-eval'` for scripts (Next.js requirement)

**Justification**: These are required for Next.js and Tailwind to function. The risk is mitigated by:
1. Input validation and sanitization
2. Prompt injection protection
3. XSS filtering in responses

## Kill Switch

### Usage
```javascript
import { activateKillSwitch, enableMaintenanceMode } from '@/src/lib/kill-switch';

// Emergency shutdown
activateKillSwitch('Security incident detected');

// Planned maintenance
enableMaintenanceMode({
  message: 'Scheduled maintenance until 3 PM',
  allowedIPs: ['192.168.1.100'], // Staff access
  estimatedDuration: '2 hours'
});
```

### Environment Variables
```bash
KILL_SWITCH=true              # Activate on startup
MAINTENANCE_MODE=true         # Enable maintenance mode
MAINTENANCE_MESSAGE="Custom message"
ALLOWED_IPS="192.168.1.1,10.0.0.1"
```

### User Experience
- **Kill Switch**: "Service temporarily unavailable. Please try again later."
- **Maintenance**: Custom HTML page with club branding and estimated duration
- **Allowed IPs**: Normal access continues

## Content Moderation

### What Gets Blocked
- **Prompt Injection**: "ignore previous instructions", "you are now", etc.
- **Code Injection**: `<script>`, `javascript:`, command substitution
- **Spam**: Excessive repetition, all caps
- **System Extraction**: "show me your prompt", "what are your instructions"

### User-Facing Messages
```
Injection attempt: "I can't process that request. Please rephrase your question about Coral Beach Club."

Spam detected: "Your message appears to contain repetitive content. Please provide a clear question."

Sensitive content: "I can help with Coral Beach Club information, but I can't assist with that type of request."

Too long: "Your message is too long. Please break it into smaller questions."
```

### Moderation Flow
1. Input validation (size, format)
2. Injection pattern detection  
3. Sensitive content scanning
4. Response filtering (remove any leaked system info)

## Dependency Audit

### Weekly Process
1. Run `npm audit` to check for vulnerabilities
2. Review GitHub Dependabot alerts
3. Update dependencies with `npm update`
4. Test critical paths after updates

### CVE Response Protocol
1. **Critical**: Immediate update and deployment
2. **High**: Update within 48 hours
3. **Medium/Low**: Include in next regular maintenance

### Monitoring
- GitHub Dependabot enabled for automatic alerts
- Consider Snyk or similar for enhanced monitoring
- Pin versions for security-critical dependencies

### Pinned Dependencies
The following dependencies are pinned to prevent automatic updates:
- `@anthropic-ai/sdk`: 0.30.1 (API compatibility)
- `next`: 15.4.6 (framework stability)
- `openai`: 5.12.2 (API compatibility)
- `nodemailer`: 7.0.5 (email functionality)
- `js-yaml`: 4.1.0 (parsing security)

**Update Process**: Test thoroughly in staging before updating pinned versions.

### Package Audit Commands
```bash
# Check for vulnerabilities
npm audit

# Fix automatically (use with caution)
npm audit fix

# Check for unused dependencies
npx depcheck

# Security-focused audit
npm audit --audit-level high
```

## Environment Configuration

### Required Variables by Environment

#### Development
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
NODE_ENV=development
NEXT_PUBLIC_URL=http://localhost:3000
```

#### Staging  
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-... (fallback)
NODE_ENV=production
NEXT_PUBLIC_URL=https://staging.coralbeach.bm
RATE_LIMIT_MAX=20
```

#### Production
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-... (fallback)
NODE_ENV=production  
NEXT_PUBLIC_URL=https://coralbeach.bm
RATE_LIMIT_MAX=10
FAQ_ENABLED=true
ALONSO_PERSONA_ENABLED=true
```

## Security Incident Response

### Detection
- Rate limit violations logged
- Moderation blocks logged with context
- Kill switch activations logged
- Failed CSRF validations logged

### Response Steps
1. **Assess**: Review logs and determine scope
2. **Contain**: Activate kill switch if needed
3. **Investigate**: Analyze attack patterns
4. **Recover**: Remove threat and restore service
5. **Learn**: Update security measures

### Emergency Contacts
Configure in `/src/lib/kill-switch.js`:
```javascript
const EMERGENCY_CONTACTS = [
  'security@coralbeach.bm',
  '+1-441-XXX-XXXX'
];
```