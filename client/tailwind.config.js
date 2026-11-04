/** @type {import('tailwindcss').Config} */
const token = name => `rgb(var(--irip-${name}) / <alpha-value>)`;
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
        accent: token('lavender'),
        selected: token('lavender-pale'),
        inverse: token('inverse-muted'),
        stone: token('border'),
        linen: token('lavender-pale'),
        brand: {
          50: token('lavender-pale'),
          100: token('inverse-muted'),
          200: token('inverse-muted'),
          300: token('lavender'),
          400: token('lavender-deep'),
          500: token('lavender-deep'),
          600: token('lavender-deep'),
          700: token('indigo'),
          800: token('indigo-hover'),
          900: token('indigo'),
          950: token('indigo-pressed'),
        },
        slate: {
          50: token('ivory'),
          100: token('lavender-pale'),
          200: token('border'),
          300: token('control-border'),
          400: token('muted'),
          500: token('muted'),
          600: token('muted'),
          700: token('indigo-hover'),
          800: token('indigo'),
          900: token('indigo'),
          950: token('indigo-pressed'),
        },
        success: {
          50: token('success-surface'),
          500: token('success'),
          600: token('success'),
        },
        warning: {
          50: token('warning-surface'),
          500: token('warning'),
          600: token('warning'),
        },
        danger: {
          50: token('error-surface'),
          500: token('error'),
          600: token('error'),
        },
        // Audited legacy status classes remain green/amber/red, not brand indigo.
        // Keep lighter inverse-status shades and decorative borders available.
        green: {
          50: token('success-surface'), 100: token('success-surface'),
          600: token('success'), 700: token('success'), 800: token('success'), 900: token('success'),
        },
        amber: {
          50: token('warning-surface'), 100: token('warning-surface'),
          700: token('warning'), 800: token('warning'), 900: token('warning'), 950: token('warning'),
        },
        red: {
          50: token('error-surface'), 100: token('error-surface'),
          600: token('error'), 700: token('error'), 800: token('error'), 900: token('error'),
        },
        info: {
          50: '#eff6ff',
          500: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['var(--font-ui)'],
        editorial: ['var(--font-editorial)'],
        bengali: ['"Baloo Da 2"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.45' }],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        card: '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        elevated: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
        glow: '0 0 0 3px rgb(var(--irip-lavender-deep) / 0.2)',
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
