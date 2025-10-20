/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0ea5e9',
        accent: '#f59e0b',
        success: '#22c55e',
        danger: '#ef4444'
      }
    },
  },
  plugins: [],
}
