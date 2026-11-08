import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
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
  appleWebApp: {
    capable: true,
    title: "TutupHari",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F1F5F2",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable} h-full antialiased`} style={{ colorScheme: "light" }}>
      <body className="min-h-dvh bg-background text-foreground">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
