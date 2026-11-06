import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TutupHari — cek kas warung",
  description:
    "Catat kayak kirim pesan. Pas warung tutup, tahu uang laci seharusnya berapa dan selisih mana yang perlu dicek.",
  applicationName: "TutupHari",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F5F5F4",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable} h-full antialiased`} style={{ colorScheme: "light" }}>
      <body className="min-h-dvh bg-background text-foreground">{children}</body>
    </html>
  );
}
