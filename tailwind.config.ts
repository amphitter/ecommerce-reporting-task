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
        brand: {
          blue: "#2563EB",
          "blue-dark": "#1D4ED8",
          "blue-light": "#DBEAFE",
        },
        success: {
          DEFAULT: "#059669",
          bg: "#ECFDF5",
        },
        warning: {
          DEFAULT: "#D97706",
          bg: "#FFFBEB",
        },
        critical: {
          DEFAULT: "#DC2626",
          bg: "#FEF2F2",
        },
        surface: {
          DEFAULT: "#F8FAFC",
          card: "#FFFFFF",
          border: "#E2E8F0",
          "border-strong": "#CBD5E1",
          hover: "#F8FAFC",
        },
        text: {
          primary: "#0F172A",
          secondary: "#334155",
          muted: "#64748B",
          invert: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["Inter", "monospace"],
      },
      fontSize: {
        "metric-lg": ["28px", { lineHeight: "32px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "metric-sm": ["20px", { lineHeight: "28px", fontWeight: "700", letterSpacing: "-0.01em" }],
        "data-mono": ["13px", { lineHeight: "16px", fontWeight: "500", letterSpacing: "-0.005em" }],
        "label-sm": ["11px", { lineHeight: "14px", fontWeight: "500", letterSpacing: "0.03em" }],
      },
      borderRadius: {
        "4": "4px",
        "8": "8px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
        dropdown: "0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)",
        modal: "0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
