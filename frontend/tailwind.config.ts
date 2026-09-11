import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Bookshelf brand -- deep ink blue + warm paper + amber accent
        ink: {
          50: "#f0f4ff",
          100: "#e0e9ff",
          200: "#c1d3fe",
          300: "#93b4fc",
          400: "#6090f8",
          500: "#3b6ef4",
          600: "#2450ea",
          700: "#1c3dd7",
          800: "#1c33af",
          900: "#1c3089",
          950: "#141f54",
        },
        paper: {
          50: "#faf8f5",
          100: "#f5f0e8",
          200: "#ece3d4",
          300: "#ddd0b8",
          400: "#cab896",
          500: "#b9a07a",
        },
        amber: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Lora", "Georgia", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
