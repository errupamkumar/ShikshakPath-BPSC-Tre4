import type { Metadata, Viewport } from "next";
import { siteConfig } from "@config/test-series.config";
import { LangProvider } from "@/components/lang-provider";
import { getLang } from "@/lib/lang";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${siteConfig.name} · ${siteConfig.targetExam}`, template: `%s · ${siteConfig.shortName}` },
  description: siteConfig.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffdf9" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
};

// Runs before first paint so dark mode never flashes. Light (Nova cream) is the default.
const themeScript = `(function(){try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Satoshi (Fontshare, free for commercial use), the typeface of the Nova design */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap" />
        {/* Devanagari for हिंदी (Satoshi has no Hindi letters) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&display=swap" />
      </head>
      <body className="min-h-dvh">
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
