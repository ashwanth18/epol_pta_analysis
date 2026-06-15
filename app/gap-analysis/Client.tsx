"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Pill } from "@/components/ui";
import type { GapKpi } from "@/lib/data";
import { fmtGbp } from "@/lib/format";

export function GapClient({ kpis }: { kpis: GapKpi[] }) {
  const [rag, setRag] = useState<"ALL" | "RED" | "AMBER" | "GREEN">("ALL");
  const [section, setSection] = useState("ALL");
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const s = new Set(kpis.map((k) => k.section));
    return ["ALL", ...Array.from(s).sort()];
  }, [kpis]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return kpis.filter((k) => {
      if (rag !== "ALL" && k.rag !== rag) return false;
      if (section !== "ALL" && k.section !== section) return false;
      if (q) {
        return (
          k.control.toUpperCase().includes(q) ||
          k.kpi.toUpperCase().includes(q) ||
          k.evidence.toUpperCase().includes(q) ||
          k.section.toUpperCase().includes(q) ||
          (k.source || "").toUpperCase().includes(q)
        );
      }
      return true;
    });
  }, [kpis, rag, section, query]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 w-full">
          <div className="flex items-center gap-3 w-full flex-wrap">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search KPI, evidence, or DBF source…"
              className="flex-1 min-w-[200px] text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
            />
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
            >
              {sections.map((s) => (
                <option key={s} value={s}>{s === "ALL" ? "All sections" : s.replace(/^\d+\.\s*/, "")}</option>
              ))}
            </select>
            <span className="text-xs text-ink-500 tabular-nums">{filtered.length} of {kpis.length}</span>
          </div>
          <div className="flex gap-1">
            {(["ALL", "RED", "AMBER", "GREEN"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRag(r)}
                className={[
                  "text-xs px-3 py-1 rounded-md border",
                  rag === r
                    ? r === "RED"
                      ? "bg-rag-red/15 text-rag-red border-rag-red/40"
                      : r === "AMBER"
                      ? "bg-rag-amber/15 text-rag-amber border-rag-amber/40"
                      : r === "GREEN"
                      ? "bg-rag-green/15 text-rag-green border-rag-green/40"
                      : "bg-accent-50 text-accent border-accent/30"
                    : "border-ink-200 dark:border-ink-700 text-ink-500",
                ].join(" ")}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Section</th>
                <th className="px-4 py-2 font-medium">Control / KPI</th>
                <th className="px-4 py-2 font-medium">Evidence (from DBF data)</th>
                <th className="px-4 py-2 font-medium text-center">Score</th>
                <th className="px-4 py-2 font-medium text-center">RAG</th>
                <th className="px-4 py-2 font-medium text-right">£/yr</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((k, i) => (
                <tr key={i} className="border-b border-ink-100 dark:border-ink-800 align-top">
                  <td className="px-4 py-2 text-ink-500 text-[11px]">{k.section.replace(/^\d+\.\s*/, "")}</td>
                  <td className="px-4 py-2">
                    <div className="font-semibold">{k.control}</div>
                    <div className="text-[11px] text-ink-500">{k.kpi}</div>
                  </td>
                  <td className="px-4 py-2 text-ink-600 dark:text-ink-300 max-w-md">
                    {k.evidence}
                    <div className="text-[11px] text-ink-500 mt-1 font-mono">Source: {k.source}</div>
                  </td>
                  <td className="px-4 py-2 text-center font-semibold tabular-nums">{k.score}</td>
                  <td className="px-4 py-2 text-center">
                    <Pill tone={k.rag === "RED" ? "red" : k.rag === "AMBER" ? "amber" : "green"}>{k.rag}</Pill>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{k.gap_gbp ? fmtGbp(k.gap_gbp) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
