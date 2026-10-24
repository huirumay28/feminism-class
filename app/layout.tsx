import type { Metadata } from "next";
import { Noto_Serif_TC, IBM_Plex_Mono, LXGW_WenKai_TC } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const serif = Noto_Serif_TC({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-serif", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono", display: "swap" });
const hand = LXGW_WenKai_TC({ subsets: ["latin"], weight: ["400"], variable: "--font-hand", display: "swap" });

export const metadata: Metadata = {
  title: "台灣女性主義與公益實務 · Study Notebook",
  description: "24 週自學課程筆記本",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW" className={`${serif.variable} ${mono.variable} ${hand.variable}`}>
      <body>
        <header className="topbar">
          <Link href="/" className="logo" aria-label="首頁">♀</Link>
          <div className="band">
            <Link href="/">台灣女性主義與公益實務<span className="band-en"> — STUDY NOTEBOOK</span></Link>
          </div>
          <nav>
            <Link href="/">目錄</Link>
            <Link href="/notebook">我的筆記</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
