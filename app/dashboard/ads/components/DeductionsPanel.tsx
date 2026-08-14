import type { Deduction, Severity } from "@/lib/ads/rules";

const SEVERITY_LABEL: Record<Severity, string> = {
  urgent: "Urgent",
  act: "Act",
  info: "Info",
};

const SEVERITY_CLASS: Record<Severity, string> = {
  urgent: "bg-red-500/20 text-red-500",
  act: "bg-amber-500/20 text-amber-500",
  info: "bg-slate-500/20 text-slate-400",
};

export default function DeductionsPanel({
  deductions,
  modeling,
}: {
  deductions: Deduction[];
  modeling: boolean;
}) {
  return (
    <div className="rounded-xl bg-brand-bg-card border border-brand-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold text-brand-text">Deductions</div>
        {modeling ? (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-500">
            MODELING
          </span>
        ) : null}
      </div>

      {deductions.length === 0 ? (
        <p className="mt-2 text-sm text-brand-text-secondary">
          No deductions: current data is within normal ranges.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {deductions.map((d) => (
            <div key={d.id + (d.adId ?? "")} className="rounded-lg border border-brand-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_CLASS[d.severity]}`}
                >
                  {SEVERITY_LABEL[d.severity]}
                </span>
                <span className="text-sm font-semibold text-brand-text">{d.title}</span>
              </div>
              <p className="mt-1 text-xs text-brand-text-secondary">
                <span className="font-medium text-brand-text-secondary">Evidence:</span> {d.evidence}
              </p>
              <p className="mt-1 text-xs text-brand-text-secondary">{d.rationale}</p>
              <p className="mt-1 text-xs italic text-brand-text-secondary">
                Hypothesis: {d.hypothesis}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs leading-snug text-brand-text-secondary">
        Deductions are computed on the server using the default assumptions, not the assumptions
        you may be modeling with above. Changing assumptions here updates the verdict and KPI
        tiles live but does not re-run these rules; reload the page after a real assumption change
        lands in config to see updated deductions.
      </p>
    </div>
  );
}
