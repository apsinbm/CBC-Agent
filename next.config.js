/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    CLAUDE_API_MODEL: process.env.CLAUDE_API_MODEL,
    CLAUDE_CLI_MODEL: process.env.CLAUDE_CLI_MODEL,
  },
  // Completely disable all Next.js dev indicators including "Static route" badge
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
    appIsrStatus: false, // Disable ISR status indicator
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
}

module.exports = nextConfig