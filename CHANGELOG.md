# Changelog

## [2025-08-15] - Cloud Deployment Readiness

### Added

#### Phase 1: Cloud-Ready Infrastructure
- **Deployment Configurations**: Created `deployment/` folder with Vercel (`vercel.json`) and Netlify (`netlify.toml`) deployment configs
- **Feature Flag System**: Implemented TypeScript-based feature flag management in `src/lib/feature-flags.ts`
  - Zero breaking changes pattern: all cloud features default to `false`
  - Feature flags: `FEATURE_EMAIL_NOTIFICATIONS`, `FEATURE_CALENDAR_INGEST`, `FEATURE_ANALYTICS`
  - Comprehensive configuration validation with detailed warnings
- **Health Monitoring**: Created `/api/_health` endpoint for comprehensive system monitoring
  - LLM provider status, feature flag status, service readiness checks
  - Response time monitoring, overall system health calculation
  - PII-safe status reporting (no secrets exposed)
- **Environment Configuration**: Expanded `.env.example` with 25+ cloud-specific variables
  - Email provider configurations (SMTP, SendGrid, Mailgun)
  - Feature flag templates with safety documentation
  - Calendar ingestion and analytics configuration templates
- **Enhanced Environment Validation**: Updated `src/lib/validate-env.js` with feature flag validation
  - Conditional validation (only validates when features enabled)
  - Provider-specific configuration checks
  - Production safety warnings for misconfigured features
- **Deployment Documentation**: Added comprehensive "Staging Deploy" section to README
  - Step-by-step Vercel and Netlify deployment instructions
  - Feature flag configuration guide, health check usage
  - Deployment checklists for staging and production

#### Phase 2: Email Notification System
- **Multi-Provider Email Service**: Transformed `src/lib/email.ts` into enterprise-grade service
  - Support for SMTP, SendGrid, Mailgun with automatic failover
  - Feature-flag controlled activation (`FEATURE_EMAIL_NOTIFICATIONS`)
  - Dry-run mode for staging safety (`EMAIL_DRY_RUN=true`)
  - PII-safe logging throughout all email operations
- **Enhanced Email Templates**: Professional HTML templates for all 6 intake types
  - Rich formatting with emoji headers, color-coded sections
  - Structured layouts: guest info, booking details, special requests
  - Support for: dining, tennis, courts-lawn-sports, spa, wedding, plan-your-stay
- **Intake Integration**: Updated all intake endpoints for new email system
  - `/api/intake/route.ts` and `/api/intake/reservation/route.ts` enhanced
  - Replaced legacy email functions with `notifyReception()`
  - Comprehensive error handling without workflow disruption
- **Email Health & Testing**: Created dedicated email service endpoints
  - `/api/email/health` - Email service health monitoring and configuration status
  - `/api/email/test` - Safe email testing for development/staging environments
  - Security restrictions: development-only or dry-run mode required

#### New API Endpoints
- `/api/_health` - System health monitoring
- `/api/email/health` - Email service health check  
- `/api/email/test` - Email configuration testing

#### New Configuration Options
```bash
# Feature Flags
FEATURE_EMAIL_NOTIFICATIONS=false
FEATURE_CALENDAR_INGEST=false  
FEATURE_ANALYTICS=false

# Email Service
EMAIL_PROVIDER=smtp                    # smtp|sendgrid|mailgun
RECEPTION_EMAILS=reception@coralbeach.bm
EMAIL_DRY_RUN=true                    # Staging safety
EMAIL_SUBJECT_PREFIX=[CBC Concierge]   # Email branding
EMAIL_SEND_GUEST_COPY=false           # Guest confirmations

# Provider Credentials
SENDGRID_API_KEY=your_key
MAILGUN_API_KEY=your_key
MAILGUN_DOMAIN=your_domain
```

### Technical Details

**Cloud Infrastructure Files**:
- `deployment/vercel.json` - Vercel deployment with security headers, Node.js 18
- `deployment/netlify.toml` - Netlify deployment with Next.js plugin
- `deployment/env.example` - Comprehensive cloud environment template

**Feature Flag System**:
- `src/lib/feature-flags.ts` - TypeScript feature flag management
- Enhanced `src/lib/validate-env.js` - Feature flag validation

**Email System**:
- Enhanced `src/lib/email.ts` - Multi-provider email service with failover
- Updated intake endpoints: `app/api/intake/route.ts`, `app/api/intake/reservation/route.ts`
- New health/testing: `app/api/email/health/route.ts`, `app/api/email/test/route.ts`

**Health Monitoring**:
- `app/api/_health/route.ts` - Comprehensive system health endpoint

### Documentation

- **DEVELOPMENT_HISTORY.md**: Comprehensive development timeline and technical architecture
- **README.md**: Enhanced with cloud deployment section, feature flag documentation
- **Deployment guides**: Step-by-step instructions for Vercel and Netlify

