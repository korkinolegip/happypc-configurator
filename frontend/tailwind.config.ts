import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Theme-aware colors via CSS variables
        th: {
          bg: 'var(--bg)',
          page: 'var(--bg-page)',
          surface: 'var(--surface)',
          'surface-2': 'var(--surface-2)',
          'surface-3': 'var(--surface-3)',
          border: 'var(--border)',
          'border-2': 'var(--border-2)',
          text: 'var(--text)',
          'text-2': 'var(--text-2)',
          'text-3': 'var(--text-3)',
          muted: 'var(--text-muted)',
          input: 'var(--input-bg)',
          'input-border': 'var(--input-border)',
          placeholder: 'var(--input-placeholder)',
        },
        accent: {
          DEFAULT: '#FF6B00',
          hover: '#E05A00',
          light: 'var(--accent-light)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'th': 'var(--shadow)',
        'th-lg': 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
}

export default config
