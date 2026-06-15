"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { Card, CardBody, CardHeader, Pill } from "@/components/ui";
import { chartTooltipProps } from "@/components/ChartTooltip";
import type { ThroughputAnalytics, ThroughputBatch, ThroughputSku } from "@/lib/data";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Zone = "fast" | "normal" | "slow" | "investigate";

function classify(durMin: number, mean: number, stdev: number, p10: number, p90: number): Zone {
  if (stdev > 0 && durMin >= mean + 2 * stdev) return "investigate";
  if (durMin >= p90) return "slow";
  if (durMin <= p10) return "fast";
  return "normal";
}

function zoneColor(z: Zone) {
  if (z === "investigate") return "#dc2626";
  if (z === "slow") return "#d97706";
  if (z === "fast") return "#16a34a";
  return "#2563eb";
}

function zonePill(z: Zone) {
  if (z === "investigate") return <Pill tone="red">Investigate</Pill>;
  if (z === "slow") return <Pill tone="amber">Slow</Pill>;
  if (z === "fast") return <Pill tone="green">Fast</Pill>;
  return <Pill tone="info">Normal</Pill>;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function ThroughputClient({ data }: { data: ThroughputAnalytics }) {
  const [skuLimit, setSkuLimit] = useState(15);
  const [batchSearch, setBatchSearch] = useState("");
  const s = data.summary;

  // p10/p90 of duration approximated from t/h percentiles is not available, so
  // derive duration percentiles from the batch list once.
  const durStats = useMemo(() => {
    const durs = data.batches.map((b) => b.duration_min).sort((a, b) => a - b);
    const pct = (p: number) => (durs.length ? durs[Math.min(durs.length - 1, Math.floor((durs.length * p) / 100))] : 0);
    return { p10: pct(10), p90: pct(90), mean: s.duration_min_mean, stdev: s.duration_min_stdev };
  }, [data.batches, s]);

  const scored = useMemo(
    () =>
      data.batches.map((b) => ({
        ...b,
        zone: classify(b.duration_min, durStats.mean, durStats.stdev, durStats.p10, durStats.p90),
      })),
    [data.batches, durStats],
  );
  const zoneByBatch = useMemo(() => new Map(scored.map((b) => [b.log_batch, b.zone])), [scored]);
  const slow = scored.filter((b) => b.zone === "slow" || b.zone === "investigate");
  const investigateThreshold = round1(durStats.mean + 2 * durStats.stdev);

  const distChart = useMemo(() => {
    const total = data.batches.length;
    const lastIdx = data.distribution.length - 1;
    return data.distribution.map((bin, i) => {
      const inBin = data.batches.filter((b) =>
        i === lastIdx ? b.duration_min >= bin.bin_start && b.duration_min <= bin.bin_end : b.duration_min >= bin.bin_start && b.duration_min < bin.bin_end,
      );
      const mid = (bin.bin_start + bin.bin_end) / 2;
      return {
        ...bin,
        zone: classify(mid, durStats.mean, durStats.stdev, durStats.p10, durStats.p90),
        pct: total ? (100 * bin.count) / total : 0,
      };
    });
  }, [data, durStats]);

  const dailyChart = useMemo(() => data.daily.map((d) => ({ ...d })), [data.daily]);
  const hourlyChart = useMemo(
    () => data.hourly.map((h) => ({ ...h, label: `${String(h.hour).padStart(2, "0")}:00` })),
    [data.hourly],
  );
  const chartSkus = useMemo(() => {
    const list = [...data.skus].sort((a, b) => b.tonnes - a.tonnes);
    return skuLimit > 0 ? list.slice(0, skuLimit) : list;
  }, [data.skus, skuLimit]);

  const jumpToBatch = (id: string) => {
    setBatchSearch(id);
    document.getElementById("batch-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader right={<Pill tone="info">Output per day</Pill>}>Daily tonnes &amp; batches</CardHeader>
          <CardBody>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                  <YAxis yAxisId="t" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="b" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip
                    {...chartTooltipProps}
                    formatter={(v: number, name: string) => {
                      if (name === "tonnes") return [`${v} t`, "Tonnes"];
                      if (name === "batches") return [`${v}`, "Batches"];
                      return [v, name];
                    }}
                  />
                  <Bar yAxisId="t" dataKey="tonnes" fill="#2563eb" radius={[3, 3, 0, 0]} name="tonnes" />
                  <Line yAxisId="b" type="monotone" dataKey="batches" stroke="#d97706" strokeWidth={2} dot={false} name="batches" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader right={<Pill tone="green">{scored.length - slow.length} normal/fast</Pill>}>Batch cycle-time distribution</CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-xs">
              <div className="rounded-md border border-ink-200 dark:border-ink-700 px-3 py-2">
                <div className="text-ink-500">Normal band (P10–P90)</div>
                <div className="font-semibold tabular-nums">{durStats.p10} – {durStats.p90} min</div>
              </div>
              <div className="rounded-md border border-ink-200 dark:border-ink-700 px-3 py-2">
                <div className="text-ink-500">Mean cycle</div>
                <div className="font-semibold tabular-nums">{durStats.mean} min · σ {durStats.stdev}</div>
              </div>
              <div className="rounded-md border border-amber-200 dark:border-amber-900/50 px-3 py-2 bg-amber-50/50 dark:bg-amber-950/20">
                <div className="text-ink-500">Slow (≥ P90)</div>
                <div className="font-semibold tabular-nums">{scored.filter((b) => b.zone === "slow").length} batches</div>
              </div>
              <div className="rounded-md border border-red-200 dark:border-red-900/50 px-3 py-2 bg-red-50/50 dark:bg-red-950/20">
                <div className="text-ink-500">Investigate (&gt; μ+2σ)</div>
                <div className="font-semibold tabular-nums">{scored.filter((b) => b.zone === "investigate").length} · ≥ {investigateThreshold}m</div>
              </div>
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distChart} margin={{ top: 8, right: 8, left: 4, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={48} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: "Batches", angle: -90, position: "insideLeft", fontSize: 10 }} />
                  <Tooltip {...chartTooltipProps} formatter={(v: number) => [`${v} batches`, "Count"]} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {distChart.map((entry, i) => (
                      <Cell key={i} fill={zoneColor(entry.zone)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      {slow.length > 0 && (
        <Card>
          <CardHeader right={<Pill tone="red">{scored.filter((b) => b.zone === "investigate").length} to investigate</Pill>}>
            Slow-cycle batches — review list
          </CardHeader>
          <CardBody className="p-0">
            <p className="px-4 py-3 text-xs text-ink-500 border-b border-ink-200 dark:border-ink-700">
              Batches with the longest release-to-completion times. <strong>Investigate</strong> = more than 2σ above the mean (≥ {investigateThreshold} min).
            </p>
            <DataTable
              rows={slow.sort((a, b) => b.duration_min - a.duration_min)}
              rowKey={(r) => r.log_batch}
              defaultSort={{ id: "duration_min", dir: "desc" }}
              pageSize={10}
              columns={[
                { id: "zone", header: "Flag", sortValue: (r) => r.zone, cell: (r) => zonePill(r.zone) },
                { id: "log_batch", header: "Batch", sortValue: (r) => r.log_batch, cell: (r) => <span className="font-mono text-xs font-semibold">{r.log_batch}</span> },
                { id: "date", header: "Date", sortValue: (r) => r.date ?? "", cell: (r) => r.date ?? "—" },
                { id: "frm_code", header: "Formula", sortValue: (r) => r.frm_code, cell: (r) => <span className="font-mono text-xs">{r.frm_code}</span> },
                { id: "frm_name", header: "Product", sortValue: (r) => r.frm_name, cell: (r) => <span className="text-xs truncate max-w-[160px] block">{r.frm_name}</span> },
                { id: "route", header: "Route", sortValue: (r) => r.route, cell: (r) => <span className="font-mono text-xs">{r.route}</span> },
                { id: "duration_min", header: "Cycle (min)", align: "right", sortValue: (r) => r.duration_min, cell: (r) => <span className="font-semibold">{r.duration_min.toFixed(0)}</span> },
                { id: "t_per_h", header: "t/h", align: "right", sortValue: (r) => r.t_per_h, cell: (r) => r.t_per_h.toFixed(2) },
                { id: "tonnes", header: "t", align: "right", sortValue: (r) => r.tonnes, cell: (r) => r.tonnes.toFixed(2) },
              ]}
            />
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>Mean cycle time by start hour</CardHeader>
          <CardBody>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip {...chartTooltipProps} />
                  <Line type="monotone" dataKey="duration_min_mean" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} name="Mean cycle (min)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>Throughput rate by press route</CardHeader>
          <CardBody>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.routes} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="route" type="category" tick={{ fontSize: 11 }} width={50} />
                  <Tooltip {...chartTooltipProps} />
                  <Bar dataKey="t_per_h" fill="#16a34a" radius={[0, 3, 3, 0]} name="t/h" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          right={
            <select
              value={skuLimit}
              onChange={(e) => setSkuLimit(parseInt(e.target.value, 10))}
              className="text-xs px-2 py-1 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
            >
              <option value={10}>Chart: top 10</option>
              <option value={15}>Chart: top 15</option>
              <option value={25}>Chart: top 25</option>
              <option value={0}>Chart: all</option>
            </select>
          }
        >
          Output by formula / SKU
        </CardHeader>
        <CardBody>
          <div style={{ height: Math.max(240, chartSkus.length * 26) }} className="mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSkus} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="code" type="category" tick={{ fontSize: 10 }} width={100} />
                <Tooltip {...chartTooltipProps} />
                <Bar dataKey="tonnes" fill="#6366f1" radius={[0, 3, 3, 0]} name="Tonnes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            rows={data.skus}
            rowKey={(r: ThroughputSku) => r.code}
            searchPlaceholder="Search formula…"
            searchText={(r) => `${r.code} ${r.name}`}
            defaultSort={{ id: "tonnes", dir: "desc" }}
            pageSize={12}
            columns={[
              { id: "code", header: "Formula", sortValue: (r) => r.code, cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
              { id: "name", header: "Name", sortValue: (r) => r.name, cell: (r) => <span className="text-xs truncate max-w-[180px] block">{r.name}</span> },
              { id: "batches", header: "Batches", align: "right", sortValue: (r) => r.batches, cell: (r) => r.batches },
              { id: "tonnes", header: "Tonnes", align: "right", sortValue: (r) => r.tonnes, cell: (r) => r.tonnes.toLocaleString() },
              { id: "t_per_h", header: "t/h", align: "right", sortValue: (r) => r.t_per_h, cell: (r) => r.t_per_h.toFixed(2) },
              { id: "duration_min_mean", header: "Cycle (min)", align: "right", sortValue: (r) => r.duration_min_mean, cell: (r) => r.duration_min_mean.toFixed(0) },
            ]}
          />
        </CardBody>
      </Card>

      <div id="batch-detail">
        <Card>
          <CardHeader right={<Pill tone="info">{data.batches.length} timed batches</Pill>}>Batch cycle-time detail</CardHeader>
          <CardBody className="p-0">
            <DataTable
              rows={data.batches}
              rowKey={(r: ThroughputBatch) => r.log_batch}
              searchPlaceholder="Search batch, formula, route…"
              searchText={(r) => `${r.log_batch} ${r.frm_code} ${r.frm_name} ${r.route}`}
              initialQuery={batchSearch}
              defaultSort={{ id: "duration_min", dir: "desc" }}
              pageSize={20}
              columns={[
                {
                  id: "flag",
                  header: "Flag",
                  sortValue: (r) => zoneByBatch.get(r.log_batch) ?? "normal",
                  cell: (r) => {
                    const z = zoneByBatch.get(r.log_batch);
                    return z === "investigate" || z === "slow" ? zonePill(z) : <span className="text-ink-400">—</span>;
                  },
                },
                { id: "log_batch", header: "Batch", sortValue: (r) => r.log_batch, cell: (r) => <span className="font-mono text-xs">{r.log_batch}</span> },
                { id: "date", header: "Date", sortValue: (r) => r.date ?? "", cell: (r) => r.date ?? "—" },
                { id: "route", header: "Route", sortValue: (r) => r.route, cell: (r) => <span className="font-mono text-xs">{r.route}</span> },
                { id: "frm_code", header: "Formula", sortValue: (r) => r.frm_code, cell: (r) => <span className="font-mono text-xs">{r.frm_code}</span> },
                { id: "tonnes", header: "t", align: "right", sortValue: (r) => r.tonnes, cell: (r) => r.tonnes.toFixed(2) },
                { id: "duration_min", header: "Cycle (min)", align: "right", sortValue: (r) => r.duration_min, cell: (r) => r.duration_min.toFixed(0) },
                { id: "t_per_h", header: "t/h", align: "right", sortValue: (r) => r.t_per_h, cell: (r) => r.t_per_h.toFixed(2) },
                { id: "ingredients", header: "Drops", align: "right", sortValue: (r) => r.ingredients, cell: (r) => r.ingredients },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>Weighments per batch vs cycle time</CardHeader>
        <CardBody className="p-0">
          <DataTable
            rows={data.ingredient_count_buckets}
            rowKey={(r) => String(r.ingredient_count)}
            defaultSort={{ id: "ingredient_count", dir: "asc" }}
            pageSize={15}
            columns={[
              { id: "ingredient_count", header: "Weighments / batch", sortValue: (r) => r.ingredient_count, cell: (r) => r.ingredient_count },
              { id: "batches", header: "Batches", align: "right", sortValue: (r) => r.batches, cell: (r) => r.batches },
              { id: "duration_min_mean", header: "Mean cycle (min)", align: "right", sortValue: (r) => r.duration_min_mean, cell: (r) => r.duration_min_mean.toFixed(0) },
              { id: "t_per_h_mean", header: "Mean t/h", align: "right", sortValue: (r) => r.t_per_h_mean, cell: (r) => r.t_per_h_mean.toFixed(2) },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
