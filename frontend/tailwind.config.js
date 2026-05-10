/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          900: "#14532d",
        },
        cream: {
          50:  "#faf8f5",
          100: "#f4f1ec",
          200: "#ede8e0",
          300: "#e5e0d8",
        },
      },
      boxShadow: {
        card:         "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
        "card-hover": "0 4px 14px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        "card-lift":  "0 8px 24px rgba(0,0,0,0.10)",
        "nav":        "0 1px 4px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};
