import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VerdictBanner from "@/app/dashboard/ads/components/VerdictBanner";
import AssumptionsPanel from "@/app/dashboard/ads/components/AssumptionsPanel";
import DeductionsPanel from "@/app/dashboard/ads/components/DeductionsPanel";
import CohortChart from "@/app/dashboard/ads/components/CohortChart";
import AdsEvalClient from "@/app/dashboard/ads/components/AdsEvalClient";
import { ADS_ASSUMPTIONS } from "@/lib/ads/config";
import { deriveEconomics } from "@/lib/ads/economics";
import { assemblePayload } from "@/lib/ads/assemble";
import type { TrialCohort } from "@/lib/connectors/stripe";

const COHORT = { trials: 20, decided: 15, payers: 8, canceled: 7, pastDue: 0, pending: 5, collectedUsd: 239.92 };
const FACTS = { spendGbp: 200, stripeTrials: 20, trialsLast7: 12, cohort: COHORT };

describe("VerdictBanner", () => {
  it("shows verdict, evidence numbers, and learning caveat", () => {
    const econ = deriveEconomics(FACTS, ADS_ASSUMPTIONS);
    render(<VerdictBanner economics={econ} cohort={COHORT} modeling={false} />);
    expect(screen.getByText(/decided trials/i)).toBeTruthy();
    expect(screen.getByText(/learning phase/i)).toBeTruthy();
  });

  it("shows MODELING chip when modeling", () => {
    const econ = deriveEconomics(FACTS, { ...ADS_ASSUMPTIONS, assumedTrialCancelRate: 0.6 });
    render(<VerdictBanner economics={econ} cohort={COHORT} modeling={true} />);
    expect(screen.getByText("MODELING")).toBeTruthy();
  });
});

describe("AssumptionsPanel", () => {
  it("inputs are disabled until Edit is clicked, and Reset restores defaults", () => {
    const onChange = vi.fn();
    render(
      <AssumptionsPanel value={ADS_ASSUMPTIONS} defaults={ADS_ASSUMPTIONS} observedCancelRate={8 / 15} observedN={15} onChange={onChange} />,
    );
    const price = screen.getByLabelText(/price/i) as HTMLInputElement;
    expect(price.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /edit assumptions/i }));
    expect((screen.getByLabelText(/price/i) as HTMLInputElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: "39.99" } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.lastCall![0].annualPriceUsd).toBeCloseTo(39.99);
  });

  it("shows the observed cancel rate helper, not the paid rate", () => {
    // 15 decided, 7 paid -> 8 canceled -> cancel rate is 8/15 (~53%), not 7/15 (~47%).
    render(
      <AssumptionsPanel value={ADS_ASSUMPTIONS} defaults={ADS_ASSUMPTIONS} observedCancelRate={8 / 15} observedN={15} onChange={() => {}} />,
    );
    const helper = screen.getByText(/observed cancel rate/i).textContent ?? "";
    expect(helper).toContain("n=15");
    expect(helper).toContain("53%");
    expect(helper).not.toContain("47%");
  });
});

describe("CohortChart", () => {
  const DAILY = [
    { date: "2026-08-01", spendGbp: 10, stripeTrials: 2, collectedUsd: 0 },
    { date: "2026-08-02", spendGbp: 12, stripeTrials: 3, collectedUsd: 50 },
  ];

  it("shows the MODELING chip when modeling", () => {
    const econ = deriveEconomics(FACTS, ADS_ASSUMPTIONS);
    render(<CohortChart daily={DAILY} economics={econ} gbpPerUsd={0.77} modeling={true} />);
    expect(screen.getByText("MODELING")).toBeTruthy();
  });

  it("does not show the MODELING chip when not modeling", () => {
    const econ = deriveEconomics(FACTS, ADS_ASSUMPTIONS);
    render(<CohortChart daily={DAILY} economics={econ} gbpPerUsd={0.77} modeling={false} />);
    expect(screen.queryByText("MODELING")).toBeNull();
  });
});

describe("AdsEvalClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an error state with a Retry button when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(<AdsEvalClient />);
    await waitFor(() => {
      expect(screen.getByText(/could not load ads data/i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("prints the observed CANCEL rate next to the input, not the paid rate", async () => {
    // 15 decided, 6 paid -> observed trial-to-paid is 6/15 = 40%, so the
    // observed CANCEL rate must read 60%, never 40%.
    const cohort: TrialCohort = {
      trials: [],
      aggregates: { trials: 20, decided: 15, payers: 6, canceled: 9, pastDue: 0, pending: 5, collectedUsd: 179.94 },
      dailyTrials: [{ date: "2026-08-12", count: 20 }],
    };
    const payload = assemblePayload({
      adRows: [],
      cohort,
      windowDays: 14,
      now: new Date("2026-08-14T12:00:00Z"),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) }),
    );
    render(<AdsEvalClient />);
    await waitFor(() => {
      expect(screen.getByText(/observed cancel rate/i)).toBeTruthy();
    });
    const helper = screen.getByText(/observed cancel rate/i).textContent ?? "";
    expect(helper).toContain("60%");
    expect(helper).not.toContain("40%");
  });
});

describe("DeductionsPanel", () => {
  it("renders empty state when no deductions", () => {
    render(<DeductionsPanel deductions={[]} modeling={false} />);
    expect(screen.getByText(/within normal ranges/i)).toBeTruthy();
  });

  it("renders evidence and hypothesis per card", () => {
    render(
      <DeductionsPanel modeling={false} deductions={[{
        id: "change-creative", severity: "act", adId: "9",
        title: "Swap creative", evidence: "18 spent", rationale: "because", hypothesis: "it improves",
      }]} />,
    );
    expect(screen.getByText("Swap creative")).toBeTruthy();
    expect(screen.getByText(/because/)).toBeTruthy();
  });
});
