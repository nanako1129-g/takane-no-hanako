import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      keyframes: {
        fadePortraitIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeEndingIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        heartSoft: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.05)", opacity: "1" },
        },
        heartWarm: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08)" },
        },
        heartBeat: {
          "0%, 100%": { transform: "scale(1)" },
          "30%": { transform: "scale(1.15)" },
          "60%": { transform: "scale(1.02)" },
        },
        heartFast: {
          "0%, 100%": { transform: "scale(1)" },
          "30%": { transform: "scale(1.18)" },
          "60%": { transform: "scale(1.05)" },
        },
        heartPassion: {
          "0%, 100%": {
            transform: "scale(1)",
            filter: "drop-shadow(0 0 4px rgba(244,63,94,0.5))",
          },
          "30%": {
            transform: "scale(1.22)",
            filter: "drop-shadow(0 0 10px rgba(244,63,94,0.8))",
          },
          "60%": { transform: "scale(1.08)" },
        },
        heartIntense: {
          "0%, 100%": {
            transform: "scale(1.05)",
            filter: "drop-shadow(0 0 8px rgba(220,38,38,0.7))",
          },
          "30%": {
            transform: "scale(1.3)",
            filter: "drop-shadow(0 0 16px rgba(220,38,38,1))",
          },
          "60%": { transform: "scale(1.1)" },
        },
        heartPulseUp: {
          "0%": { transform: "scale(1)" },
          "30%": { transform: "scale(1.4)" },
          "100%": { transform: "scale(1)" },
        },
        heartPulseDown: {
          "0%": { transform: "scale(1)" },
          "30%": { transform: "scale(0.85)" },
          "60%": { transform: "scale(0.92) translateX(-2px)" },
          "75%": { transform: "scale(0.92) translateX(2px)" },
          "100%": { transform: "scale(1) translateX(0)" },
        },
        particleFloat: {
          "0%": {
            transform: "translate(0, 0) scale(0.6)",
            opacity: "0",
          },
          "20%": { opacity: "1" },
          "100%": {
            transform: "translate(var(--tx, 0), -40px) scale(1)",
            opacity: "0",
          },
        },
        toastSlideIn: {
          "0%": { transform: "translateY(-20px)", opacity: "0" },
          "10%": { transform: "translateY(0)", opacity: "1" },
          "90%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(-20px)", opacity: "0" },
        },
      },
      animation: {
        "fade-portrait": "fadePortraitIn 300ms ease-out",
        "fade-ending": "fadeEndingIn 500ms ease-out forwards",
        "heart-soft": "heartSoft 3s ease-in-out infinite",
        "heart-warm": "heartWarm 2s ease-in-out infinite",
        "heart-beat": "heartBeat 1.5s ease-in-out infinite",
        "heart-fast": "heartFast 1s ease-in-out infinite",
        "heart-passion": "heartPassion 0.9s ease-in-out infinite",
        "heart-intense": "heartIntense 0.7s ease-in-out infinite",
        "heart-pulse-up": "heartPulseUp 600ms ease-out",
        "heart-pulse-down": "heartPulseDown 600ms ease-out",
        "particle-float": "particleFloat 1.2s ease-out forwards",
        "toast-slide": "toastSlideIn 3s ease-in-out forwards",
      },
    },
  },
  plugins: [],
};
export default config;
