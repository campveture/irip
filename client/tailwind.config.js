/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        brass: 'var(--palette-brass)',
        stone: 'var(--palette-stone)',
        linen: 'var(--palette-linen)',
        sage: 'var(--palette-sage)',
        midnight: 'var(--palette-midnight)',
        brand: {
          50: '#f0f4f1',
          100: '#e0e9e2',
          200: '#c6d8cc',
          300: '#a7c2b2',
          400: '#759b85',
          500: '#477762',
          600: '#2d6150',
          700: '#245448',
          800: '#1d4037',
          900: '#15362f',
          950: '#102923',
        },
        slate: {
          50: '#f7f7f4',
          100: '#eeeee9',
          200: '#deded6',
          300: '#c3c7c2',
          400: '#858f8e',
          500: '#626f71',
          600: '#4d5c61',
          700: '#394b53',
          800: '#2b3d46',
          900: '#24323a',
          950: '#17232b',
        },
        success: {
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
        },
        warning: {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
        info: {
          50: '#eff6ff',
          500: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        bengali: ['"Baloo Da 2"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        card: '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        elevated: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
        glow: '0 0 0 3px rgb(36 84 72 / 0.2)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'bar-grow': {
          '0%': { width: '0%' },
          '100%': { width: 'var(--bar-width, 100%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'scale-in': 'scale-in 0.25s ease-out',
        'bar-grow': 'bar-grow 0.7s ease-out forwards',
        shimmer: 'shimmer 1.5s linear infinite',
      },
    },
  },
  plugins: [],
};