## [2025-08-13] - Major Enhancements & Fixes

### Added

#### Comprehensive Weather Service Architecture
- **Multi-provider weather system** with automatic failover (Open-Meteo, WeatherKit, OpenWeather)
- **JWT ES256 authentication** for Apple WeatherKit with proper key generation
- **Circuit breaker pattern** with configurable failure thresholds and recovery timeouts
- **Advanced caching strategy** using stale-while-revalidate with 5-minute cache duration
- **Exponential backoff retry logic** with jitter to prevent thundering herd
- **Prometheus metrics collection** for monitoring API performance and reliability
- **Health check endpoints** (`/api/weather/health`) for operational monitoring
- **CLI smoke test tool** (`npm run test:weather`) for debugging weather integrations

#### Complete "Alonso the Amazing Amazon Parrot" Rebrand
- **Repository-wide rename** from "Danni" to "Alonso the Amazing Amazon Parrot"
- **Enhanced personality system** with charming parrot character traits
- **Updated chat interface** with "Ask Alonso..." placeholder text
- **Improved system prompts** reflecting club's feathered ambassador

### Fixed

#### AI Memory Persistence for Time/Weather Context
**Root Cause**: Conditional detection logic was inconsistently injecting time and weather data into AI context, causing the chatbot to "forget" current conditions in follow-up questions.

**Solution**: 
- Removed conditional detection and implemented always-on context injection
- Enhanced `/api/chat` route to fetch and inject current time and weather into every system prompt
- Improved error handling to gracefully degrade when weather services are unavailable
- Added comprehensive logging for debugging context injection issues

#### Modal Form Field Styling Issues
**Root Cause**: Booking and reservation modal form fields inherited dark backgrounds, making text input nearly unreadable.

**Solution**:
- Updated all form field styling across 5 modal components:
  - CourtsLawnSportsModal (Book Courts & Lawn Sports)
  - WeddingModal (Weddings at the Club)
  - DiningModal (Make a Dining Reservation)  
  - ReservationModal (Plan Your Stay)
  - SpaModal (Book Spa Treatment)
- Added explicit styling: `bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black`
- Ensured consistent white backgrounds with black text and proper placeholder contrast

### Technical Details

**Weather Service Files**:
- `src/lib/weather/index.js` - Main weather service with provider management
- `src/lib/weather/config.js` - Environment validation and configuration
- `src/lib/weather/providers/` - Individual provider implementations
- `app/api/weather/route.js` - Internal weather API endpoint
- `scripts/test-weather.js` - CLI smoke test tool

**Branding Updates**:
- `prompts/system_cbc_agent.md` - Enhanced system prompt for Alonso
- `components/ChatInput.tsx` - Updated placeholder text
- `data/cbc_knowledge.md` - Updated parrot references
- `app/page.tsx` - Updated initial greeting message

**Modal Components Updated**:
- `components/modals/CourtsLawnSportsModal.tsx`
- `components/modals/WeddingModal.tsx` 
- `components/modals/DiningModal.tsx`
- `components/ReservationModal.tsx`
- `components/modals/SpaModal.tsx`

## [2024-01-13] - Bug Fixes

### Fixed

#### Time/Weather Responses Not Returning
**Root Cause**: The chat API was attempting to fetch from `/api/info/time` endpoint that didn't exist, causing the time fetch to fail silently. Weather functionality was completely missing.

**Solution**: 
- Removed dependency on non-existent `/api/info/time` endpoint
- Implemented direct time calculation using `Intl.DateTimeFormat` with America/Halifax timezone (same as Bermuda)
- Added weather functionality using Open-Meteo API (no key required) with 3-second timeout
- Enhanced system prompt to include natural phrasing guidance for responses
- Time responses now say "Here at the club it's [time]"
- Weather responses now say "Right now at the club it's [temp]°C with [conditions]"

#### Text Selection Disabled in Chat
**Root Cause**: Global CSS rule `user-select: none` was applied to the entire body element, preventing text selection throughout the app.

**Solution**:
- Removed global `user-select: none` from body
- Added explicit `user-select: text` for message content and text elements
- Applied `user-select: none` only to UI elements (buttons, nav, modal backdrops)
- Maintained existing mobile UX while enabling text selection

### Added

#### Health Check Endpoints
- `/api/health/time` - Returns current Bermuda time with formatting
- `/api/health/weather` - Returns current Bermuda weather from Open-Meteo API
- Both endpoints provide detailed status and error handling for debugging

### Technical Details

**Files Modified**:
- `app/api/chat/route.js` - Fixed time/weather fetching and detection
- `app/globals.css` - Fixed text selection CSS rules
- `app/api/health/time/route.js` - Created health check for time
- `app/api/health/weather/route.js` - Created health check for weather

**Dependencies**: No new dependencies added (Open-Meteo API is free and requires no authentication)