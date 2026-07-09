import type { Metadata } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_Georgian({
  subsets: ["georgian", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "VenueOS — ივენთ ჰოლის მართვა",
  description: "ივენთ ჰოლის სრული ბიზნეს-მართვის სისტემა",
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
      </body>
    </html>
  );
}
