import "./globals.css";
import type { Metadata } from "next";
import { AppProvider } from "@/lib/state";

export const metadata: Metadata = { title: "교사 인수인계 플랫폼", description: "작년 담당자의 기록과 올해 기준을 이어주는 교사용 인수인계 플랫폼" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen font-sans antialiased"><AppProvider>{children}</AppProvider></body>
    </html>
  );
}
