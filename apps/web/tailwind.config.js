/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        dominofy: {
          light: {
            background: '#f9fafb',
            panel: '#ffffff',
            surface: '#f3f4f6',
            text: '#1f2937',
            accent: '#2563eb'
          },
          dark: {
            background: '#111827',
            panel: '#1f2937',
            surface: '#374151',
            text: '#f9fafb',
            accent: '#3b82f6'
          }
        }
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
}
