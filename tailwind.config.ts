import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pretendard: ['"Pretendard Variable"', "Pretendard", "system-ui", "sans-serif"],
      },
      colors: {
        // 파스텔 목장 팔레트
        pasture: {
          50: "#F0F9F0",
          100: "#DCEEDC",
          500: "#A3D9A5", // 출석 (파스텔 초록)
          600: "#7FC181",
        },
        wheat: {
          50: "#FDF9E7",
          500: "#F5D97B", // 사유입력 (파스텔 노랑)
        },
        coral: {
          50: "#FEF0EE",
          500: "#F08A80", // 미확인 (산호색)
        },
      },
    },
  },
  plugins: [],
};

export default config;
