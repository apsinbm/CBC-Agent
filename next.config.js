/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // DO NOT expose API keys to client - removed ANTHROPIC_API_KEY
  env: {
    // Only expose non-sensitive config to client
    NEXT_PUBLIC_CLAUDE_API_MODEL: process.env.CLAUDE_API_MODEL,
    NEXT_PUBLIC_CLAUDE_CLI_MODEL: process.env.CLAUDE_CLI_MODEL,
  },
  // Disable Next.js dev indicators
  devIndicators: {
    position: 'bottom-right',
  },
  // Optimize for mobile and cross-browser compatibility
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizeCss: true,
  },
  // Add browser polyfills for older browsers
  transpilePackages: [],
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  // Security headers and caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Security headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.anthropic.com https://api.openai.com https://worldtimeapi.org https://api.open-meteo.com; frame-ancestors 'none';"
          }
        ],
      },
      // Cache static assets
      {
        source: '/(.*)\\.(png|jpg|jpeg|gif|svg|ico|webp)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ],
      },
      {
        source: '/(.*)\\.(js|css|woff|woff2|ttf|otf)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ],
      },
      // Cache API responses appropriately
      {
        source: '/api/weather/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600'
          }
        ],
      },
      {
        source: '/api/faq/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=7200'
          }
        ],
      },
    ]
  },
}

module.exports = nextConfig