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
        surface: {
          DEFAULT: '#0f0f11',
          1: '#18181c',
          2: '#22222a',
          3: '#2c2c38',
        },
        accent: {
          DEFAULT: '#c8a96e',
          light: '#e8c98e',
          muted: '#8a7050',
        },
        primary: '#f5f5f7',
        'text-secondary': '#a1a1aa',
        muted: '#6b7280',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
