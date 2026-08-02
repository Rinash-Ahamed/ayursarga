import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ayursarga - Find Ayurvedic Hospitals and Request Appointments",
  description: "Discover active Ayurvedic hospitals in Kerala, compare their services and request appointments through Ayursarga.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F9F5EA" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  </head><body className="loading">{children}</body></html>;
}
