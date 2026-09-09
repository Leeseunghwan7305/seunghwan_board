import type { Metadata } from "next";
import { IBM_Plex_Sans_KR, IBM_Plex_Mono } from "next/font/google";
import Header from "@/components/Header";
import "./globals.css";

const plexSansDisplay = IBM_Plex_Sans_KR({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const plexSansBody = IBM_Plex_Sans_KR({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "✦ PDF AI — 문서에게 물어보세요",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={`${plexSansDisplay.variable} ${plexSansBody.variable} ${ibmPlexMono.variable}`}
    >
      <body className={`${plexSansBody.className} min-h-screen antialiased`}>
        <Header />
        <main id="top" className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
