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
        // === 디자인 기본 팔레트 (2026-07-10 사용자 확정 — 파스텔 목장) ===
        // Warm Cream 바탕 · Sage 주색 · Dusty Blue 보조 · Lavender 미체크
        // Golden Wheat 사유결석 · Blush 연락필요 · Forest 강조 · Charcoal 텍스트
        bg: "#FAF8F2", // Warm Cream
        card: "#F1EDE2", // 크림 카드(바탕보다 한 톤 깊게)
        border: "#E7E1D3",
        ivory: "#F9F7F2", // Sheep Wool
        ink: { DEFAULT: "#374151", muted: "#6B7280" }, // Charcoal
        sage: { DEFAULT: "#A8C5A1", deep: "#4F6A52", soft: "#E2ECDF" }, // Primary / Forest
        sky: { DEFAULT: "#7E9CA2", deep: "#5F7F86", soft: "#E3EBEC" }, // Dusty Blue
        gold: { DEFAULT: "#F3C86B", deep: "#A97A1F", soft: "#FBEBC9" }, // Golden Wheat
        lavender: { DEFAULT: "#B9B3D8", soft: "#E6E3F2" }, // Soft Lavender (미체크)
        blush: { DEFAULT: "#F6C7CF", deep: "#8E3A44", soft: "#FBE4E8" }, // Pink Ear (연락필요)
        present: { DEFAULT: "#A8C5A1", soft: "#E2ECDF" },
        excused: { DEFAULT: "#F3C86B", soft: "#FBEBC9" },
        unconfirmed: { DEFAULT: "#C2606C", soft: "#FBE4E8" },
        coin: "#F3C86B",
        star: "#F3C86B",
        danger: "#C2606C", // blush 계열의 짙은 로즈 (팔레트에 순수 빨강 없음)

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
