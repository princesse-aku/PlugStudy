import type { Config } from "tailwindcss";

// Les couleurs viennent des variables CSS de globals.css : le mode sombre
// n'aura qu'à redéfinir ces variables.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        screen: "var(--screen)",
        page: "var(--page)",
        card: "var(--card)",
        line: "var(--line)",
        pale: "var(--pale)",
        pale2: "var(--pale-text)",
        ink: "var(--text)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "on-accent": "var(--on-accent)",
        deep: "var(--deep)",
        field: "var(--field)",
        danger: "var(--danger)",
        "danger-bg": "var(--danger-bg)",
        spark: "var(--spark)",
        neutral: "var(--neutral)",
        "neutral-ink": "var(--neutral-text)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Poppins", "system-ui", "sans-serif"],
      },
      keyframes: {
        pop: {
          "0%": { opacity: "0", transform: "scale(.8)" },
          "60%": { opacity: "1", transform: "scale(1.04)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        pop: "pop 1.2s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
