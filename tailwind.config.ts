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
        "brand-blue": "#2563eb",
        "brand-blue-dark": "#1d4ed8",
        "brand-blue-light": "#dbeafe",
        success: "#059669",
        "success-bg": "#ecfdf5",
        warning: "#d97706",
        "warning-bg": "#fffbeb",
        critical: "#dc2626",
        "critical-bg": "#fef2f2",
        surface: "#f8fafc",
        "surface-card": "#ffffff",
        "surface-border": "#e2e8f0",
        "surface-border-strong": "#cbd5e1",
        "surface-hover": "#f8fafc",
        "text-primary": "#0f172a",
        "text-secondary": "#334155",
        "text-muted": "#64748b",
        "text-invert": "#ffffff",
      },
      fontSize: {
        "metric-lg": ["28px", { lineHeight: "32px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "metric-sm": ["20px", { lineHeight: "28px", fontWeight: "700", letterSpacing: "-0.01em" }],
        "data-mono": ["13px", { lineHeight: "16px", fontWeight: "500", letterSpacing: "-0.005em" }],
        "label-sm": ["11px", { lineHeight: "14px", fontWeight: "500", letterSpacing: "0.03em" }],
      },
    },
  },
  plugins: [],
};

export default config;
