export interface KpiSource {
  /** Human label for where the number comes from, e.g. "App Store Connect". */
  name: string;
  /** Link to the source console so a viewer can sanity-check the figure. */
  href: string;
}

export default function KpiTile({
  label,
  value,
  description,
  sources,
  freshness,
}: {
  label: string;
  value: string;
  /** What the number is and how it is computed, incl. caveats. */
  description?: string;
  /** Where the data comes from; each links to that provider's console. */
  sources?: KpiSource[];
  freshness?: string;
}) {
  return (
    <div className="rounded-xl bg-brand-bg-card border border-brand-border p-4">
      <div className="text-sm text-brand-text-secondary">{label}</div>
      <div className="mt-1 text-2xl font-bold text-brand-text">{value}</div>
      {description ? (
        <div className="mt-2 text-xs leading-snug text-brand-text-secondary">{description}</div>
      ) : null}
      {sources && sources.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs">
          <span className="text-brand-text-secondary">Source:</span>
          {sources.map((s, i) => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-primary hover:underline"
            >
              {s.name}
              {i < sources.length - 1 ? "," : ""}
            </a>
          ))}
        </div>
      ) : null}
      {freshness ? <div className="mt-2 text-xs text-brand-text-secondary">{freshness}</div> : null}
    </div>
  );
}
