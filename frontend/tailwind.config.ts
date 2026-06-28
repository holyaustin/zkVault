import type { Config } from "tailwindcss";

// Design tokens — "vault ledger" direction. See README.md "Design notes"
// for the reasoning: dark vault interior, brass hardware, parchment text,
// wax-seal stamps for verified/rejected. Deliberately not the generic
// dark-mode neon-accent crypto dashboard look.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vault: {
          ink: "#0E1116", // page background — vault interior
          panel: "#161B22", // card / drawer surface
          steel: "#232A33", // borders, dividers, recessed UI
        },
        parchment: {
          DEFAULT: "#E8E3D3", // primary text — warm, not pure white
          dim: "#A8A296", // secondary text
        },
        brass: {
          DEFAULT: "#B08D57", // hardware accent — borders, icons, labels
          bright: "#D1AD74",
        },
        seal: {
          verified: "#2F6F4E", // wax-seal green
          rejected: "#8C3B3B", // wax-seal red
          pending: "#6B5B3E",
        },
        redact: "#050505",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
        sans: ["var(--font-sans)"],
      },
      keyframes: {
        stamp: {
          "0%": { transform: "scale(2.2) rotate(-18deg)", opacity: "0" },
          "60%": { transform: "scale(0.92) rotate(-8deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(-6deg)", opacity: "1" },
        },
        "redact-sweep": {
          "0%": { width: "0%" },
          "100%": { width: "100%" },
        },
      },
      animation: {
        stamp: "stamp 420ms cubic-bezier(0.2, 0.8, 0.2, 1) 1",
        "redact-sweep": "redact-sweep 280ms ease-out 1",
      },
    },
  },
  plugins: [],
};

export default config;
