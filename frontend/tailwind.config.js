/** @type {import('tailwindcss').Config} */
export default {
  // THIS IS THE LINE YOU NEED TO ADD
  darkMode: 'class',

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}