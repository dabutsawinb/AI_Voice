import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f4ff",
          100: "#dce6ff",
          200: "#b9cdff",
          300: "#85a8ff",
          400: "#4a7aff",
          500: "#1a4fff",
          600: "#0033e6",
          700: "#002abf",
          800: "#00229b",
          900: "#001a7a",
        },
        surface: {
          DEFAULT: "#0f1117",
          card: "#1a1d27",
          border: "#2a2d3e",
          hover: "#222537",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "wave": "wave 1.5s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(2)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px #1a4fff, 0 0 10px #1a4fff" },
          "100%": { boxShadow: "0 0 20px #1a4fff, 0 0 40px #4a7aff" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
