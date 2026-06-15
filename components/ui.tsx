import { ReactNode } from "react";

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between border-b border-ink-200 dark:border-ink-800 pb-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-500 mt-1 max-w-3xl">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({
  value,
  label,
  tone,
  hint,
}: {
  value: ReactNode;
  label: string;
  tone?: "red" | "amber" | "green" | "info";
  hint?: string;
}) {
  const toneClass =
    tone === "red"
      ? "text-rag-red"
      : tone === "amber"
      ? "text-rag-amber"
      : tone === "green"
      ? "text-rag-green"
      : tone === "info"
      ? "text-accent"
      : "text-ink-900 dark:text-ink-100";
  return (
    <div className="rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4">
      <div className={["text-2xl font-semibold tabular-nums", toneClass].join(" ")}>{value}</div>
      <div className="text-[11px] text-ink-500 uppercase tracking-wide mt-1">{label}</div>
      {hint && <div className="text-[11px] text-ink-400 mt-1">{hint}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={["rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900", className].join(" ")}>
      {children}
    </div>
  );
}

export function CardHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-ink-200 dark:border-ink-800">
      <div className="text-sm font-medium">{children}</div>
      {right}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={["p-4", className].join(" ")}>{children}</div>;
}

export function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "info" | "red" | "amber" | "green";
  className?: string;
}) {
  const cls =
    tone === "red"
      ? "bg-rag-red/15 text-rag-red border-rag-red/40"
      : tone === "amber"
      ? "bg-rag-amber/15 text-rag-amber border-rag-amber/40"
      : tone === "green"
      ? "bg-rag-green/15 text-rag-green border-rag-green/40"
      : tone === "info"
      ? "bg-accent-50 text-accent border-accent/30 dark:bg-accent/15"
      : "bg-ink-100 text-ink-700 border-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:border-ink-700";
  return (
    <span className={["inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", cls, className].join(" ")}>
      {children}
    </span>
  );
}

export function Callout({
  title,
  tone = "info",
  children,
}: {
  title: string;
  tone?: "info" | "red" | "amber" | "green";
  children: ReactNode;
}) {
  const cls =
    tone === "red"
      ? "border-rag-red/40 bg-rag-red/5"
      : tone === "amber"
      ? "border-rag-amber/40 bg-rag-amber/5"
      : tone === "green"
      ? "border-rag-green/40 bg-rag-green/5"
      : "border-accent/30 bg-accent-50 dark:bg-accent/10";
  return (
    <div className={["rounded-lg border p-4", cls].join(" ")}>
      <div className="text-sm font-semibold mb-1">{title}</div>
      <div className="text-sm text-ink-700 dark:text-ink-300">{children}</div>
    </div>
  );
}
