# CBC-Agent - Coral Beach & Tennis Club Concierge

A modern, AI-powered chatbot for the Coral Beach & Tennis Club, built with Next.js 15 and Claude AI. Features Alonso the Amazing Amazon Parrot, the club's charming concierge assistant with comprehensive knowledge of club facilities, services, and policies.

## Features

- 🤖 **Dual AI Provider Support** - Claude 3.5 Sonnet (primary) with OpenAI GPT-4o-mini fallback
- 💬 **Real-time Chat Interface** - Clean, responsive chat UI without message timestamps
- 🕐 **Smart Time Responses** - Natural time queries with Atlantic/Bermuda timezone support
- 📚 **Comprehensive Knowledge Base** - Club facilities, dining, sports, events, and policies
- 📱 **Fully Responsive Design** - Optimized for mobile and desktop
- 🎨 **CBC Brand Identity** - Custom color scheme and professional styling
- 🔒 **Secure API Integration** - Environment-based configuration
- 🛠️ **Agent System** - Specialized code review and optimization agents

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Anthropic API key

### Installation

1. Install dependencies:
```bash
npm install
```

2. Your `.env.local` file is already configured with API keys.

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Developer UI/Indicators

### Next.js Route Status Badge (Removed)

The floating "Static route" badge with lightning bolt icon that appears in the bottom-left corner during development has been disabled for a cleaner development experience.

**What was removed:**
- Next.js development route status indicator
- Shows caching status and route type information
- Appears as a small floating badge in bottom-left

**How it was disabled:**
1. **Next.js Configuration** (`next.config.js`):
   ```js
   devIndicators: {
     buildActivity: false,  // Disables the route status badge
     buildActivityPosition: 'bottom-right',
   }
   ```

2. **CSS Fail-safe** (`app/globals.css`):
   - Comprehensive selectors targeting Next.js indicators
   - Covers multiple versions and potential selectors
   - Located at bottom of global styles file

**To re-enable if needed:**
- Set `buildActivity: true` in `next.config.js`
- Comment out the CSS rules in `app/globals.css`
- Restart the development server

**Files modified:**
- `next.config.js` - Main configuration
- `app/globals.css` - CSS kill switch
- `README.md` - This documentation

## Project Structure

