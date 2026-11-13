import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {
    colors: { ink: "#111318", panel: "#191c23", line: "#2b303a", accent: "#8b7cff", paper: "#f7f7f5" },
    boxShadow: { soft: "0 24px 80px rgba(0,0,0,.28)" }
  }},
  plugins: []
};
export default config;