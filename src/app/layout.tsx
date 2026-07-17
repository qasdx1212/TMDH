import type { Metadata } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import SiteGate from "@/components/SiteGate";

const BASE_URL = "https://zipzipworld.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "집.zip — 당신만의 디지털 공간",
  description: "400×200 격자 지도 위에 당신만의 집을 입주하세요. 집.zip은 밀리언 달러 홈페이지에서 영감을 받은 한국형 디지털 부동산 플랫폼입니다.",
  keywords: ["집.zip", "픽셀 지도", "디지털 부동산", "밀리언달러홈페이지", "픽셀아트"],
  authors: [{ name: "집.zip" }],
  openGraph: {
    type: "website",
    url: BASE_URL,
    title: "집.zip — 당신만의 디지털 공간",
    description: "400×200 격자 지도 위에 당신만의 집을 입주하세요.",
    siteName: "집.zip",
    locale: "ko_KR",
    images: [{ url: "/og", width: 1200, height: 630, alt: "집.zip 지도" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "집.zip — 당신만의 디지털 공간",
    description: "400×200 격자 지도 위에 당신만의 집을 입주하세요.",
    images: ["/og"],
  },
  icons: { icon: "/favicon.ico" },
  // 비공개(유지보수) 모드에선 검색 노출 안 함. 오픈 시 NEXT_PUBLIC_MAINTENANCE=off
  robots: process.env.NEXT_PUBLIC_MAINTENANCE !== "off"
    ? { index: false, follow: false }
    : { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <ErrorBoundary><SiteGate>{children}</SiteGate></ErrorBoundary>
      </body>
    </html>
  );
}