```
CBC-Agent/
├── app/                  # Next.js 15 app directory
│   ├── api/             # API routes
│   │   ├── chat/        # Main chat endpoint with dual AI provider support
│   │   └── info/time/   # Time service endpoint (Atlantic/Bermuda timezone)
│   ├── globals.css      # Global styles with CBC color scheme
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page with chat interface
├── components/          # React components
│   ├── ChatWindow.tsx   # Chat message display (timestamp-free)
│   ├── ChatInput.tsx    # Message input component
│   └── TypingIndicator.tsx # Typing animation
├── agents/              # Claude Code agents
│   ├── ui_ux_reviewer.js    # UI/UX review agent
│   ├── code_optimizer.js    # Code optimization agent
│   └── api_specialist.js    # API review agent
├── prompts/             # AI system prompts
│   └── system_cbc_agent.md  # Enhanced CBC system prompt
├── data/                # Knowledge base
│   └── cbc_knowledge.md     # Comprehensive club information
└── public/              # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Cloud Features 🚀

CBC-Agent is cloud-ready with enterprise-grade features controlled by feature flags:

### New API Endpoints

- **`/api/_health`** - Comprehensive system health monitoring
- **`/api/email/health`** - Email service status and configuration check  
- **`/api/email/test`** - Safe email template testing (development/staging only)

### Feature Flags

All cloud features are disabled by default to ensure zero breaking changes:

```bash
FEATURE_EMAIL_NOTIFICATIONS=false    # Email notifications for intake submissions
FEATURE_CALENDAR_INGEST=false       # Calendar content ingestion (future)
FEATURE_ANALYTICS=false             # Enhanced analytics (future)
```

### Email Notification System

Multi-provider email service with professional templates:

- **Providers**: SMTP, SendGrid, Mailgun with automatic failover
- **Templates**: Rich HTML formatting for all 6 intake types  
- **Safety**: Dry-run mode for staging environments
- **Monitoring**: Dedicated health checks and testing endpoints

**Configuration Example**:
```bash
FEATURE_EMAIL_NOTIFICATIONS=true
EMAIL_PROVIDER=sendgrid
RECEPTION_EMAILS=reception@coralbeach.bm,concierge@coralbeach.bm
EMAIL_DRY_RUN=true  # Safe for staging
```

### Health Monitoring

Real-time system status with operational visibility:

```bash
curl https://your-domain.vercel.app/api/_health
# Returns: system status, feature flags, LLM readiness, service health
```

## Technologies Used

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety and interfaces (cloud features)
- **Tailwind CSS** - Styling with custom CBC color scheme
- **Anthropic Claude 3.5 Sonnet** - Primary AI provider
- **OpenAI GPT-4o-mini** - Fallback AI provider
- **React 19** - UI library with hooks

## Key Features Implementation

### Dual AI Provider Support
- Primary: Anthropic Claude 3.5 Sonnet for high-quality responses
- Fallback: OpenAI GPT-4o-mini for reliability
- Automatic failover with error handling

### Progressive Text Rendering
- **Short messages (<80 characters)**: Display instantly for snappy feel
- **Long messages (≥80 characters)**: Sentence-by-sentence revelation with natural timing
- **Smart pacing**: 150-250ms delays between sentences mimicking human conversation
- **Smooth scrolling**: Auto-scroll during text revelation for optimal viewing

### Smart Time Detection
- Regex-based time query detection
- Atlantic/Bermuda timezone support (`America/Halifax`)
- Natural language time responses: "Here at the Club it's 2:30 pm."

### Multi-Tier Response System
- **Micro-replies**: Ultra-quick responses for "What's on tonight?" type queries
- **Quick summaries**: Comprehensive overviews with progressive rendering
- **Detailed information**: Structured data for specific questions

### Enhanced CBC Knowledge Base
- **Historic heritage**: 10-generation Smith family ownership since 1624
- **Tennis legacy**: From 1939 clay courts to ATP Challenger events
- **Comprehensive facilities**: 8 tennis courts, spa, dining venues, accommodations
- **Club character**: Including Alonso the resident Amazon parrot
- **August activities**: Daily schedules, themed nights, spa specials

### Timestamp-Free Chat UI
- Clean message interface without timestamp clutter
- Focus on conversation flow and content
- Streamlined TypeScript interfaces

## Agent System

The project includes three specialized agents for code quality:

1. **UI/UX Reviewer** (`agents/ui_ux_reviewer.js`)
   - Ensures responsive, accessible design
   - Checks for mobile optimization and ARIA labels
   - Validates Tailwind CSS usage patterns

2. **Code Optimizer** (`agents/code_optimizer.js`)
   - Improves code performance and structure
   - Detects unused variables and console logs
   - Suggests React optimization patterns

3. **API Specialist** (`agents/api_specialist.js`)
   - Reviews API integrations and error handling
   - Validates authentication and timeout configurations
   - Recommends best practices for API design

## API Endpoints

### `/api/chat` (POST)
Main chat endpoint with dual AI provider support:
- Detects time-related queries and fetches current time
- Falls back from Claude to OpenAI on provider errors
- Returns structured JSON responses

### `/api/info/time` (GET)
Time service endpoint:
- Returns current time in Atlantic/Bermuda timezone
- Formatted for natural language responses
- Used internally by chat endpoint for time queries

## Operations

### Environment Configuration

#### Development
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
NODE_ENV=development
NEXT_PUBLIC_URL=http://localhost:3000
EMAIL_DRY_RUN=true  # Prevents actual email sends during testing
```

#### Staging
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-... # Fallback provider
NODE_ENV=production
NEXT_PUBLIC_URL=https://staging.coralbeach.bm
RATE_LIMIT_MAX=20
EMAIL_DRY_RUN=true  # Safe testing with email logging only
```

#### Production
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-... # Fallback provider  
NODE_ENV=production
NEXT_PUBLIC_URL=https://coralbeach.bm
RATE_LIMIT_MAX=10
FAQ_ENABLED=true
ALONSO_PERSONA_ENABLED=true
EMAIL_DRY_RUN=false # Enable actual email delivery
```

## Staging Deploy

CBC-Agent is ready for cloud deployment with feature flags for gradual rollout. All new cloud features are disabled by default to ensure zero breaking changes.

### Deployment Platforms

#### Vercel Deployment (Recommended)

1. **Prerequisites**
   ```bash
   # Install Vercel CLI (optional)
   npm i -g vercel
   ```

