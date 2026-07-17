import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import HomePage from "@/app/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import DeleteAccountPage from "@/app/delete-account/page";

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
  it("delete-account explains data deletion", () => {
    render(<DeleteAccountPage />);
    expect(screen.getByRole("heading", { level: 1, name: /delete your data/i })).toBeInTheDocument();
    expect(screen.getByText(/does not require an account/i)).toBeInTheDocument();
  });
});
