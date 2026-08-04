import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  DM_Mono,
  Fira_Code,
  Newsreader,
} from "next/font/google";

import { themeScript } from "@/lib/theme";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BIT Flux",
  description: "Write it down now. Sort it out later.",
  icons: {
    icon: "/wind.svg",
  },
};

/**
 * `viewportFit: "cover"` is what makes `env(safe-area-inset-*)` return real
 * numbers — without it the phone reports zero and the sill sits under the home
 * indicator.
 *
 * Zoom is deliberately left alone. Pinch is how someone reads a screen they
 * can't quite see, and the usual reason to disable it — Safari zooming on
 * focus — is fixed at the source in globals.css by putting a 16px floor under
 * every field.
 *
 * themeColor is the two paper stocks the default palette prints on, so the
 * browser chrome above the window matches the page behind it.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ece8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#14121a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${newsreader.variable} ${dmMono.variable} ${firaCode.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
