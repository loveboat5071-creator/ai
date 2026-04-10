import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WS MEDIA",
  description: "견적, 소재 제작, 광고주 마이닝, 영업 도구를 묶은 WS MEDIA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
