export function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "k";
  return n.toLocaleString();
}

export function fmtGbp(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `£${(n / 1_000).toFixed(0)}k`;
  return `£${n.toFixed(0)}`;
}

export function fmtKb(kb: number): string {
  if (kb >= 1024) return (kb / 1024).toFixed(1) + " MB";
  return kb.toFixed(0) + " KB";
}

export function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function ragClass(rag: "RED" | "AMBER" | "GREEN" | string): string {
  if (rag === "RED") return "bg-rag-red/15 text-rag-red border-rag-red/40";
  if (rag === "AMBER") return "bg-rag-amber/15 text-rag-amber border-rag-amber/40";
  if (rag === "GREEN") return "bg-rag-green/15 text-rag-green border-rag-green/40";
  return "bg-ink-100 text-ink-600 border-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:border-ink-700";
}
