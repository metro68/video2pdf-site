import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import HomePage from "@/app/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

describe("public pages", () => {
  it("landing shows the hero headline", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: /searchable pdf/i })).toBeInTheDocument();
  });
  it("privacy shows a privacy heading", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: /privacy policy/i })).toBeInTheDocument();
  });
  it("terms shows a terms heading", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1, name: /terms of service/i })).toBeInTheDocument();
  });
});
