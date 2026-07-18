// Month window resolution for the dashboard's month picker. All dates are UTC
// calendar dates (YYYY-MM-DD strings) so string comparison works everywhere.

export interface MonthWindow {
  /** The resolved month, YYYY-MM. */
  ym: string;
  /** First day of the month, YYYY-MM-DD. */
  from: string;
  /** Last day of the window: month end for past months, yesterday (clamped to
   * the month start) for the current month. */
  to: string;
  /** Whether this is the in-progress month. */
  isCurrent: boolean;
}

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function resolveMonthWindow(month: string | undefined, now = new Date()): MonthWindow {
  const currentYm = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;

  let ym = month && YM_RE.test(month) ? month : currentYm;
  if (ym > currentYm) ym = currentYm;

  const [y, m] = ym.split("-").map(Number);
  const from = `${ym}-01`;
  const isCurrent = ym === currentYm;

  let to: string;
  if (isCurrent) {
    const yesterday = new Date(now.getTime() - 864e5);
    to = `${yesterday.getUTCFullYear()}-${pad(yesterday.getUTCMonth() + 1)}-${pad(yesterday.getUTCDate())}`;
    if (to < from) to = from;
  } else {
    // Day 0 of the next month = last day of this month.
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    to = `${ym}-${pad(lastDay)}`;
  }

  return { ym, from, to, isCurrent };
}

/** List the YYYY-MM-DD dates of a window, oldest first. */
export function windowDates(w: MonthWindow): string[] {
  const dates: string[] = [];
  const start = new Date(`${w.from}T00:00:00Z`).getTime();
  const end = new Date(`${w.to}T00:00:00Z`).getTime();
  for (let t = start; t <= end; t += 864e5) {
    const d = new Date(t);
    dates.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  return dates;
}
