# Changelog

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