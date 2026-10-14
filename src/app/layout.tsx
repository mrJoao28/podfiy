import type { Metadata, Viewport } from "next";
import { LibraryProvider } from "@/components/provider";
import { PlayerProvider } from "@/components/player";
import { Shell } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: "Podfiy — seu tempo, suas histórias",
  description: "Seu cantinho para ouvir, descobrir e acompanhar podcasts.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Podfiy",
  },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = {
  themeColor: "#0B0D12",
  width: "device-width",
  initialScale: 1,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <LibraryProvider>
          <PlayerProvider>
            <Shell>{children}</Shell>
          </PlayerProvider>
        </LibraryProvider>
      </body>
    </html>
  );
}
