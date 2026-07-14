export default function KpiTile({
  label,
  value,
  freshness,
}: {
  label: string;
  value: string;
  freshness?: string;
}) {
  return (
    <div className="rounded-xl bg-brand-bg-card border border-brand-border p-4">
      <div className="text-sm text-brand-text-secondary">{label}</div>
      <div className="mt-1 text-2xl font-bold text-brand-text">{value}</div>
      {freshness ? <div className="mt-2 text-xs text-brand-text-secondary">{freshness}</div> : null}
    </div>
  );
}
