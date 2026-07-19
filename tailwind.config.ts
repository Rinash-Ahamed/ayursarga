import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        clay: { DEFAULT: "#A88E75", dark: "#8C7259" },
        cream: { DEFAULT: "#F9F5EA", 2: "#F1EADA" },
        sage: "#6C6D5D",
        forest: "#3A3D2E",
        ink: "#2A281F",
        gold: "#C9A66B",
        rust: "#8B5E3C",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-manrope)", "sans-serif"],
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(.16,.84,.44,1)",
        out: "cubic-bezier(.22,1,.36,1)",
      },
    },
  },
  plugins: [],
};
export default config;
