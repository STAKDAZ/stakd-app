import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STAKD Operations",
  description: "STAKD estimating, project management, and production tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
