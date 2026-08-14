import type { AdRowFacts } from "@/lib/ads/rules";
import type { Deduction } from "@/lib/ads/rules";

function fmtGbp(n: number | null): string {
  return n == null ? "n/a" : `£${n.toFixed(2)}`;
}

export default function AdTable({
  ads,
  deductions,
  breakEvenCpaGbp,
}: {
  ads: AdRowFacts[];
  deductions: Deduction[];
  breakEvenCpaGbp: number;
}) {
  const swapCandidateAdIds = new Set(
    deductions.filter((d) => d.id === "change-creative" && d.adId).map((d) => d.adId as string),
  );
  const cpaCandidates = ads.filter((a) => a.cpaGbp != null);
  const topPerformerAdId =
    cpaCandidates.length > 0
      ? cpaCandidates.reduce((best, a) => (a.cpaGbp! < best.cpaGbp! ? a : best)).adId
      : null;

  return (
    <div className="rounded-xl bg-brand-bg-card border border-brand-border p-4">
      <div className="mb-3 text-sm font-semibold text-brand-text">Ads in this window</div>
      {ads.length === 0 ? (
        <p className="text-sm text-brand-text-secondary">No ad spend in this window.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-border text-xs text-brand-text-secondary">
                <th className="py-2 pr-3 font-medium">Ad</th>
                <th className="py-2 pr-3 font-medium">Spend</th>
                <th className="py-2 pr-3 font-medium">CTR</th>
                <th className="py-2 pr-3 font-medium">CPC</th>
                <th className="py-2 pr-3 font-medium">Clicks</th>
                <th className="py-2 pr-3 font-medium">Views</th>
                <th className="py-2 pr-3 font-medium">Emails</th>
                <th className="py-2 pr-3 font-medium">Checkouts</th>
                <th className="py-2 pr-3 font-medium">Trials</th>
                <th className="py-2 pr-3 font-medium">CPA</th>
                <th className="py-2 pr-3 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((ad) => {
                const overBreakEven = ad.cpaGbp != null && ad.cpaGbp > breakEvenCpaGbp;
                return (
                  <tr key={ad.adId} className="border-b border-brand-border/50 text-brand-text">
                    <td className="py-2 pr-3">{ad.adName || ad.adId}</td>
                    <td className="py-2 pr-3">£{ad.spendGbp.toFixed(2)}</td>
                    <td className="py-2 pr-3">{ad.ctrPct.toFixed(2)}%</td>
                    <td className="py-2 pr-3">{fmtGbp(ad.cpcGbp)}</td>
                    <td className="py-2 pr-3">{ad.clicks.toLocaleString()}</td>
                    <td className="py-2 pr-3">{ad.contentViews.toLocaleString()}</td>
                    <td className="py-2 pr-3">{ad.emailStepViews.toLocaleString()}</td>
                    <td className="py-2 pr-3">{ad.checkouts.toLocaleString()}</td>
                    <td className="py-2 pr-3">{ad.pixelTrials.toLocaleString()}</td>
                    <td className={`py-2 pr-3 ${overBreakEven ? "text-red-500" : ""}`}>
                      {fmtGbp(ad.cpaGbp)}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {swapCandidateAdIds.has(ad.adId) ? (
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-500">
                            swap candidate
                          </span>
                        ) : null}
                        {topPerformerAdId === ad.adId ? (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-500">
                            top performer
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs leading-snug text-brand-text-secondary">
        Trials in this table come from Meta&apos;s pixel, which attributes by ad click and can
        overcount or undercount versus reality. The verdict and break-even above instead use
        Stripe&apos;s actual trial records, which are the source of truth for whether the funnel is
        working; treat pixel trials here as a per-ad signal for where to look, not as the final
        number.
      </p>
    </div>
  );
}
