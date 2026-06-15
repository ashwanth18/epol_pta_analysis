"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { Card, CardBody, CardHeader, Pill, Stat } from "@/components/ui";
import type { AccuracyRow, Commercial, IngredientMaster, MaterialWeigherLink, Sku, TimelineEntry, WeigherIngredientLink } from "@/lib/data";
import { fmtNumber, fmtPct } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartTooltipProps } from "@/components/ChartTooltip";

function tolTone(pct: number): "red" | "amber" | "green" {
  if (pct < 50) return "red";
  if (pct < 90) return "amber";
  return "green";
}

function tolColor(pct: number): string {
  if (pct < 50) return "#dc2626";
  if (pct < 90) return "#d97706";
  return "#16a34a";
}

function TimelineTable({ rows }: { rows: TimelineEntry[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.table}
      searchPlaceholder="Search tables…"
      searchText={(r) => `${r.table} ${r.label} ${r.note ?? ""}`}
      defaultSort={{ id: "records", dir: "desc" }}
      pageSize={15}
      columns={[
        {
          id: "table",
          header: "Table",
          sortValue: (r) => r.table,
          cell: (r) => (
            <div>
              <div className="font-mono text-xs font-semibold">{r.table.replace(".DBF", "")}</div>
              <div className="text-[11px] text-ink-500">{r.label}</div>
            </div>
          ),
        },
        { id: "records", header: "Records", align: "right", sortValue: (r) => r.records, cell: (r) => r.records.toLocaleString() },
        { id: "from", header: "From", sortValue: (r) => r.from ?? "", cell: (r) => <span className="font-mono text-[11px]">{r.from ?? "—"}</span> },
        { id: "to", header: "To", sortValue: (r) => r.to ?? "", cell: (r) => <span className="font-mono text-[11px]">{r.to ?? "—"}</span> },
        { id: "span", header: "Span", align: "right", sortValue: (r) => r.span_days, cell: (r) => `${r.span_days}d` },
        { id: "note", header: "Note", sortValue: (r) => r.note ?? "", cell: (r) => <span className="text-[11px] text-ink-500">{r.note ?? "—"}</span> },
      ]}
    />
  );
}

function AccuracyTableSection({
  title,
  rows,
  codeLabel = "Code",
  nameLabel = "Name",
  showBias = false,
}: {
  title: string;
  rows: AccuracyRow[];
  codeLabel?: string;
  nameLabel?: string;
  showBias?: boolean;
}) {
  const [tolFilter, setTolFilter] = useState<"ALL" | "red" | "amber" | "green">("ALL");

  const filteredRows = useMemo(() => {
    if (tolFilter === "ALL") return rows;
    return rows.filter((r) => tolTone(r.in_tol_pct) === tolFilter);
  }, [rows, tolFilter]);

  const columns = [
    ...(rows[0]?.code !== undefined
      ? [{ id: "code", header: codeLabel, sortValue: (r: AccuracyRow) => r.code ?? "", cell: (r: AccuracyRow) => <span className="font-mono text-xs font-semibold">{r.code}</span> }]
      : []),
    ...(rows[0]?.group !== undefined
      ? [{ id: "group", header: "Group", sortValue: (r: AccuracyRow) => r.group ?? "", cell: (r: AccuracyRow) => r.group }]
      : []),
    ...(rows[0]?.name !== undefined || rows[0]?.group === undefined
      ? [{ id: "name", header: nameLabel, sortValue: (r: AccuracyRow) => r.name ?? r.group ?? "", cell: (r: AccuracyRow) => r.name || r.group || "—" }]
      : []),
    { id: "weighs", header: "Weighs", align: "right" as const, sortValue: (r: AccuracyRow) => r.weighs, cell: (r: AccuracyRow) => r.weighs.toLocaleString() },
    {
      id: "in_tol",
      header: "In tol",
      align: "right" as const,
      sortValue: (r: AccuracyRow) => r.in_tol_pct,
      cell: (r: AccuracyRow) => <Pill tone={tolTone(r.in_tol_pct)}>{fmtPct(r.in_tol_pct)}</Pill>,
    },
    { id: "abs", header: "Abs var", align: "right" as const, sortValue: (r: AccuracyRow) => r.avg_abs_var, cell: (r: AccuracyRow) => `${r.avg_abs_var.toFixed(2)}%` },
    ...(showBias
      ? [{
          id: "bias",
          header: "Bias",
          align: "right" as const,
          sortValue: (r: AccuracyRow) => r.avg_bias ?? r.avg_sgn_var ?? 0,
          cell: (r: AccuracyRow) => {
            const v = r.avg_bias ?? r.avg_sgn_var ?? 0;
            return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
          },
        }]
      : []),
  ];

  return (
    <Card>
      <CardHeader
        right={
          <div className="flex gap-1">
            {(["ALL", "red", "amber", "green"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTolFilter(f)}
                className={[
                  "text-[11px] px-2 py-0.5 rounded border",
                  tolFilter === f ? "bg-accent-50 text-accent border-accent/30" : "border-ink-200 dark:border-ink-700 text-ink-500",
                ].join(" ")}
              >
                {f === "ALL" ? "All" : f.toUpperCase()}
              </button>
            ))}
          </div>
        }
      >
        {title}
      </CardHeader>
      <CardBody className="p-0">
        <DataTable
          rows={filteredRows}
          rowKey={(r, i) => `${r.code ?? r.group ?? r.name}-${i}`}
          searchPlaceholder="Search…"
          searchText={(r) => `${r.code ?? ""} ${r.name ?? ""} ${r.group ?? ""}`}
          defaultSort={{ id: "weighs", dir: "desc" }}
          columns={columns}
        />
      </CardBody>
    </Card>
  );
}

