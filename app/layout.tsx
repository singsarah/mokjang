import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "목장 관리",
  description: "교회 고등부 출석·일정·생일·학적부 관리",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          type="text/css"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="font-pretendard antialiased">{children}</body>
    </html>
  );
}
