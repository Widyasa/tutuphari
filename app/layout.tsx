import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-plex",
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
  themeColor: "#14643f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-dvh bg-background text-foreground">{children}</body>
    </html>
  );
}
