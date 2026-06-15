import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5d9e0",
          300: "#aeb4bf",
          400: "#7b8190",
          500: "#525a6b",
          600: "#3b4250",
          700: "#2a303d",
          800: "#1c2129",
          900: "#0f131a",
        },
        accent: {
          DEFAULT: "#2f6feb",
          50: "#eef4fe",
          500: "#2f6feb",
          600: "#2459c9",
        },
        rag: {
          red: "#dc2626",
          amber: "#d97706",
          green: "#16a34a",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