2. **Repository Setup**
   - Push your code to GitHub/GitLab
   - Connect repository to [Vercel dashboard](https://vercel.com)

3. **Build Configuration**
   - Next.js 15 with App Router is auto-detected
   - Uses configuration from `deployment/vercel.json`
   - Node.js 18 runtime with optimized build settings

4. **Environment Variables Setup**
   In Vercel dashboard → Settings → Environment Variables:
   ```bash
   # Required Core Variables
   ANTHROPIC_API_KEY=sk-ant-api03-...
   CLAUDE_API_MODEL=claude-3-5-sonnet-20240620
   NEXT_PUBLIC_URL=https://your-project.vercel.app
   NODE_ENV=production
   
   # Feature Flags (enable as needed)
   FEATURE_EMAIL_NOTIFICATIONS=false
   FEATURE_CALENDAR_INGEST=false  
   FEATURE_ANALYTICS=false
   
   # Email Configuration (if notifications enabled)
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=your_sendgrid_key
   RECEPTION_EMAILS=reception@coralbeach.bm
   EMAIL_DRY_RUN=true  # Safe for staging
   ```

5. **Deploy**
   ```bash
   # Automatic deployment on git push
   git push origin main
   
   # Or manual deployment via CLI
   vercel --prod
   ```

#### Netlify Deployment

1. **Repository Setup**
   - Connect repository to [Netlify dashboard](https://netlify.com)

2. **Build Configuration**
   - Uses settings from `deployment/netlify.toml`
   - Build command: `npm run build`
   - Publish directory: `.next`

3. **Environment Variables**
   In Netlify dashboard → Site settings → Environment variables:
   ```bash
   # Same variables as Vercel above
   ANTHROPIC_API_KEY=sk-ant-api03-...
   NEXT_PUBLIC_URL=https://your-site.netlify.app
   # ... (rest same as Vercel)
   ```

### Feature Flag Configuration

Enable cloud features gradually by setting these environment variables:

#### Email Notifications
```bash
FEATURE_EMAIL_NOTIFICATIONS=true
EMAIL_PROVIDER=sendgrid|smtp|mailgun
RECEPTION_EMAILS=reception@coralbeach.bm,concierge@coralbeach.bm
EMAIL_DRY_RUN=true  # Set false when ready for production
```

#### Calendar Ingestion (Future)
```bash
FEATURE_CALENDAR_INGEST=true
CALENDAR_INGEST_MODE=manual
KB_PATH=data/cbc_knowledge.md
CALENDAR_BACKUP_DIR=server/data/calendar
```

#### Analytics (Future)
```bash
FEATURE_ANALYTICS=true
ANALYTICS_PROVIDER=plausible|posthog|rudderstack
ANALYTICS_DSN=your_analytics_dsn
ANALYTICS_PII_REDACTION=true
```

### Health Check & Monitoring

#### Health Endpoint
```bash
curl https://your-domain.vercel.app/api/_health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "features": {
    "email_notifications": false,
    "calendar_ingest": false,
    "analytics": false,
    "cloud_features_active": false
  },
  "llm": {
    "primary_ready": true,
    "fallback_ready": true
  },
  "services": {
    "weather": { "ready": true },
    "email": { "enabled": false }
  }
}
```

#### Environment Validation
The system validates configuration on startup and reports warnings for:
- Missing required environment variables for enabled features
- Invalid provider configurations
- Feature flags enabled without required credentials

#### Deployment Checklist

**Pre-deployment:**
- [ ] Set `ANTHROPIC_API_KEY` in deployment platform
- [ ] Configure `NEXT_PUBLIC_URL` with your domain
- [ ] Set `EMAIL_DRY_RUN=true` for staging safety
- [ ] Review feature flags (start with all `false`)

**Post-deployment:**
- [ ] Test health endpoint: `/api/_health`
- [ ] Verify chat functionality: `/`
- [ ] Check environment validation warnings in logs
- [ ] Test form submissions (if email enabled)

**For Production:**
- [ ] Set `EMAIL_DRY_RUN=false` when ready
- [ ] Enable desired feature flags
- [ ] Configure production email provider
- [ ] Set up monitoring/analytics

### Troubleshooting

**Build Failures:**
- Check environment variables are set in deployment platform
- Verify Node.js version (requires 18+)
- Review build logs for TypeScript errors

**Runtime Issues:**
- Check `/api/_health` for service status
- Review server logs for validation warnings
- Verify API keys have correct permissions

**Feature Issues:**
- Ensure required environment variables are set for enabled features
- Check feature flag syntax (must be `true`, not `True` or `1`)
- Review email/analytics provider configuration

### Running with Email Dry Run

Set `EMAIL_DRY_RUN=true` to log email operations without sending:

```bash
EMAIL_DRY_RUN=true npm run dev
```

This will:
- Log all email attempts to console
- Skip actual SMTP delivery
- Preserve form submission functionality
- Safe for development and staging environments

### Quick Self-Check Examples

#### 1. Health Check
```bash
curl http://localhost:3000/api/health
# Expected: {"status":"healthy","timestamp":"..."}
```

#### 2. Chat Endpoint
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
# Expected: JSON response with reply field
```

#### 3. Rate Limit Test
```bash
# Send 15 rapid requests to trigger rate limiting
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"test '$i'"}]}' &
done
# Expected: 429 responses after 10th request
```

#### 4. CORS Test
```bash
curl -H "Origin: https://malicious.com" \
  http://localhost:3000/api/chat
