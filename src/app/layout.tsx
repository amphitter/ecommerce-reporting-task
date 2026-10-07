import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexusOps | E-commerce Sales & Inventory Platform",
  description: "Enterprise multi-marketplace analytics, real-time sales and inventory reporting platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-background text-text-primary">
        {children}
      </body>
    </html>
  );
}
