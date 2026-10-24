import type { Metadata } from "next";
import { Noto_Serif_TC, Noto_Sans_TC } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import Link from "next/link";
import AuthWrapper from "@/components/AuthWrapper";

const notoSerifTC = Noto_Serif_TC({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-serif-tc",
});

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-noto-sans-tc",
});

export const metadata: Metadata = {
  title: "台灣女性主義與公益實務課程",
  description: "24週自學課程：從歷史、思想到實踐",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-TW">
      <body
        className={`${notoSerifTC.variable} ${notoSansTC.variable} antialiased`}
        style={{ fontFamily: 'var(--font-noto-serif-tc)' }}
        data-auth-enabled={process.env.CLASS_PASSCODE ? "true" : "false"}
      >
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-gray-600">載入中...</div>
          </div>
        }>
          <AuthWrapper>
            <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
              <div className="max-w-6xl mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  <Link href="/" className="font-semibold text-lg no-underline hover:no-underline text-gray-900">
                    台灣女性主義與公益實務
                  </Link>
                  <div className="flex gap-6">
                    <Link href="/" className="text-sm no-underline hover:underline">
                      首頁
                    </Link>
                    <Link href="/notebook" className="text-sm no-underline hover:underline">
                      我的筆記本
                    </Link>
                  </div>
                </div>
              </div>
            </nav>
            <main className="min-h-screen">{children}</main>
            <footer className="border-t border-gray-200 py-8 mt-16">
              <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-600">
                <p>台灣女性主義與公益實務課程 · 24週自學計劃</p>
              </div>
            </footer>
          </AuthWrapper>
        </Suspense>
      </body>
    </html>
  );
}
