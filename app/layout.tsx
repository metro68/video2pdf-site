import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video2PDF: Film Any Book, Get a Searchable PDF",
  description:
    "Film any textbook, note, or handout and get a searchable, shareable PDF in seconds. Meet Bindy, your bookworm guide.",
  icons: { icon: "/assets/icon.png", apple: "/assets/icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
