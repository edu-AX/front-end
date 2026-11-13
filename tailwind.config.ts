import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { cream: "#FFF8EC", ink: "#3b3a36" },
      fontFamily: { sans: ["Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
