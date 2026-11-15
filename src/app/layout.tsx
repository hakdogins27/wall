import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wall · Small updates, shared openly",
  description: "A place for a passing thought, a small discovery, or a little connection.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
