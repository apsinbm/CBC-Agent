# CBC-Agent Vercel Deployment Guide

## 🚀 Production-Ready Deployment Configuration

This guide provides comprehensive instructions for deploying CBC-Agent to Vercel with full cross-platform compatibility.

## ✅ Deployment Checklist

### Pre-Deployment Requirements
- [ ] Vercel account (Hobby plan minimum)
- [ ] GitHub/GitLab repository connected
- [ ] API keys ready (Anthropic, OpenAI optional)
- [ ] Domain configured (optional)

## 📱 Cross-Platform Compatibility

### Supported Platforms
- **Desktop**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- **Mobile**: iOS 13+, Android 8+
- **Browsers**: Chrome 90+, Safari 14+, Firefox 88+, Edge 90+

### Responsive Design Features
- Dynamic viewport height for mobile browsers
- Safe area insets for notched devices
- Touch-optimized targets (44x44px minimum)
- Prevents iOS zoom on input focus
- Smooth momentum scrolling

## 🔧 Configuration Steps

### 1. Initial Setup

```bash
# Clone repository
git clone https://github.com/your-org/cbc-agent.git
cd cbc-agent

# Install dependencies
npm ci --production=false

# Test build locally
npm run build
npm run start
```

### 2. Environment Variables Setup

#### Required Variables (Vercel Dashboard)

```env
# Core Configuration
NODE_ENV=production
NEXT_PUBLIC_URL=https://your-domain.vercel.app

# LLM Providers (Required)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
CLAUDE_API_MODEL=claude-sonnet-4-20250514

# Optional Fallback
OPENAI_API_KEY=sk-xxxxx
OPENAI_FALLBACK_MODEL=gpt-4o-mini
FALLBACK_ENABLED=true
```

#### Feature Flags

```env
# Start with all disabled, enable gradually
FEATURE_EMAIL_NOTIFICATIONS=false
FEATURE_CALENDAR_INGEST=false
FEATURE_ANALYTICS=false
FAQ_ENABLED=true
ALONSO_PERSONA_ENABLED=true
```

### 3. Vercel Deployment

#### Option A: Via Dashboard
1. Import project from GitHub
2. Configure environment variables
3. Deploy with default settings

#### Option B: Via CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod

# Deploy to preview (staging)
vercel
```

## 🎯 Performance Optimizations

### Build Optimizations
- **SWC Minification**: Faster builds with Rust-based minifier
- **Image Optimization**: AVIF/WebP formats with responsive sizing
- **Code Splitting**: Automatic per-route code splitting
- **Tree Shaking**: Removes unused code in production

### Runtime Optimizations
- **Edge Caching**: Static assets cached for 1 year
- **API Response Caching**: 5-minute cache for weather/time
- **Compression**: Brotli/Gzip for all text assets
- **Lazy Loading**: Components loaded on-demand

### Mobile Optimizations
- **PWA Ready**: Installable on mobile devices
- **Offline Support**: Service worker for basic offline functionality
- **Touch Gestures**: Swipe navigation support
- **Reduced Data**: Optimized payloads for mobile networks

## 📊 Monitoring & Testing

### Performance Metrics

Monitor these key metrics post-deployment:

| Metric | Target | Mobile Target |
|--------|--------|---------------|
| LCP (Largest Contentful Paint) | < 2.5s | < 4s |
| FID (First Input Delay) | < 100ms | < 200ms |
| CLS (Cumulative Layout Shift) | < 0.1 | < 0.25 |
| TTFB (Time to First Byte) | < 600ms | < 1200ms |

### Automated Testing Script

```bash
# Run cross-browser tests
npm run test:e2e

# Test mobile responsiveness
npm run test:mobile

# Performance audit
npm run audit:performance
```

### Manual Testing Checklist

#### Desktop Testing
- [ ] Chrome: Chat functionality, form submissions
- [ ] Safari: Media queries, CSS compatibility  
- [ ] Firefox: JavaScript features, animations
- [ ] Edge: Overall functionality

#### Mobile Testing
- [ ] iOS Safari: Touch events, safe areas
- [ ] Android Chrome: Performance, scrolling
- [ ] PWA Installation: Both platforms
- [ ] Orientation changes: Portrait/landscape

## 🔐 Security Configuration

### Headers Configuration
All security headers are pre-configured in `vercel.json`:
- HSTS enforcement
- XSS Protection
- Content Security Policy
- Frame Options
- Referrer Policy

### API Security
- Rate limiting: 10 requests/minute (production)
- Request size limit: 1MB
- CORS configured for specific origins
- PII masking in logs

## 🌍 Staging Environment

### Setup Staging Deployment

1. Create preview branch:
```bash
git checkout -b staging
git push origin staging
```

2. Configure staging variables in Vercel:
   - Use `.env.staging` values
   - Enable `EMAIL_DRY_RUN=true`
   - Set `LOG_LEVEL=debug`

3. Access staging at:
   - `https://cbc-agent-staging.vercel.app`
   - Or custom domain if configured

