import type { Metadata } from "next";
import { Gothic_A1, IBM_Plex_Mono } from "next/font/google";
import Header from "@/components/Header";
import "./globals.css";

const gothicA1Display = Gothic_A1({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["800"],
  display: "swap",
});

const gothicA1Body = Gothic_A1({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "🥕 PDF 물어봐요",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={`${gothicA1Display.variable} ${gothicA1Body.variable} ${ibmPlexMono.variable}`}
    >
      <body className={`${gothicA1Body.className} min-h-screen antialiased`}>
        <Header />
        <main id="top" className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
