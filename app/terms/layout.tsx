import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Video2PDF",
  description:
    "Video2PDF subscription terms: free trial and cancellation policy, billing, and acceptable use.",
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