function WeigherPills({ links }: { links: MaterialWeigherLink[] }) {
  if (!links.length) return <span className="text-ink-400">—</span>;
  const primary = links[0];
  return (
    <div className="flex gap-1 flex-wrap items-center">
      <Pill tone="info">{primary.weigher}</Pill>
      {links.length > 1 && <span className="text-[10px] text-ink-500">+{links.length - 1}</span>}
    </div>
  );
}

function WeigherIngredientSection({ map }: { map?: Commercial["weigher_ingredient"] }) {
  const [weigherFilter, setWeigherFilter] = useState<string>("ALL");
  const [materialFilter, setMaterialFilter] = useState<string>("ALL");

  const links = map?.links ?? [];
  const weigherOptions = useMemo(() => {
    return [...new Set(links.map((l) => l.weigher))].sort();
  }, [links]);
  const materialOptions = useMemo(() => {
    return [...new Set(links.map((l) => l.mat_code))].sort();
  }, [links]);

  const filtered = useMemo(() => {
    return links.filter((l) => {
      if (weigherFilter !== "ALL" && l.weigher !== weigherFilter) return false;
      if (materialFilter !== "ALL" && l.mat_code !== materialFilter) return false;
      return true;
    });
  }, [links, weigherFilter, materialFilter]);

  if (!map) {
    return (
      <Card>
        <CardHeader>Weigher ↔ ingredient routing</CardHeader>
        <CardBody>
          <p className="text-sm text-ink-500">Run <code className="text-xs px-1 bg-ink-100 dark:bg-ink-800 rounded">npm run export-data</code> to build weigher–material links.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        right={
          <div className="flex gap-2 flex-wrap justify-end">
            <select
              value={weigherFilter}
              onChange={(e) => setWeigherFilter(e.target.value)}
              className="text-xs px-2 py-1 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
            >
              <option value="ALL">All weighers</option>
              {weigherOptions.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="text-xs px-2 py-1 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
            >
              <option value="ALL">All materials</option>
              {materialOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        }
      >
        Weigher ↔ ingredient routing · BWEIGHS
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat value={map.weigher_count.toLocaleString()} label="Weighers used" tone="info" />
          <Stat value={map.material_count.toLocaleString()} label="Materials weighed" />
          <Stat value={map.link_count.toLocaleString()} label="Weigher–material pairs" />
          <Stat value={filtered.length.toLocaleString()} label="Matching filter" tone="green" />
        </div>
        <p className="text-sm text-ink-500 mb-4">
          Which scale dispensed which material in the batch window ({map.window_from} → {map.window_to}).
          Derived from actual weighments — a material can route through multiple weighers; share % is within that weigher or material.
        </p>
        <DataTable
          rows={filtered}
          rowKey={(l: WeigherIngredientLink) => `${l.weigher}:${l.mat_code}`}
          searchPlaceholder="Search weigher, material code or name…"
          searchText={(l) => `${l.weigher} ${l.mat_code} ${l.mat_name}`}
          defaultSort={{ id: "weighs", dir: "desc" }}
          pageSize={20}
          columns={[
            { id: "weigher", header: "Weigher", sortValue: (l) => l.weigher, cell: (l) => <span className="font-mono text-xs font-semibold">{l.weigher}</span> },
            { id: "mat_code", header: "Material", sortValue: (l) => l.mat_code, cell: (l) => <span className="font-mono text-xs">{l.mat_code}</span> },
            { id: "mat_name", header: "Name", sortValue: (l) => l.mat_name, cell: (l) => <span className="truncate max-w-[200px] block">{l.mat_name || "—"}</span> },
            { id: "weighs", header: "Weighs", align: "right", sortValue: (l) => l.weighs, cell: (l) => l.weighs.toLocaleString() },
            {
              id: "in_tol",
              header: "In tol",
              align: "right",
              sortValue: (l) => l.in_tol_pct,
              cell: (l) => <Pill tone={tolTone(l.in_tol_pct)}>{fmtPct(l.in_tol_pct)}</Pill>,
            },
            {
              id: "whr_share",
              header: "% of weigher",
              align: "right",
              sortValue: (l) => l.share_of_weigher_pct,
              cell: (l) => `${l.share_of_weigher_pct}%`,
            },
            {
              id: "mat_share",
              header: "% of material",
              align: "right",
              sortValue: (l) => l.share_of_material_pct,
              cell: (l) => `${l.share_of_material_pct}%`,
            },
          ]}
        />
      </CardBody>
    </Card>
  );
}

function IngredientMasterSection({ catalog }: { catalog?: Commercial["ingredient_catalog"] }) {
  const [filter, setFilter] = useState<"ALL" | "window" | "formulas" | "control" | "flush">("ALL");
  const items = catalog?.items ?? [];

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filter === "window") return i.in_batch_window;
      if (filter === "formulas") return i.formula_lines > 0;
      if (filter === "control") return i.control;
      if (filter === "flush") return i.is_flush;
      return true;
    });
  }, [items, filter]);

  if (!catalog) {
    return (
      <Card>
        <CardHeader>Ingredient master · INGS.DBF</CardHeader>
        <CardBody>
          <p className="text-sm text-ink-500">
            Ingredient catalogue not loaded. Run <code className="text-xs px-1 bg-ink-100 dark:bg-ink-800 rounded">npm run export-data</code> and reload.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        right={
          <div className="flex gap-1 flex-wrap justify-end">
            {(
              [
                ["ALL", "All active"],
                ["window", "In batch window"],
                ["formulas", "In formulas"],
                ["control", "Control"],
                ["flush", "Flush"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={[
                  "text-[11px] px-2 py-0.5 rounded border",
                  filter === key ? "bg-accent-50 text-accent border-accent/30" : "border-ink-200 dark:border-ink-700 text-ink-500",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        Ingredient master · INGS.DBF
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Stat value={catalog.total_slots.toLocaleString()} label="Ingredients seen" tone="info" />
          <Stat value={catalog.active.toLocaleString()} label="Active ingredients" />
          <Stat value={catalog.in_batch_window.toLocaleString()} label="Weighed in window" />
          <Stat value={catalog.in_formulas.toLocaleString()} label="Control-coded" />
          <Stat value={filtered.length.toLocaleString()} label="Matching filter" tone="green" />
        </div>
        <p className="text-sm text-ink-500 mb-4">
          Ingredient catalogue derived from <code className="text-xs px-1 bg-ink-100 dark:bg-ink-800 rounded">BWEIGHS.DBF</code> drops — epol PTA has no
          INGS master table, so codes, names and control flags are reconstructed from the weighment log. Accuracy columns reflect every material weighed in the current batch window.
        </p>
        <DataTable
          rows={filtered}
          rowKey={(i) => i.code || String(i.ing_no)}
          searchPlaceholder="Search code, name, description…"
          searchText={(i) => `${i.code} ${i.name} ${i.desc}`}
          defaultSort={{ id: "code", dir: "asc" }}
          pageSize={25}
          columns={[
            { id: "code", header: "Code", sortValue: (i: IngredientMaster) => i.code, cell: (i) => <span className="font-mono text-xs font-semibold">{i.code}</span> },
            { id: "name", header: "Name", sortValue: (i) => i.name, cell: (i) => <span className="truncate max-w-[220px] block">{i.name}</span> },
            { id: "ing_no", header: "ING_NO", align: "right", sortValue: (i) => i.ing_no ?? 0, cell: (i) => i.ing_no ?? "—" },
            {
              id: "weighers",
              header: "Weigher(s)",
              sortValue: (i) => i.primary_weigher ?? "",
              cell: (i) => <WeigherPills links={i.weighers ?? []} />,
            },
            {
              id: "flags",
              header: "Flags",
              cell: (i) => (
                <div className="flex gap-1 flex-wrap">
                  {i.in_batch_window && <Pill tone="info">Window</Pill>}
                  {i.control && <Pill tone="amber">Control</Pill>}
                  {i.is_flush && <Pill tone="green">Flush</Pill>}
                </div>
              ),
            },
            { id: "formula_lines", header: "Formula lines", align: "right", sortValue: (i) => i.formula_lines, cell: (i) => i.formula_lines || "—" },
            { id: "weighs", header: "Weighs", align: "right", sortValue: (i) => i.weighs, cell: (i) => (i.weighs ? i.weighs.toLocaleString() : "—") },
            {
              id: "in_tol",
              header: "In tol",
              align: "right",
              sortValue: (i) => i.in_tol_pct ?? -1,
              cell: (i) =>
                i.in_tol_pct != null ? <Pill tone={tolTone(i.in_tol_pct)}>{fmtPct(i.in_tol_pct)}</Pill> : <span className="text-ink-400">—</span>,
            },
            {
              id: "abs",
              header: "Abs var",
              align: "right",
              sortValue: (i) => i.avg_abs_var ?? -1,
              cell: (i) => (i.avg_abs_var != null ? `${i.avg_abs_var.toFixed(2)}%` : "—"),
            },
          ]}
        />
      </CardBody>
    </Card>
  );
}

export function CommercialClient({ data }: { data: Commercial }) {
  const acc = data.accuracy;
  const bs = acc.batch_summary;
  const [chartLimit, setChartLimit] = useState(15);
  const [customerQuery, setCustomerQuery] = useState("");

  const chartWeighers = useMemo(() => {
    let list = [...data.weighers].sort((a, b) => b.weighs - a.weighs);
    return chartLimit > 0 ? list.slice(0, chartLimit) : list;
  }, [data.weighers, chartLimit]);

  const chartCustomers = useMemo(() => {
    const q = customerQuery.trim().toUpperCase();
    let list = data.customers;
    if (q) list = list.filter((c) => c.name.toUpperCase().includes(q));
    return chartLimit > 0 ? list.slice(0, chartLimit) : list;
  }, [data.customers, chartLimit, customerQuery]);

  const ChartLimitSelect = (
    <select
      value={chartLimit}
      onChange={(e) => setChartLimit(parseInt(e.target.value, 10))}
      className="text-xs px-2 py-1 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
    >
      <option value={10}>Chart: top 10</option>
      <option value={15}>Chart: top 15</option>
      <option value={25}>Chart: top 25</option>
      <option value={0}>Chart: all</option>
    </select>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader right={<Pill tone="info">Ring buffers — spans differ per table</Pill>}>Data coverage timeline</CardHeader>
        <CardBody className="p-0">
          <TimelineTable rows={data.timeline} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat value={`${acc.window_from ?? "?"} → ${acc.window_to ?? "?"}`} label="Accuracy window (BSTARTS)" tone="info" />
        <Stat value={`${acc.weighments_in_window.toLocaleString()} / ${acc.weighments_total.toLocaleString()}`} label="Weighments in window" hint="Linked to current batches" />
        <Stat value={fmtPct(bs.perfect_pct)} label="Batches — all drops in tol" tone={bs.perfect_pct < 50 ? "red" : "amber"} />
        <Stat value={bs.avg_misses_per_batch.toFixed(1)} label="Avg out-of-tol drops / batch" tone="amber" />
      </div>

      <Card>
        <CardHeader>Batch-level accuracy</CardHeader>
        <CardBody className="text-sm text-ink-600 dark:text-ink-300 space-y-2">
          <p>
            A batch passes only if every ingredient drop is within tolerance. Stats use weighments from{" "}
            <strong>{acc.window_from} to {acc.window_to}</strong>.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="rounded-md border border-ink-200 dark:border-ink-700 p-3">
              <div className="text-2xl font-semibold tabular-nums">{bs.batches.toLocaleString()}</div>
              <div className="text-[11px] text-ink-500 uppercase tracking-wide">Batches</div>
            </div>
            <div className="rounded-md border border-rag-green/40 bg-rag-green/5 p-3">
              <div className="text-2xl font-semibold tabular-nums text-rag-green">{bs.perfect.toLocaleString()}</div>
              <div className="text-[11px] text-ink-500 uppercase tracking-wide">Perfect ({fmtPct(bs.perfect_pct)})</div>
            </div>
            <div className="rounded-md border border-rag-red/40 bg-rag-red/5 p-3">
              <div className="text-2xl font-semibold tabular-nums text-rag-red">{bs.any_miss.toLocaleString()}</div>
              <div className="text-[11px] text-ink-500 uppercase tracking-wide">≥1 miss ({fmtPct(bs.any_miss_pct)})</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AccuracyTableSection title={`Weigher groups · ${acc.weigher_groups.length}`} rows={acc.weigher_groups} nameLabel="Type" />
        <Card>
          <CardHeader right={ChartLimitSelect}>Weigher accuracy · {data.weighers.length} scales</CardHeader>
          <CardBody>
            <div style={{ height: Math.max(280, chartWeighers.length * 28) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartWeighers} layout="vertical" margin={{ left: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip {...chartTooltipProps} />
                  <Bar dataKey="in_tol_pct" radius={[0, 3, 3, 0]}>
                    {chartWeighers.map((w, i) => (
                      <Cell key={i} fill={tolColor(w.in_tol_pct)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <AccuracyTableSection title={`Weigher detail · ${data.weighers.length}`} rows={data.weighers.map((w) => ({ ...w, code: w.name, name: w.name }))} codeLabel="Weigher" showBias />

      <WeigherIngredientSection map={data.weigher_ingredient} />

      <IngredientMasterSection catalog={data.ingredient_catalog} />

      <AccuracyTableSection
        title={`Batch-window weighment accuracy · ${acc.ingredients.length} materials`}
        rows={acc.ingredients}
        codeLabel="Mat"
        nameLabel="Material"
      />

      <AccuracyTableSection title={`Formulations · ${acc.formulations.length}`} rows={acc.formulations} codeLabel="Formula" nameLabel="Description" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>Daily production (tonnes)</CardHeader>
          <CardBody>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.production.daily_series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip {...chartTooltipProps} />
                  <Line type="monotone" dataKey="tonnes" stroke="#2f6feb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader right={<Pill tone="info">{data.skus.length} SKUs</Pill>}>SKUs by tonnage</CardHeader>
          <CardBody className="p-0">
            <DataTable
              rows={data.skus}
              rowKey={(s) => s.code}
              searchPlaceholder="Search SKU or description…"
              searchText={(s) => `${s.code} ${s.desc}`}
              defaultSort={{ id: "tonnes", dir: "desc" }}
              columns={[
                { id: "code", header: "SKU", sortValue: (s: Sku) => s.code, cell: (s) => <span className="font-mono text-xs font-semibold">{s.code}</span> },
                { id: "desc", header: "Description", sortValue: (s) => s.desc, cell: (s) => s.desc || "—" },
                { id: "batches", header: "Batches", align: "right", sortValue: (s) => s.batches, cell: (s) => s.batches },
                { id: "tonnes", header: "Tonnes", align: "right", sortValue: (s) => s.tonnes, cell: (s) => fmtNumber(s.tonnes) },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader right={<div className="flex items-center gap-2">{ChartLimitSelect}<Pill tone="info">{data.customers.length} customers</Pill></div>}>Customers by tonnage</CardHeader>
        <CardBody>
          <div className="mb-4">
            <input
              type="search"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="Filter customers for chart…"
              className="w-full max-w-md text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
            />
          </div>
          <div style={{ height: Math.max(320, chartCustomers.length * 24) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartCustomers} layout="vertical" margin={{ left: 140 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={140} />
                <Tooltip {...chartTooltipProps} />
                <Bar dataKey="tonnes" fill="#2f6feb" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 border-t border-ink-200 dark:border-ink-700 pt-4">
            <DataTable
              rows={data.customers}
              rowKey={(c) => c.name}
              searchPlaceholder="Search customers…"
              searchText={(c) => c.name}
              defaultSort={{ id: "tonnes", dir: "desc" }}
              pageSize={20}
              columns={[
                { id: "name", header: "Customer", sortValue: (c) => c.name, cell: (c) => c.name },
                { id: "tonnes", header: "Tonnes", align: "right", sortValue: (c) => c.tonnes, cell: (c) => fmtNumber(c.tonnes) },
              ]}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
