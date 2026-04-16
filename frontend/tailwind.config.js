/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#1e1b4b'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 12px 40px -16px rgba(15, 23, 42, 0.2)',
        lift: '0 20px 50px -24px rgba(30, 27, 75, 0.35)'
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        heartPop: {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '120% 0' },
          '100%': { backgroundPosition: '-120% 0' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      },
      animation: {
        fadeInUp: 'fadeInUp 0.55s ease-out forwards',
        heartPop: 'heartPop 0.35s ease-out',
        shimmer: 'shimmer 1.65s ease-in-out infinite',
        fadeIn: 'fadeIn 0.28s ease-out forwards'
      }
    }
  },
  plugins: []
};
