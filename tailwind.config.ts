import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F7F2E9",
        paper: "#FCF9F3",
        ink: "#1F1B18",
        muted: "#7C746B",
        blush: "#F5D8D2",
        rose: "#DE9A90",
        butter: "#F2DEA6",
        sage: "#CBD6C2",
        sky: "#C9E1EC",
        lilac: "#DED6EE",
      },
      fontFamily: {
        sans: ["DM Sans", "Noto Sans KR", "system-ui", "sans-serif"],
        display: ["Instrument Serif", "Georgia", "serif"],
        korean: ["Noto Sans KR", "system-ui", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      boxShadow: {
        soft: "0 24px 60px -30px rgba(62, 46, 35, 0.35)",
        card: "0 18px 40px -28px rgba(62, 46, 35, 0.4)",
        strip: "0 32px 70px -34px rgba(35, 26, 20, 0.55)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "0.9", transform: "scale(1.04)" },
        },
        flash: {
          "0%": { opacity: "0" },
          "12%": { opacity: "0.92" },
          "100%": { opacity: "0" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 600ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "soft-pulse": "soft-pulse 3.5s ease-in-out infinite",
        flash: "flash 500ms ease-out both",
        "spin-slow": "spin-slow 12s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
