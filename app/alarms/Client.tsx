"use client";

import { DataTable } from "@/components/DataTable";
import { Callout, Card, CardBody, CardHeader, Pill, Stat } from "@/components/ui";
import { chartTooltipProps } from "@/components/ChartTooltip";
import type { AlarmsEnriched, AlarmsInsights, NamedCount } from "@/lib/data";
import { fmtPct } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const THEME_COLORS: Record<string, string> = {
  "Level / bin management": "#6366f1",
  "Process tolerance": "#dc2626",
  "Valve / interlock faults": "#d97706",
  "Press line 1": "#2563eb",
  Grinder: "#78716c",
  "Liquids / molasses": "#0891b2",
  "Weigher / feeder": "#7c3aed",
  "Mixing / additives": "#ca8a04",
  "Other equipment": "#64748b",
};

function CompareCard({ label, stats }: { label: string; stats: AlarmsInsights["sep22_correlation"]["conform"] }) {
  return (
    <div className="rounded-md border border-ink-200 dark:border-ink-700 p-3">
      <div className="text-[11px] uppercase tracking-wide text-ink-500 mb-2">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{stats.batches} batches</div>
      <div className="text-xs text-ink-500 mt-1">
        {stats.with_alarms} with alarms ({fmtPct(stats.pct_with_alarms)}) · avg {stats.avg_alarms}/batch
      </div>
      <div className="text-xs text-ink-500">{stats.total_events.toLocaleString()} alarm events</div>
    </div>
  );
}

