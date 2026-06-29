/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"SF Mono"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        cmd: {
          bg: '#070707',
          panel: '#0c0c0d',
          panel2: '#161617',
          border: '#262629',
          grid: '#19191b',
          text: '#f3f4f5',
          dim: '#71747a',
          accent: '#f4642a',
          green: '#46a883',
          amber: '#cf9a40',
          red: '#d94a3d',
          magenta: '#b8704a',
        },
      },
      boxShadow: {
        glow: '0 0 18px -6px rgba(242,90,42,0.4)',
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
