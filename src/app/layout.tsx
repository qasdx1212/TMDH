import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "집.zip — 당신만의 공간, 집.zip",
  description: "100×100 픽셀 지도 위에 당신만의 집을 입주하세요. 집.zip은 디지털 부동산 플랫폼입니다.",
  keywords: ["집.zip", "픽셀 지도", "디지털 부동산", "집", "공간"],
  openGraph: {
    type: "website",
    title: "집.zip — 당신만의 공간",
    description: "100×100 픽셀 지도 위에 당신만의 집을 입주하세요.",
    siteName: "집.zip",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "집.zip — 당신만의 공간",
    description: "100×100 픽셀 지도 위에 당신만의 집을 입주하세요.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
