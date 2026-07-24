import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ManagePage from "@/app/manage/page";

describe("ManagePage", () => {
  it("renders the manage subscription form", () => {
    render(<ManagePage />);
    expect(screen.getByRole("heading", { name: /manage your subscription/i })).toBeInTheDocument();
  });
});
