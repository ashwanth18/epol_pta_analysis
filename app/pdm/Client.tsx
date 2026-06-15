"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { Card, CardBody, CardHeader, Pill } from "@/components/ui";
import type { NamedCount, Pdm, Weigher } from "@/lib/data";
import { fmtGbp } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartTooltipProps } from "@/components/ChartTooltip";

const STATUS_LABELS: Record<string, { label: string; tone: "red" | "amber" | "green" | "neutral" }> = {
  stockout: { label: "STOCKOUT", tone: "red" },
  critical: { label: "Critical", tone: "red" },
  warning: { label: "Watch", tone: "amber" },
  overstocked: { label: "Overstocked", tone: "amber" },
  ok: { label: "OK", tone: "green" },
};

export function PdmClient({ data }: { data: Pdm }) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [chartLimit, setChartLimit] = useState(15);
  const [manualQuery, setManualQuery] = useState("");
  const [alarmQuery, setAlarmQuery] = useState("");

  const filteredStock = useMemo(() => {
    if (statusFilter === "ALL") return data.stock_forecast;
    return data.stock_forecast.filter((s) => s.status === statusFilter);
  }, [data, statusFilter]);

  const chartManual = useMemo(() => {
    const q = manualQuery.trim().toUpperCase();
    let list = data.manual_events;
    if (q) list = list.filter((r) => r.name.toUpperCase().includes(q));
    return chartLimit > 0 ? list.slice(0, chartLimit) : list;
  }, [data.manual_events, manualQuery, chartLimit]);

  const chartAlarms = useMemo(() => {
    const q = alarmQuery.trim().toUpperCase();
    let list = data.alarms;
    if (q) list = list.filter((r) => r.name.toUpperCase().includes(q));
    return chartLimit > 0 ? list.slice(0, chartLimit) : list;
  }, [data.alarms, alarmQuery, chartLimit]);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader right={<div className="flex gap-2">{ChartLimitSelect}<Pill tone="amber">{data.manual_events.length} types</Pill></div>}>Manual interventions</CardHeader>
          <CardBody>
            <input
              type="search"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              placeholder="Filter chart…"
              className="w-full mb-3 text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
            />
            <div style={{ height: Math.max(280, chartManual.length * 28) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartManual} layout="vertical" margin={{ left: 130 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip {...chartTooltipProps} />
                  <Bar dataKey="count" fill="#d97706" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 border-t border-ink-200 dark:border-ink-700 pt-4">
              <DataTable
                rows={data.manual_events}
                rowKey={(r) => r.name}
                searchPlaceholder="Search intervention…"
                searchText={(r) => r.name}
                defaultSort={{ id: "count", dir: "desc" }}
                columns={[
                  { id: "name", header: "Intervention", sortValue: (r: NamedCount) => r.name, cell: (r) => r.name },
                  { id: "count", header: "Count", align: "right", sortValue: (r) => r.count, cell: (r) => r.count.toLocaleString() },
                ]}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader right={<div className="flex gap-2">{ChartLimitSelect}<Pill tone="red">{data.alarms.length} types</Pill></div>}>Alarms by frequency</CardHeader>
          <CardBody>
            <input
              type="search"
              value={alarmQuery}
              onChange={(e) => setAlarmQuery(e.target.value)}
              placeholder="Filter chart…"
              className="w-full mb-3 text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
            />
            <div style={{ height: Math.max(280, chartAlarms.length * 28) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartAlarms} layout="vertical" margin={{ left: 180 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={180} />
                  <Tooltip {...chartTooltipProps} />
                  <Bar dataKey="count" fill="#dc2626" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 border-t border-ink-200 dark:border-ink-700 pt-4">
              <DataTable
                rows={data.alarms}
                rowKey={(r) => r.name}
                searchPlaceholder="Search alarm…"
                searchText={(r) => r.name}
                defaultSort={{ id: "count", dir: "desc" }}
                columns={[
                  { id: "name", header: "Alarm", sortValue: (r: NamedCount) => r.name, cell: (r) => r.name },
                  { id: "count", header: "Count", align: "right", sortValue: (r) => r.count, cell: (r) => r.count.toLocaleString() },
                ]}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader right={<Pill tone="info">{data.weighers.length} weighers</Pill>}>Weigher accuracy</CardHeader>
        <CardBody className="p-0">
          <DataTable
            rows={data.weighers}
            rowKey={(w) => w.name}
            searchPlaceholder="Search weigher…"
            searchText={(w) => w.name}
            defaultSort={{ id: "weighs", dir: "desc" }}
            columns={[
              { id: "name", header: "Weigher", sortValue: (w: Weigher) => w.name, cell: (w) => <span className="font-mono text-xs font-semibold">{w.name}</span> },
              { id: "weighs", header: "Weighments", align: "right", sortValue: (w) => w.weighs, cell: (w) => w.weighs.toLocaleString() },
              { id: "in_tol", header: "In tolerance", align: "right", sortValue: (w) => w.in_tol_pct, cell: (w) => `${w.in_tol_pct.toFixed(1)}%` },
              { id: "abs", header: "Avg abs var", align: "right", sortValue: (w) => w.avg_abs_var, cell: (w) => `${w.avg_abs_var.toFixed(2)}%` },
              {
                id: "bias",
                header: "Bias",
                align: "right",
                sortValue: (w) => w.avg_sgn_var,
                cell: (w) => `${w.avg_sgn_var > 0 ? "+" : ""}${w.avg_sgn_var.toFixed(2)}%`,
              },
              {
                id: "status",
                header: "Status",
                align: "center",
                sortValue: (w) => w.in_tol_pct,
                cell: (w) => {
                  const status = w.in_tol_pct < 50 ? "Drifting" : w.in_tol_pct < 90 ? "Watch" : "OK";
                  const tone = w.in_tol_pct < 50 ? "red" : w.in_tol_pct < 90 ? "amber" : "green";
                  return <Pill tone={tone}>{status}</Pill>;
                },
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          right={
            <div className="flex gap-1 flex-wrap justify-end">
              {["ALL", "stockout", "critical", "warning", "overstocked", "ok"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={[
                    "text-[11px] px-2 py-0.5 rounded border",
                    statusFilter === s ? "bg-accent-50 text-accent border-accent/30" : "border-ink-200 dark:border-ink-700 text-ink-500",
                  ].join(" ")}
                >
                  {s === "ALL" ? "All" : STATUS_LABELS[s]?.label || s}
                </button>
              ))}
            </div>
          }
        >
          Material stockout forecast · {filteredStock.length} of {data.stock_forecast.length}
        </CardHeader>
        <CardBody className="p-0">
          <DataTable
            rows={filteredStock}
            rowKey={(s) => s.code}
            searchPlaceholder="Search material…"
            searchText={(s) => `${s.code} ${s.name}`}
            defaultSort={{ id: "days", dir: "asc" }}
            columns={[
              { id: "code", header: "Code", sortValue: (s) => s.code, cell: (s) => <span className="font-mono text-xs font-semibold">{s.code}</span> },
              { id: "name", header: "Material", sortValue: (s) => s.name, cell: (s) => s.name || "—" },
              { id: "stock", header: "Stock (t)", align: "right", sortValue: (s) => s.stock_t, cell: (s) => s.stock_t.toFixed(1) },
              { id: "burn", header: "Burn (t/d)", align: "right", sortValue: (s) => s.burn_t_day, cell: (s) => s.burn_t_day.toFixed(2) },
              { id: "days", header: "Days left", align: "right", sortValue: (s) => s.days_left, cell: (s) => s.days_left },
              { id: "value", header: "Value", align: "right", sortValue: (s) => s.value_gbp, cell: (s) => fmtGbp(s.value_gbp) },
              {
                id: "status",
                header: "Status",
                align: "center",
                sortValue: (s) => s.status,
                cell: (s) => {
                  const meta = STATUS_LABELS[s.status] || { label: s.status, tone: "neutral" as const };
                  return <Pill tone={meta.tone}>{meta.label}</Pill>;
                },
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
