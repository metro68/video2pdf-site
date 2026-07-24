type SourceStatus = "ok" | "awaiting_credentials" | "error";

const STATUS_LABEL: Record<SourceStatus, string> = {
  ok: "up to date",
  awaiting_credentials: "not connected",
  error: "error",
};

const STATUS_DOT_CLASS: Record<SourceStatus, string> = {
  ok: "bg-green-500",
  awaiting_credentials: "bg-gray-400",
  error: "bg-red-500",
};

export default function FreshnessLine({
  asOf,
  source,
  status,
}: {
  asOf: string | null;
  source: string;
  status?: SourceStatus;
}) {
  const when = asOf ? new Date(asOf).toLocaleString() : "no data yet";
  return (
    <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
      {status ? (
        <span
          aria-hidden="true"
          className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[status]}`}
        />
      ) : null}
      <span>
        as of {when} · {source}
        {status ? <> · {STATUS_LABEL[status]}</> : null}
      </span>
    </div>
  );
}
