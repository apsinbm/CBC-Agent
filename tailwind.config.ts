import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cbc-blue': '#4b96b0',        // Official Coral Beach teal from website
        'cbc-blue-dark': '#3a7c94',  // Darker shade for gradients
        'cbc-sand': '#F5E6D3',
        'cbc-coral': '#FF6B6B',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config