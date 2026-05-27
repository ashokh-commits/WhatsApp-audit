import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "G6 WhatsApp Audit",
  description: "WhatsApp Business Audit System by G6 Labs Asia",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
