import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        surface: '#111111',
        'surface-2': '#1A1A1A',
        border: '#2A2A2A',
        accent: '#FF6B00',
        'accent-hover': '#E05A00',
        'text-primary': '#FFFFFF',
        'text-secondary': '#AAAAAA',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
