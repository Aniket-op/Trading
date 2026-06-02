export function formatCurrency(val: number | null | undefined, precision = 2): string {
  if (val === null || val === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(val);
}

export function formatNumber(val: number | null | undefined, precision = 2): string {
  if (val === null || val === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(val);
}

export function formatCompactNumber(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(val);
}

export function formatPercent(val: number | null | undefined, precision = 4): string {
  if (val === null || val === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(val);
}

export function formatTime(timestamp: string | null | undefined): string {
  if (!timestamp) return "-";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export function formatDate(timestamp: string | null | undefined): string {
  if (!timestamp) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}
