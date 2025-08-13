/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    CLAUDE_API_MODEL: process.env.CLAUDE_API_MODEL,
    CLAUDE_CLI_MODEL: process.env.CLAUDE_CLI_MODEL,
  },
}

module.exports = nextConfig