/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        cmd: {
          bg: '#05080e',
          panel: '#0b101a',
          panel2: '#101825',
          border: '#1d2838',
          grid: '#11202c',
          text: '#d4dde8',
          dim: '#6b7c90',
          accent: '#22d3ee',
          green: '#34d399',
          amber: '#fbbf24',
          red: '#f87171',
          magenta: '#e879f9',
        },
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(34,211,238,0.35)',
      },
      keyframes: {
        ping2: {
          '75%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      animation: {
        ping2: 'ping2 1.6s cubic-bezier(0,0,0.2,1) infinite',
        sweep: 'sweep 3s linear infinite',
        flicker: 'flicker 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
