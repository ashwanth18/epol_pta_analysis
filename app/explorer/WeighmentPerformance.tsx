"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { Callout, Card, CardBody, CardHeader, Pill, Stat } from "@/components/ui";
import type { WeighmentAnalytics, WeighMode } from "@/lib/data";

type ModeFilter = "all" | WeighMode;
type ViewTab = "ingredients" | "weighers" | "links";

const MODE_LABELS: Record<WeighMode, string> = {
  auto: "Macro / bulk",
  hand: "Micro / additive",
};

function modePill(mode: WeighMode) {
  return mode === "hand" ? <Pill tone="amber">Micro / additive</Pill> : <Pill tone="info">Macro / bulk</Pill>;
}

function tolCell(pct: number) {
  const cls = pct >= 95 ? "text-rag-green" : pct >= 80 ? "text-rag-amber" : "text-rag-red font-semibold";
  return <span className={cls}>{pct.toFixed(1)}%</span>;
}

export function WeighmentPerformance({ data }: { data: WeighmentAnalytics }) {
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [view, setView] = useState<ViewTab>("ingredients");

  const filteredSummary = useMemo(() => {
    if (modeFilter === "all") {
      return {
        weighs: data.summary.weighments_scored,
        in_tol_pct:
          data.summary.weighments_scored > 0
            ? ((data.summary.auto?.weighs ?? 0) * (data.summary.auto?.in_tol_pct ?? 0) +
                (data.summary.hand?.weighs ?? 0) * (data.summary.hand?.in_tol_pct ?? 0)) /
              data.summary.weighments_scored
            : 0,
        avg_abs_var:
          data.summary.weighments_scored > 0
            ? ((data.summary.auto?.weighs ?? 0) * (data.summary.auto?.avg_abs_var ?? 0) +
                (data.summary.hand?.weighs ?? 0) * (data.summary.hand?.avg_abs_var ?? 0)) /
              data.summary.weighments_scored
            : 0,
        materials: new Set(data.ingredients.map((i) => i.mat_code)).size,
        weighers: data.weighers.length,
      };
    }
    const block = modeFilter === "hand" ? data.summary.hand : data.summary.auto;
    return {
      weighs: block?.weighs ?? 0,
      in_tol_pct: block?.in_tol_pct ?? 0,
      avg_abs_var: block?.avg_abs_var ?? 0,
      materials: block?.materials ?? 0,
      weighers: block?.weighers?.length ?? 0,
    };
  }, [data, modeFilter]);

  const ingredients = useMemo(
    () => (modeFilter === "all" ? data.ingredients : data.ingredients.filter((r) => r.weigh_mode === modeFilter)),
    [data.ingredients, modeFilter],
  );
  const weighers = useMemo(
    () => (modeFilter === "all" ? data.weighers : data.weighers.filter((r) => r.weigh_mode === modeFilter)),
    [data.weighers, modeFilter],
  );
  const links = useMemo(
    () => (modeFilter === "all" ? data.links : data.links.filter((r) => r.weigh_mode === modeFilter)),
    [data.links, modeFilter],
  );

  const windowLabel =
    data.window_from && data.window_to ? `${data.window_from} → ${data.window_to}` : "production batch window";

  return (
    <div className="space-y-4">
      <Callout title="Macro (bulk) vs micro (additive) weighments" tone="info">
        {data.definition} Micro/additive scales:{" "}
        <span className="font-mono">{data.hand_weighers.join(", ") || "none"}</span>. Window: {windowLabel} ·{" "}
        {data.summary.batches_with_hand_drops} of {data.summary.batches_in_window} batches include at least one micro/additive drop.
      </Callout>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat value={filteredSummary.weighs.toLocaleString()} label="Weighments" />
        <Stat
          value={`${filteredSummary.in_tol_pct.toFixed(1)}%`}
          label="In tolerance"
          tone={filteredSummary.in_tol_pct >= 95 ? "green" : filteredSummary.in_tol_pct >= 80 ? "amber" : "red"}
        />
        <Stat value={`${filteredSummary.avg_abs_var.toFixed(2)}%`} label="Avg |variance|" />
        <Stat value={filteredSummary.materials.toString()} label="Materials" tone="info" />
      </div>

      <Card>
        <CardHeader
          right={
            <div className="flex flex-wrap gap-1">
              {(["all", "auto", "hand"] as ModeFilter[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModeFilter(m)}
                  className={[
                    "text-[11px] px-2 py-0.5 rounded border",
                    modeFilter === m ? "bg-accent-50 text-accent border-accent/30" : "border-ink-200 dark:border-ink-700 text-ink-500",
                  ].join(" ")}
                >
                  {m === "all" ? "All" : MODE_LABELS[m]}
                </button>
              ))}
            </div>
          }
        >
          Weighment performance
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["ingredients", `By ingredient (${ingredients.length})`],
                ["weighers", `By weigher (${weighers.length})`],
                ["links", `Weigher × material (${links.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={[
                  "text-xs px-3 py-1.5 rounded-md border",
                  view === id
                    ? "bg-accent-50 text-accent border-accent/30 dark:bg-accent/10"
                    : "border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "ingredients" && (
            <DataTable
              rows={ingredients}
              rowKey={(r) => `${r.mat_code}-${r.weigh_mode}`}
              searchPlaceholder="Search material code or name…"
              searchText={(r) => `${r.mat_code} ${r.mat_name} ${r.primary_weigher}`}
              defaultSort={{ id: "weighs", dir: "desc" }}
              pageSize={15}
              columns={[
                { id: "mode", header: "Mode", sortValue: (r) => r.weigh_mode, cell: (r) => modePill(r.weigh_mode) },
                { id: "mat_code", header: "Code", sortValue: (r) => r.mat_code, cell: (r) => <span className="font-mono text-xs font-semibold">{r.mat_code}</span> },
                { id: "mat_name", header: "Material", sortValue: (r) => r.mat_name, cell: (r) => <span className="truncate max-w-[180px] block">{r.mat_name || "—"}</span> },
                { id: "primary_weigher", header: "Weigher", sortValue: (r) => r.primary_weigher, cell: (r) => <span className="font-mono text-xs">{r.primary_weigher}</span> },
                { id: "weighs", header: "Weighs", align: "right", sortValue: (r) => r.weighs, cell: (r) => r.weighs.toLocaleString() },
                { id: "batches", header: "Batches", align: "right", sortValue: (r) => r.batches, cell: (r) => r.batches.toLocaleString() },
                { id: "total_kg", header: "Total kg", align: "right", sortValue: (r) => r.total_kg, cell: (r) => r.total_kg.toLocaleString() },
                { id: "in_tol_pct", header: "In tol", align: "right", sortValue: (r) => r.in_tol_pct, cell: (r) => tolCell(r.in_tol_pct) },
                { id: "avg_abs_var", header: "|Var| %", align: "right", sortValue: (r) => r.avg_abs_var, cell: (r) => r.avg_abs_var.toFixed(2) },
                { id: "avg_bias", header: "Bias %", align: "right", sortValue: (r) => r.avg_bias, cell: (r) => `${r.avg_bias >= 0 ? "+" : ""}${r.avg_bias.toFixed(2)}` },
              ]}
            />
          )}

          {view === "weighers" && (
            <DataTable
              rows={weighers}
              rowKey={(r) => r.weigher}
              searchPlaceholder="Search weigher…"
              searchText={(r) => `${r.weigher} ${r.top_materials.map((m) => m.code).join(" ")}`}
              defaultSort={{ id: "weighs", dir: "desc" }}
              pageSize={12}
              columns={[
                { id: "mode", header: "Mode", sortValue: (r) => r.weigh_mode, cell: (r) => modePill(r.weigh_mode) },
                { id: "weigher", header: "Weigher", sortValue: (r) => r.weigher, cell: (r) => <span className="font-mono text-xs font-semibold">{r.weigher}</span> },
                { id: "weighs", header: "Weighs", align: "right", sortValue: (r) => r.weighs, cell: (r) => r.weighs.toLocaleString() },
                { id: "materials", header: "Materials", align: "right", sortValue: (r) => r.materials, cell: (r) => r.materials },
                { id: "batches", header: "Batches", align: "right", sortValue: (r) => r.batches, cell: (r) => r.batches.toLocaleString() },
                { id: "total_kg", header: "Total kg", align: "right", sortValue: (r) => r.total_kg, cell: (r) => r.total_kg.toLocaleString() },
                { id: "in_tol_pct", header: "In tol", align: "right", sortValue: (r) => r.in_tol_pct, cell: (r) => tolCell(r.in_tol_pct) },
                { id: "avg_abs_var", header: "|Var| %", align: "right", sortValue: (r) => r.avg_abs_var, cell: (r) => r.avg_abs_var.toFixed(2) },
                {
                  id: "top",
                  header: "Top materials",
                  sortValue: (r) => r.top_materials[0]?.code ?? "",
                  cell: (r) => (
                    <span className="font-mono text-[11px] text-ink-500">
                      {r.top_materials.map((m) => m.code).join(", ") || "—"}
                    </span>
                  ),
                },
              ]}
            />
          )}

          {view === "links" && (
            <DataTable
              rows={links}
              rowKey={(r) => `${r.weigher}-${r.mat_code}`}
              searchPlaceholder="Search weigher or material…"
              searchText={(r) => `${r.weigher} ${r.mat_code} ${r.mat_name}`}
              defaultSort={{ id: "weighs", dir: "desc" }}
              pageSize={15}
              columns={[
                { id: "mode", header: "Mode", sortValue: (r) => r.weigh_mode, cell: (r) => modePill(r.weigh_mode) },
                { id: "weigher", header: "Weigher", sortValue: (r) => r.weigher, cell: (r) => <span className="font-mono text-xs">{r.weigher}</span> },
                { id: "mat_code", header: "Code", sortValue: (r) => r.mat_code, cell: (r) => <span className="font-mono text-xs font-semibold">{r.mat_code}</span> },
                { id: "mat_name", header: "Material", sortValue: (r) => r.mat_name, cell: (r) => <span className="truncate max-w-[160px] block">{r.mat_name || "—"}</span> },
                { id: "weighs", header: "Weighs", align: "right", sortValue: (r) => r.weighs, cell: (r) => r.weighs.toLocaleString() },
                { id: "batches", header: "Batches", align: "right", sortValue: (r) => r.batches, cell: (r) => r.batches.toLocaleString() },
                { id: "total_kg", header: "Total kg", align: "right", sortValue: (r) => r.total_kg, cell: (r) => r.total_kg.toLocaleString() },
                { id: "in_tol_pct", header: "In tol", align: "right", sortValue: (r) => r.in_tol_pct, cell: (r) => tolCell(r.in_tol_pct) },
                { id: "avg_abs_var", header: "|Var| %", align: "right", sortValue: (r) => r.avg_abs_var, cell: (r) => r.avg_abs_var.toFixed(2) },
                { id: "avg_bias", header: "Bias %", align: "right", sortValue: (r) => r.avg_bias, cell: (r) => `${r.avg_bias >= 0 ? "+" : ""}${r.avg_bias.toFixed(2)}` },
              ]}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
