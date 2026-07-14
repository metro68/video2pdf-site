import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#0d9488",
          "primary-dark": "#0b7c72",
          "primary-light": "#34d399",
          pro: "#7c3aed",
          bg: "#0f172a",
          "bg-alt": "#0b1120",
          "bg-card": "#1e293b",
          text: "#f8fafc",
          "text-secondary": "#94a3b8",
          border: "#334155",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Oxygen", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
