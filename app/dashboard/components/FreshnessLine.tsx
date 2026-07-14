export default function FreshnessLine({ asOf, source }: { asOf: string | null; source: string }) {
  const when = asOf ? new Date(asOf).toLocaleString() : "no data yet";
  return (
    <div className="text-xs text-brand-text-secondary">
      as of {when} · {source}
    </div>
  );
}
