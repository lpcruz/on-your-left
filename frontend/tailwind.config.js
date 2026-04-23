/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        crowd: {
          empty: '#16a34a',
          'empty-bg': '#dcfce7',
          'empty-border': '#86efac',
          moderate: '#d97706',
          'moderate-bg': '#fef3c7',
          'moderate-border': '#fcd34d',
          packed: '#dc2626',
          'packed-bg': '#fee2e2',
          'packed-border': '#fca5a5',
          historical: '#6b7280',
          'historical-bg': '#f3f4f6',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
