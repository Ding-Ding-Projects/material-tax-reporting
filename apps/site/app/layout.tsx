import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Material Tax Reporting — Paper-return documentation",
  description:
    "Public documentation for a planned local-first Canada and Ontario paper tax package workflow.",
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