# Expected: No CORS headers for unauthorized origin
```

#### 5. Oversized Payload Test
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"'$(head -c 200000 /dev/zero | tr '\0' 'A')'"}]}'
# Expected: 400 error about request size
```

### Security Monitoring

See `SECURITY_NOTES.md` for detailed security operational guidance including:
- PII protection and masking
- Rate limiting configuration
- Domain allowlist management
- Kill switch and maintenance mode
- Content moderation policies

## Environment Variables

The following environment variables are configured in `.env.local`:

- `ANTHROPIC_API_KEY` - Your Anthropic API key (required)
- `CLAUDE_API_MODEL` - Primary Claude model (claude-3-5-sonnet-20240620)
- `OPENAI_API_KEY` - OpenAI API key for fallback (optional but recommended)
- `OPENAI_FALLBACK_MODEL` - OpenAI fallback model (gpt-4o-mini)
- `PRIMARY_PROVIDER` - Primary LLM provider (anthropic)
- `FALLBACK_PROVIDER` - Fallback LLM provider (openai)
- `FALLBACK_ENABLED` - Enable/disable fallback system (true)

## Development Notes

### Recent Updates
1. **Complete Rebrand to "Alonso the Amazing Amazon Parrot"** (August 2025)
   - Full repository-wide rename from "Danni" to "Alonso"  
   - Enhanced system prompt with Amazing Amazon Parrot branding
   - Updated chat input placeholder to "Ask Alonso..."
   - Improved club personality and charm

2. **Weather Service Overhaul** (August 2025)
   - Comprehensive weather function diagnosis and enhancement
   - Multi-provider architecture (Open-Meteo, WeatherKit, OpenWeather)
   - JWT ES256 generation for Apple WeatherKit authentication
   - Circuit breaker pattern with failure thresholds and automatic recovery
   - Stale-while-revalidate caching strategy with 5-minute cache
   - Exponential backoff retry logic with jitter
   - Prometheus metrics collection and health check endpoints
   - CLI smoke test tool for debugging weather issues
   - Always-on time/weather context injection for AI memory persistence

3. **Modal Form Field Styling Fix** (August 2025)
   - Fixed black background issues in booking/reservation modals
   - Applied consistent white backgrounds with black text across all forms
   - Enhanced placeholder text contrast for better readability
   - Updated 5 modal components: Courts & Lawn Sports, Weddings, Dining, Plan Your Stay, Spa

4. **Previous Core Enhancements**
   - Progressive Text Rendering System with smart message display
   - Enhanced Knowledge Base with CBC history, tennis heritage, and Alonso the parrot
   - Multi-Tier Response System (micro-replies, quick summaries, detailed information)
   - Timestamp Removal Refactoring for cleaner UI
   - Time Response Enhancement with Atlantic/Bermuda timezone
   - Dual Provider Implementation (Claude + OpenAI fallback)

### Build Issues Resolution
- Clear Next.js cache with `rm -rf .next` if encountering build errors
- Restart dev server after major TypeScript interface changes
- Verify environment variables are properly configured

### Pre-commit Hooks (Optional)

To enable automatic linting and type checking before commits:

```bash
# Install Husky for git hooks
npm install --save-dev husky
npx husky init

# Add pre-commit hook
echo "npm run lint && npx tsc --noEmit" > .husky/pre-commit
chmod +x .husky/pre-commit
```

This will automatically run linting and TypeScript checks before each commit, catching:
- Security rule violations (console.log of objects, eval usage)
- TypeScript errors and any types
- Code style inconsistencies