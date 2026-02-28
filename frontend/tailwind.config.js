/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080a0f',
        bg2: '#0d1017',
        bg3: '#131720',
        surface: '#161c27',
        surface2: '#1c2333',
        border: '#1f2937',
        border2: '#2d3748',
        accent: '#f97316',
        accent2: '#fb923c',
        'accent-dim': 'rgba(249,115,22,0.15)',
        text: '#f1f5f9',
        text2: '#94a3b8',
        text3: '#475569',
        brand: {
          50: '#fff7ed',
          500: '#f97316',
          600: '#ea6c0d',
        }
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      animation: {
        'slide-up': 'slideUp 0.4s ease',
        'fade-in': 'fadeIn 0.3s ease',
        'pulse-glow': 'pulseGlow 2s infinite',
        'bounce-in': 'bounceIn 0.5s ease'
      },
      keyframes: {
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' }
        },
        bounceIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '60%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
}
