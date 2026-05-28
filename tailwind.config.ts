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
          surface: "#0F0F0F",
          card:    "#141414",
          border:  "#252525",
          accent:  "#FF4500",
          orange:  "#FF6A00",
          red:     "#CC1100",
        },
      },
      fontFamily: {
        heading: ['"Trebuchet MS"', "ui-sans-serif", "system-ui"],
        body:    ["Calibri", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        orange: "0 4px 24px rgba(255,69,0,0.25)",
        card:   "0 2px 12px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
