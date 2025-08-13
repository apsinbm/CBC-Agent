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

## Technologies Used

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety and interfaces
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

## Environment Variables

The following environment variables are configured in `.env.local`:

- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `OPENAI_API_KEY` - Your OpenAI API key (fallback)
- `CLAUDE_API_MODEL` - Claude model for chat (claude-3-5-sonnet-20240620)
- `CLAUDE_CLI_MODEL` - Claude model for code agents (claude-4.1)

## Development Notes

### Recent Updates
1. **Progressive Text Rendering System** - Implemented smart message display with natural pacing
2. **Enhanced Knowledge Base** - Added comprehensive CBC history, tennis heritage, and Alonso the parrot
3. **Multi-Tier Response System** - Micro-replies, quick summaries, and detailed information
4. **Timestamp Removal Refactoring** - Completely removed message timestamps from UI
5. **Time Response Enhancement** - Added natural time detection and Atlantic/Bermuda timezone
6. **Dual Provider Implementation** - Integrated OpenAI as fallback for reliability

### Build Issues Resolution
- Clear Next.js cache with `rm -rf .next` if encountering build errors
- Restart dev server after major TypeScript interface changes
- Verify environment variables are properly configured