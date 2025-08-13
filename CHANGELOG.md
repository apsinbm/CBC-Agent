# Changelog

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