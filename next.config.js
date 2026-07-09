/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // 일정표 가져오기: 이미지/PDF/엑셀 업로드가 서버 액션 본문으로 전달됨.
      bodySizeLimit: "10mb",
    },
  },
};

module.exports = nextConfig;
