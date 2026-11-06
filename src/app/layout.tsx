import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/common/AppShell";

export const metadata: Metadata = {
  title: "Legends Lab",
  description: "NBA 82-0 Challenge + Football Ultimate Draft & Season Simulator. Proyecto personal.",
};
export const viewport: Viewport = { themeColor: "#06070a", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap"
        />
      </head>
      <body className="grain">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
