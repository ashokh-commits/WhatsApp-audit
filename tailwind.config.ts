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
        g6: {
          bg:      "#0A0A0A",
          surface: "#111318",
          card:    "#1A1D24",
          border:  "#2A2D36",
          accent:  "#4F9CF9",
        },
      },
      fontFamily: {
        heading: ['"Trebuchet MS"', "ui-sans-serif", "system-ui"],
        body:    ["Calibri", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};

export default config;
