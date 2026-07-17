export default function AwaitingCard({ provider }: { provider: string }) {
  return (
    <div className="rounded-xl bg-brand-bg-card border border-dashed border-brand-border p-4">
      <div className="text-sm font-semibold text-brand-text">Connect {provider}</div>
      <div className="mt-1 text-xs text-brand-text-secondary">Awaiting credentials</div>
    </div>
  );
}
