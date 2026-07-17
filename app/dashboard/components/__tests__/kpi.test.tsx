import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import KpiTile from "@/app/dashboard/components/KpiTile";

describe("KpiTile", () => {
  it("renders label and value", () => {
    render(<KpiTile label="Downloads" value="1,234" />);
    expect(screen.getByText("Downloads")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });
});
