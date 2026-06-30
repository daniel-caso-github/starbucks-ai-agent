import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F1F8F5',
          100: '#E4F2EB',
          500: '#006241',
          700: '#1E3932',
          900: '#14201C',
        },
        surface: {
          50: '#FBFDFC',
          100: '#E7EEEA',
          200: '#EAF0ED',
          300: '#DCE6E1',
        },
        muted: {
          400: '#7B8A83',
          500: '#5B6B64',
          600: '#46544D',
        },
        danger: {
          500: '#B5482F',
          600: '#C0432F',
        },
        warn: {
          500: '#B8772A',
        },
        hot: {
          500: '#A66A28',
          bg: '#F4E7D6',
        },
        cold: {
          500: '#2E6E80',
          bg: '#E2EEF2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      keyframes: {
        blink: {
          '0%, 80%, 100%': { opacity: '0.25', transform: 'translateY(0)' },
          '40%': { opacity: '1', transform: 'translateY(-2px)' },
        },
        shim: {
          '0%': { backgroundPosition: '-260px 0' },
          '100%': { backgroundPosition: '260px 0' },
        },
        pulse_soft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        slide_up: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        blink: 'blink 1.3s infinite',
        shim: 'shim 1.2s infinite',
        pulse_soft: 'pulse_soft 1.8s infinite',
        slide_up: 'slide_up 0.3s ease both',
      },
    },
  },
  plugins: [],
};

export default config;