### Staging vs Production

| Feature | Staging | Production |
|---------|---------|------------|
| Rate Limits | 30/min | 10/min |
| Cache TTL | 3 min | 5 min |
| Email | Dry run | Live (when enabled) |
| Logging | Debug | Error only |
| FAQ Badge | Visible | Hidden |

## 🚨 Troubleshooting

### Common Issues & Solutions

#### 1. Cold Start Delays
**Issue**: First request takes >5 seconds
**Solution**: 
- Upgrade to Vercel Pro for better performance
- Implement warming endpoint `/api/warm`
- Use Edge Functions for critical paths

#### 2. Mobile Keyboard Issues
**Issue**: Keyboard covers input on mobile
**Solution**: Applied in `mobile-optimizations.css`
- Fixed positioning with safe areas
- Dynamic viewport height units

#### 3. API Timeouts
**Issue**: Claude API times out on Hobby plan
**Solution**:
- Configured 30s timeout for chat endpoint
- Implement streaming responses (future)
- Add loading states for better UX

#### 4. Memory Issues
**Issue**: Build fails with heap error
**Solution**: 
- Added `NODE_OPTIONS=--max-old-space-size=4096`
- Optimize imports and dependencies

## 📈 Scaling Considerations

### When to Upgrade from Hobby Plan

Consider upgrading when:
- Daily users exceed 1,000
- API calls exceed 10,000/day
- Need guaranteed uptime SLA
- Require custom domain SSL
- Need team collaboration features

### Performance at Scale

| Users/Day | Plan | Estimated Cost | Notes |
|-----------|------|----------------|-------|
| < 1,000 | Hobby | $0 | Good for testing |
| 1,000-10,000 | Pro | $20/mo | Better performance |
| 10,000-50,000 | Team | $50/mo | Priority support |
| 50,000+ | Enterprise | Custom | SLA, dedicated support |

## 🔄 Continuous Deployment

### GitHub Actions Setup

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run test
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## 📝 Post-Deployment Checklist

### Immediate Checks
- [ ] Health endpoint: `GET /api/_health`
- [ ] Chat functionality works
- [ ] Mobile responsive design
- [ ] Form submissions (if enabled)
- [ ] Weather/time queries respond

### 24-Hour Monitoring
- [ ] No error spikes in logs
- [ ] Response times < 2s average
- [ ] Memory usage stable
- [ ] Cache hit rates > 50%
- [ ] No 429 (rate limit) errors

### Weekly Review
- [ ] Performance metrics trending
- [ ] User feedback incorporation
- [ ] Security updates applied
- [ ] Cost within budget
- [ ] Feature flag adjustments

## 🆘 Support & Resources

### Useful Commands

```bash
# View deployment logs
vercel logs

# Check deployment status
vercel ls

# Rollback deployment
vercel rollback

# Set environment variable
vercel env add VARIABLE_NAME

# Pull environment variables
vercel env pull
```

### Resources
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Web Vitals Guide](https://web.dev/vitals/)
- [CBC-Agent Issues](https://github.com/your-org/cbc-agent/issues)

## 🎉 Launch Checklist

### Final Pre-Launch Steps
1. [ ] DNS configured and propagated
2. [ ] SSL certificate active
3. [ ] Analytics configured (if enabled)
4. [ ] Team trained on chat responses
5. [ ] Backup API keys ready
6. [ ] Monitoring alerts configured
7. [ ] Customer support flow defined
8. [ ] Legal/compliance review complete

### Go-Live
1. [ ] Deploy to production
2. [ ] Verify all endpoints
3. [ ] Test on multiple devices
4. [ ] Monitor for 1 hour
5. [ ] Announce launch 🚀

---

**Last Updated**: August 2025
**Version**: 1.0.0
**Optimized for**: Vercel Hobby → Pro plans