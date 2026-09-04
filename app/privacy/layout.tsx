import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Video2PDF",
  description:
    "How Video2PDF handles your data: cleanup, enhancement, and text recognition run on-device, and your full-resolution videos, page images, and PDFs stay on your phone.",
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
