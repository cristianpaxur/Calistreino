import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/Nav";

export const metadata: Metadata = {
  title: "CalisTreino — Front Lever + Planche",
  description: "Controle de treinos de calistenia baseado em dados.",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <div className="relative mx-auto flex h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden bg-bg text-ink md:my-3 md:h-[min(940px,96dvh)] md:rounded-[44px] md:border md:border-white/10 md:shadow-2xl">
          <div className="flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
