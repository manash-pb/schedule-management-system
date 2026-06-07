/** @type {import('tailwindcss').Config} */
export default {
  // THIS IS THE LINE YOU NEED TO ADD
  darkMode: 'class',

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        swing: {
          '0%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(15deg)' },
          '40%': { transform: 'rotate(-10deg)' },
          '60%': { transform: 'rotate(5deg)' },
          '80%': { transform: 'rotate(-5deg)' },
          '100%': { transform: 'rotate(0deg)' },
        }
      },
      animation: {
        swing: 'swing 0.6s ease-in-out',
      }
    },
  },
  plugins: [],
}