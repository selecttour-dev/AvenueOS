import type { Metadata, Viewport } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";

const noto = Noto_Sans_Georgian({
  subsets: ["georgian", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-noto",
});

export const metadata: Metadata = {
  applicationName: "AvenueOS",
  title: "AvenueOS — ივენთ ჰოლის მართვა",
  description: "ივენთ ჰოლის სრული ბიზნეს-მართვის სისტემა",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AvenueOS",
  },
  icons: {
    icon: "/icons/favicon-32.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2d4a36",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ka" className={noto.variable}>
      <body style={{ fontFamily: "var(--font-noto), system-ui, sans-serif" }}>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
