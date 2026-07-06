import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // 제목/강조: 교보손글씨2019(자체 호스팅 시) → Gaegu(현재 손글씨 대체) → Pretendard
        display: ['"Kyobo2019"', '"Gaegu"', "Pretendard", "system-ui", "sans-serif"],
        // 본문: 나눔스퀘어(자체 호스팅 시) → Pretendard
        sans: ['"NanumSquare"', "Pretendard", "system-ui", "sans-serif"],
        pretendard: ['"Pretendard Variable"', "Pretendard", "system-ui", "sans-serif"],
      },
      colors: {
        // === 디자인 가이드 팔레트 (양떼 · 크리스천 파스텔) ===
        bg: "#FBF6EC", // 크림 배경
        card: "#F4ECDC", // 카드 베이지
        border: "#E4E1D3",
        ink: { DEFAULT: "#2C382F", muted: "#6E7C6C" },
        sage: { DEFAULT: "#90B484", deep: "#4E6A47", soft: "#DCE7D3" },
        sky: { DEFAULT: "#9FCDEC", deep: "#5B93C4", soft: "#E4F0FA" },
        gold: { DEFAULT: "#F0C86E", deep: "#C9A24C", soft: "#FBEDC9" },
        present: { DEFAULT: "#90B484", soft: "#DCE7D3" },
        excused: { DEFAULT: "#F0C86E", soft: "#FBEDC9" },
        unconfirmed: { DEFAULT: "#D9645F", soft: "#F6D8D6" },
        coin: "#F2B33D",
        star: "#F0C86E",
        danger: "#D9645F",

        // === 기존 파스텔 팔레트 (미전환 화면 호환용, 점진 교체) ===
        pasture: {
          50: "#F0F9F0",
          100: "#DCEEDC",
          500: "#A3D9A5",
          600: "#7FC181",
        },
        wheat: { 50: "#FDF9E7", 500: "#F5D97B" },
        coral: { 50: "#FEF0EE", 500: "#F08A80" },
      },
      borderRadius: {
        card: "18px",
        btn: "11px",
        tag: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
