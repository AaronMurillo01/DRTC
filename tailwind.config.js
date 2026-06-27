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
          bg: '#05070a',
          panel: '#0a0e14',
          panel2: '#0d131c',
          border: '#1b2430',
          grid: '#11202c',
          text: '#c7d3df',
          dim: '#5c6b7a',
          accent: '#22d3ee',
          green: '#34d399',
          amber: '#fbbf24',
          red: '#f87171',
          magenta: '#e879f9',
        },
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
