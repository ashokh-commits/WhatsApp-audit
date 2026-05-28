import type { Metadata } from "next";
import "./globals.css";
import MobileBottomNav from "@/components/layout/MobileBottomNav";

export const metadata: Metadata = {
  title: "G6 WhatsApp Audit",
  description: "WhatsApp Business Audit System by G6 Labs Asia",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <MobileBottomNav />
      </body>
    </html>
  );
}
