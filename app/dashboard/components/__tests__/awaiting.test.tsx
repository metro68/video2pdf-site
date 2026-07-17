import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AwaitingCard from "@/app/dashboard/components/AwaitingCard";

describe("AwaitingCard", () => {
  it("prompts to connect the named provider", () => {
    render(<AwaitingCard provider="TikTok" />);
    expect(screen.getByText(/awaiting credentials/i)).toBeInTheDocument();
    expect(screen.getByText(/TikTok/)).toBeInTheDocument();
  });
});
