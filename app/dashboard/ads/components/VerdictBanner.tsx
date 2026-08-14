import type { CohortAggregates, DerivedEconomics } from "@/lib/ads/economics";
import { deriveEconomics, type AdsFacts } from "@/lib/ads/economics";
import type { AdsAssumptions } from "@/lib/ads/config";

const VERDICT_LABEL: Record<DerivedEconomics["verdict"], string> = {
  working: "Working",
  ambiguous: "Ambiguous",
  broken: "Broken",
};

const VERDICT_BAR_CLASS: Record<DerivedEconomics["verdict"], string> = {
  working: "bg-emerald-500",
  ambiguous: "bg-amber-500",
  broken: "bg-red-500",
};

const VERDICT_TEXT_CLASS: Record<DerivedEconomics["verdict"], string> = {
  working: "text-emerald-500",
  ambiguous: "text-amber-500",
  broken: "text-red-500",
};

function fmtGbp(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}£${Math.abs(n).toFixed(2)}`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Builds the current assumptions from an economics result's implied inputs is
 * not possible (economics does not carry the assumptions object back), so the
 * sensitivity line takes the current assumptions directly rather than trying
 * to reverse-engineer them from `economics`.
 */
export default function VerdictBanner({
  economics,
  cohort,
  modeling,
  assumptions,
  facts,
}: {
  economics: DerivedEconomics;
  cohort: CohortAggregates;
  modeling: boolean;
  /** Current assumptions, used to compute the live sensitivity line. */
  assumptions?: AdsAssumptions;
  /** Current facts, used to compute the live sensitivity line. */
  facts?: AdsFacts;
}) {
  const verdict = economics.verdict;

  const rateSource = economics.trialToPaidSource === "observed" ? "observed" : "assumed";
  const evidenceSentence = `${VERDICT_LABEL[verdict]}: CPA ${
    economics.cpaGbp != null ? fmtGbp(economics.cpaGbp) : "n/a"
  } vs break-even ${fmtGbp(economics.breakEvenCpaGbp)}, from ${cohort.decided} decided trials (${cohort.payers} paid, ${cohort.canceled} canceled) using the ${rateSource} trial-to-paid rate of ${pct(economics.trialToPaid)}.`;

  let sensitivityLine: string | null = null;
  if (assumptions && facts) {
    const at = (rate: number) =>
      deriveEconomics(facts, { ...assumptions, assumedTrialCancelRate: rate }).breakEvenCpaGbp;
    sensitivityLine = `Sensitivity: at 60% cancels break-even is ~${fmtGbp(at(0.6))}, at 50% ~${fmtGbp(at(0.5))}, at 40% ~${fmtGbp(at(0.4))}.`;
  }

  return (
    <div className="flex overflow-hidden rounded-xl border border-brand-border bg-brand-bg-card">
      <div className={`w-1.5 shrink-0 ${VERDICT_BAR_CLASS[verdict]}`} aria-hidden="true" />
      <div className="flex-1 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-lg font-bold ${VERDICT_TEXT_CLASS[verdict]}`}>
            {VERDICT_LABEL[verdict]}
          </span>
          {modeling ? (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-500">
              MODELING
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-brand-text">{evidenceSentence}</p>
        {economics.learningPhase ? (
          <p className="mt-2 text-sm text-amber-500">
            Learning phase: fewer than 50 trials in the last 7 days, so Meta&apos;s delivery
            algorithm has not stabilized and this verdict may shift as more data comes in.
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-snug text-brand-text-secondary">
          A trial is &quot;decided&quot; once it has either converted to a paid subscription or
          canceled; pending trials are not counted either way. Meta restates ad numbers for up to
          72 hours after they are first reported, so the most recent 2-3 days of spend and clicks
          here can still move. {sensitivityLine}
        </p>
      </div>
    </div>
  );
}
