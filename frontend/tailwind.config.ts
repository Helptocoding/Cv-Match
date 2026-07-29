import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1d1d1f",
        canvas: "#f5f5f7",
        accent: "#0071e3",
        pine: "#1d1d1f",
        stone: "#d2d2d7",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        "hero": ["3.5rem", { lineHeight: "0.95", letterSpacing: "-0.03em", fontWeight: "700" }],
        "hero-md": ["5rem", { lineHeight: "0.92", letterSpacing: "-0.03em", fontWeight: "700" }],
      },
      boxShadow: {
        soft: "0 2px 12px rgba(0,0,0,0.08)",
        card: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
        "card-hover": "0 2px 8px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.06)",
        button: "0 2px 8px rgba(0,0,0,0.12)",
        "button-hover": "0 4px 14px rgba(0,0,0,0.18)",
      },
      borderRadius: {
        "2xl": "14px",
        "3xl": "18px",
        "4xl": "24px",
      },
      animation: {
        "fade-in": "fadeIn 0.35s ease-out both",
        "slide-up": "slideUp 0.4s ease-out both",
        "scale-in": "scaleIn 0.3s ease-out both",
        "grow-bar": "growBar 0.6s ease-out both",
        "fade-in-up": "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in-down": "fadeInDown 0.4s ease-out both",
        "slide-in-right": "slideInRight 0.35s ease-out both",
        "stagger-in": "staggerIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-subtle": "pulseSubtle 2s ease-in-out infinite",
        "scale-in-bounce": "scaleInBounce 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        growBar: {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          from: { opacity: "0", transform: "translateX(14px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        staggerIn: {
          from: { opacity: "0", transform: "translateY(10px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        scaleInBounce: {
          from: { opacity: "0", transform: "scale(0.95)" },
          "60%": { transform: "scale(1.02)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(100%)" },
        },
      },
    }
  },
  plugins: []
};

export default config;
