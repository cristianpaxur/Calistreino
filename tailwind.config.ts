import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0C",
        surface: "#131319",
        accent: "#D6FB3D",
        cyan: "#7FE7FF",
        danger: "#FF4438",
        "danger-soft": "#FF6F66",
        warn: "#FFC14D",
        pink: "#FF6FD8",
        ink: "#F4F4F0",
        "ink-soft": "#D8D8D2",
        muted: "#9A9AA4",
        "muted-2": "#6E6E78",
        "muted-3": "#5A5A63",
      },
      fontFamily: {
        sans: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Anton", "Archivo", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      keyframes: {
        fadeUp: { from: { transform: "translateY(16px)", opacity: "0" }, to: { transform: "none", opacity: "1" } },
        pop: { from: { transform: "scale(.94)", opacity: "0" }, to: { transform: "scale(1)", opacity: "1" } },
        heartbeat: {
          "0%,100%": { transform: "scale(1)" },
          "7%": { transform: "scale(1.045)" },
          "14%": { transform: "scale(1)" },
          "21%": { transform: "scale(1.025)" },
          "28%": { transform: "scale(1)" },
        },
        ringPulse: {
          "0%": { opacity: ".55", transform: "scale(.96)" },
          "55%": { opacity: ".08", transform: "scale(1.16)" },
          "100%": { opacity: ".55", transform: "scale(.96)" },
        },
        drawLine: { from: { strokeDashoffset: "900" }, to: { strokeDashoffset: "0" } },
        growBar: { from: { transform: "scaleY(0)" }, to: { transform: "scaleY(1)" } },
        restThrob: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(255,68,56,.35)" },
          "50%": { boxShadow: "0 0 0 10px rgba(255,68,56,0)" },
        },
        holdGlow: {
          "0%,100%": { boxShadow: "0 0 40px rgba(214,251,61,.25), inset 0 0 0 2px rgba(214,251,61,.6)" },
          "50%": { boxShadow: "0 0 70px rgba(214,251,61,.45), inset 0 0 0 2px rgba(214,251,61,.9)" },
        },
      },
      animation: {
        fadeUp: "fadeUp .5s both",
        pop: "pop .5s both",
        heartbeat: "heartbeat 3.4s ease-in-out infinite",
        ringPulse: "ringPulse 2.8s ease-in-out infinite",
        drawLine: "drawLine 1.3s ease-out both",
        growBar: "growBar .5s ease-out both",
        restThrob: "restThrob 1.6s ease-in-out infinite",
        holdGlow: "holdGlow 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