export function AlarmsClient({ data }: { data: AlarmsInsights }) {
  const sep = data.sep22_correlation;
  const hourly = data.hourly.map((h) => ({ ...h, label: `${String(h.hour).padStart(2, "0")}:00` }));
  const themes = data.themes.map((t) => ({ ...t, fill: THEME_COLORS[t.theme] ?? "#64748b" }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {data.takeaways.map((t) => (
          <Callout key={t.title} title={t.title} tone={t.tone}>
            {t.body}
          </Callout>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>Alarm themes</CardHeader>
          <CardBody>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={themes} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="theme" type="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip {...chartTooltipProps} />
                  <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                    {themes.map((t, i) => (
                      <Cell key={i} fill={t.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader right={<Pill tone="info">{data.coverage.alarm_log_hours}h snapshot</Pill>}>Hourly alarm profile</CardHeader>
          <CardBody>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip {...chartTooltipProps} />
                  <Bar dataKey="count" fill="#dc2626" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader right={<Pill tone="red">{data.top_alarms.length} types shown</Pill>}>Top operational alarms</CardHeader>
        <CardBody className="p-0">
          <DataTable
            rows={data.top_alarms}
            rowKey={(r) => r.name}
            searchPlaceholder="Search alarm…"
            searchText={(r) => r.name}
            defaultSort={{ id: "count", dir: "desc" }}
            pageSize={10}
            columns={[
              { id: "name", header: "Alarm", sortValue: (r: NamedCount) => r.name, cell: (r) => r.name },
              { id: "count", header: "Events", align: "right", sortValue: (r) => r.count, cell: (r) => r.count.toLocaleString() },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader right={<Pill tone="amber">Sep 22 · time-matched</Pill>}>Alarms during non-conform vs conform batches</CardHeader>
        <CardBody>
          <p className="text-sm text-ink-500 mb-4">
            On {sep.date}, {sep.all.batches} batches overlap the alarm log. Compare alarm load on batches where every weighment was in tolerance vs batches with ≥1 miss.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <CompareCard label="Non-conform batches" stats={sep.nonconform} />
            <CompareCard label="Conform batches" stats={sep.conform} />
            <CompareCard label="All (that day)" stats={sep.all} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Most common on non-conform batches</h3>
              <DataTable
                rows={sep.top_on_nonconform}
                rowKey={(r) => r.name}
                searchPlaceholder="Search…"
                searchText={(r) => r.name}
                defaultSort={{ id: "count", dir: "desc" }}
                pageSize={8}
                columns={[
                  { id: "name", header: "Alarm", sortValue: (r: NamedCount) => r.name, cell: (r) => <span className="text-xs">{r.name}</span> },
                  { id: "count", header: "Events", align: "right", sortValue: (r) => r.count, cell: (r) => r.count.toLocaleString() },
                ]}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Enriched on non-conform (min 5 events)</h3>
              <DataTable
                rows={sep.enriched_on_nonconform}
                rowKey={(r) => r.name}
                searchPlaceholder="Search…"
                searchText={(r) => r.name}
                defaultSort={{ id: "enrichment", dir: "desc" }}
                pageSize={8}
                columns={[
                  { id: "name", header: "Alarm", sortValue: (r: AlarmsEnriched) => r.name, cell: (r) => <span className="text-xs">{r.name}</span> },
                  { id: "nc", header: "NC", align: "right", sortValue: (r) => r.nc_events, cell: (r) => r.nc_events },
                  { id: "c", header: "OK", align: "right", sortValue: (r) => r.conform_events, cell: (r) => r.conform_events },
                  {
                    id: "enrichment",
                    header: "NC/C ratio",
                    align: "right",
                    sortValue: (r) => r.enrichment_ratio ?? 0,
                    cell: (r) => (r.enrichment_ratio != null ? `${r.enrichment_ratio}×` : "—"),
                  },
                ]}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>Process tolerance alarms</CardHeader>
          <CardBody className="p-0">
            <DataTable
              rows={data.tolerance_alarms}
              rowKey={(r) => r.name}
              searchPlaceholder="Search…"
              searchText={(r) => r.name}
              defaultSort={{ id: "count", dir: "desc" }}
              pageSize={10}
              columns={[
                { id: "name", header: "Alarm", sortValue: (r: NamedCount) => r.name, cell: (r) => <span className="text-xs">{r.name}</span> },
                { id: "count", header: "Events", align: "right", sortValue: (r) => r.count, cell: (r) => r.count.toLocaleString() },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader right={<Pill tone="red">Sep 22</Pill>}>Non-conform weighments by weigher</CardHeader>
          <CardBody className="p-0">
            <DataTable
              rows={sep.nonconform_weighments_by_weigher}
              rowKey={(r) => r.name}
              defaultSort={{ id: "count", dir: "desc" }}
              pageSize={10}
              columns={[
                { id: "name", header: "Weigher", sortValue: (r: NamedCount) => r.name, cell: (r) => <span className="font-mono text-xs">{r.name}</span> },
                { id: "count", header: "Misses", align: "right", sortValue: (r) => r.count, cell: (r) => r.count.toLocaleString() },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>Manual interventions · conform vs non-conform batches</CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat
              value={data.manual_comparison.nonconform_avg_per_batch.toFixed(2)}
              label="Avg manual / non-conform batch"
              tone="amber"
            />
            <Stat
              value={data.manual_comparison.conform_avg_per_batch.toFixed(2)}
              label="Avg manual / conform batch"
              tone="green"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DataTable
              rows={data.manual_comparison.top_on_nonconform}
              rowKey={(r) => r.name}
              searchPlaceholder="Search…"
              searchText={(r) => r.name}
              defaultSort={{ id: "count", dir: "desc" }}
              pageSize={8}
              columns={[
                { id: "name", header: "On non-conform batches", sortValue: (r: NamedCount) => r.name, cell: (r) => r.name },
                { id: "count", header: "Count", align: "right", sortValue: (r) => r.count, cell: (r) => r.count.toLocaleString() },
              ]}
            />
            <DataTable
              rows={data.manual_comparison.top_on_conform}
              rowKey={(r) => r.name}
              searchPlaceholder="Search…"
              searchText={(r) => r.name}
              defaultSort={{ id: "count", dir: "desc" }}
              pageSize={8}
              columns={[
                { id: "name", header: "On conform batches", sortValue: (r: NamedCount) => r.name, cell: (r) => r.name },
                { id: "count", header: "Count", align: "right", sortValue: (r) => r.count, cell: (r) => r.count.toLocaleString() },
              ]}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
