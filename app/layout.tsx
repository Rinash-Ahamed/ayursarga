import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ayursarga - Find Your Ayurvedic Recovery Retreat in Kerala",
  description: "Find verified Ayurvedic retreats in Kerala for prenatal and postnatal care, Panchakarma, stress relief, women’s wellness and more.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F9F5EA" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  </head><body className="loading">{children}</body></html>;
}
