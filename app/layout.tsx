import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ayursarga - Find Ayurvedic Hospitals and Request Appointments",
  description: "Discover active Ayurvedic hospitals in Kerala, compare their services and request appointments through Ayursarga.",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "1024x1024" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Ayursarga" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#FFFFFF" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link rel="preload" as="image" href="/hero-video-poster.webp" fetchPriority="high" />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500&family=Manrope:wght@300..800&display=swap" rel="stylesheet" />
  </head><body>
    <Script id="ayursarga-opening-session" strategy="beforeInteractive">{`try{if(sessionStorage.getItem("ayursarga-public-opening-seen")==="true")document.documentElement.dataset.ayursargaOpening="seen"}catch{}`}</Script>
    {children}
  </body></html>;
}
