import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { TopNav } from "@/components/layout/TopNav";
import { BottomBar } from "@/components/layout/BottomBar";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `${APP_NAME} — terminal anti-larp`,
  description: "Terminal de trading Solana rapide, non-custodial, à frais réduits, avec scoring anti-LARP des développeurs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="h-full">
        <Providers>
          <div className="grid h-screen grid-rows-[48px_1fr_30px]">
            <TopNav />
            <main className="min-h-0">{children}</main>
            <BottomBar />
          </div>
        </Providers>
      </body>
    </html>
  );
}
