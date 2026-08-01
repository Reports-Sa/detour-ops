import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DetourOps",
  description: "From project need to normal traffic.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
