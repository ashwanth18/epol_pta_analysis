"use client";

import { DataTable } from "@/components/DataTable";
import { Callout, Card, CardBody, CardHeader, Pill, Stat } from "@/components/ui";
import { chartTooltipProps } from "@/components/ChartTooltip";
import type { AlarmsDurationItem, AlarmsEnriched, AlarmsInsights, AlarmsMonthly, NamedCount } from "@/lib/data";
import { fmtPct, fmtPctOrDash, monthLabel } from "@/lib/format";
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

function fmtDuration(min: number): string {
  if (min < 60) return `${min.toFixed(min < 10 ? 1 : 0)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function AlarmsClient({ data }: { data: AlarmsInsights }) {
  const sep = data.sep22_correlation;
  const hourly = data.hourly.map((h) => ({ ...h, label: `${String(h.hour).padStart(2, "0")}:00` }));
  const themes = data.themes.map((t) => ({ ...t, fill: THEME_COLORS[t.theme] ?? "#64748b" }));
  const dur = data.duration;
  const themeDur = dur.by_theme.map((t) => ({ ...t, fill: THEME_COLORS[t.theme] ?? "#64748b" }));
  const mom = data.monthly.map((m) => ({ ...m, label: monthLabel(m.month) }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {data.takeaways.map((t) => (
          <Callout key={t.title} title={t.title} tone={t.tone}>
            {t.body}
          </Callout>
        ))}
      </div>

      <Callout title="Priority = time lost, not frequency" tone="info">
        A rare alarm that holds the line for hours costs more than a frequent one that clears instantly, so this page
        ranks by <strong>active time</strong> (raised → cleared) first. The headline is{" "}
        <strong>wall-clock</strong> time — concurrent alarms are merged, not added, so it never exceeds the{" "}
        {Math.round(dur.window_hours).toLocaleString()}h logged ({dur.active_pct}% active). {dur.note}
      </Callout>

      <Card>
        <CardHeader right={<Pill tone="red">~{Math.round(dur.stopping_hours).toLocaleString()} h est. downtime</Pill>}>
          Estimated downtime — fault alarms vs advisory flags
        </CardHeader>
        <CardBody>
          <p className="text-sm text-ink-500 mb-3">
            Not every active alarm stops production. We split alarms into <strong>faults/trips</strong> (likely halts)
            and <strong>advisory flags</strong> (low level, no feed, not scheduled, out of tolerance). Classification is
            keyword-based; the estimated-downtime figure counts faults only.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-md border border-red-200 dark:border-red-900/50 px-3 py-2 bg-red-50/50 dark:bg-red-950/20">
              <div className="text-[11px] text-ink-500 uppercase tracking-wide">Fault / trip time</div>
              <div className="text-xl font-semibold tabular-nums text-rag-red">{fmtDuration(dur.stopping_hours * 60)}</div>
              <div className="text-[11px] text-ink-400">{dur.stopping_pct}% of period · est. downtime</div>
            </div>
            <div className="rounded-md border border-ink-200 dark:border-ink-700 px-3 py-2">
              <div className="text-[11px] text-ink-500 uppercase tracking-wide">Advisory flag time</div>
              <div className="text-xl font-semibold tabular-nums">{fmtDuration(dur.advisory_hours * 60)}</div>
              <div className="text-[11px] text-ink-400">excluded from downtime</div>
            </div>
            <div className="rounded-md border border-ink-200 dark:border-ink-700 px-3 py-2">
              <div className="text-[11px] text-ink-500 uppercase tracking-wide">Production active</div>
              <div className="text-xl font-semibold tabular-nums">{Math.round((100 * dur.crosscheck.production_active_hours) / dur.window_hours)}%</div>
              <div className="text-[11px] text-ink-400">{fmtDuration(dur.crosscheck.production_active_hours * 60)} of {Math.round(dur.window_hours).toLocaleString()}h</div>
            </div>
            <div className="rounded-md border border-ink-200 dark:border-ink-700 px-3 py-2">
              <div className="text-[11px] text-ink-500 uppercase tracking-wide">Full-plant idle</div>
              <div className="text-xl font-semibold tabular-nums">{fmtDuration(dur.crosscheck.plant_idle_hours * 60)}</div>
              <div className="text-[11px] text-ink-400">runs effectively continuously</div>
            </div>
          </div>
          <p className="text-xs text-ink-500 mt-3">{dur.crosscheck.note}</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader right={<Pill tone="red">{data.monthly.length} months</Pill>}>Month on month</CardHeader>
        <CardBody>
          <p className="text-sm text-ink-500 mb-3">
            Wall-clock alarm-active time per month (overlapping alarms merged), with events, dominant theme and changeover test coverage. The latest month may be partial.
          </p>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mom} margin={{ left: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="h" />
                <Tooltip {...chartTooltipProps} formatter={(v: number) => [`${v} h`, "Time lost"]} />
                <Bar dataKey="time_lost_h" fill="#dc2626" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4">
            <DataTable
              rows={data.monthly}
              rowKey={(r) => r.month}
              defaultSort={{ id: "month", dir: "asc" }}
              pageSize={12}
              columns={[
                { id: "month", header: "Month", sortValue: (r: AlarmsMonthly) => r.month, cell: (r) => <span className="font-medium">{monthLabel(r.month)}</span> },
                { id: "time_lost", header: "Time lost", align: "right", sortValue: (r) => r.time_lost_h, cell: (r) => <span className="font-semibold tabular-nums">{fmtDuration(r.time_lost_h * 60)}</span> },
                { id: "events", header: "Events", align: "right", sortValue: (r) => r.events, cell: (r) => r.events.toLocaleString() },
                { id: "theme", header: "Top theme (by time)", sortValue: (r) => r.top_theme ?? "", cell: (r) => <span className="text-xs">{r.top_theme ?? "—"}</span> },
                { id: "changeovers", header: "Changeovers", align: "right", sortValue: (r) => r.changeovers, cell: (r) => r.changeovers.toLocaleString() },
                { id: "test_pct", header: "Test coverage", align: "right", sortValue: (r) => r.changeover_test_pct ?? -1, cell: (r) => fmtPctOrDash(r.changeover_test_pct) },
              ]}
            />
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader right={<Pill tone="red">{fmtDuration(dur.total_min)} total</Pill>}>Where time is lost · by theme</CardHeader>
          <CardBody>
            <p className="text-sm text-ink-500 mb-3">
              Wall-clock time each theme had an alarm active (raised → cleared, overlaps merged) across {dur.intervals.toLocaleString()} cycles. This is the priority signal.
            </p>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={themeDur} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                  <YAxis dataKey="theme" type="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip {...chartTooltipProps} formatter={(v: number) => [`${v} h`, "Active time"]} />
                  <Bar dataKey="hours" radius={[0, 3, 3, 0]}>
                    {themeDur.map((t, i) => (
                      <Cell key={i} fill={t.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader right={<Pill tone="red">Priority order</Pill>}>Priority alarms · ranked by time lost</CardHeader>
          <CardBody className="p-0">
            <DataTable
              rows={dur.top_alarms}
              rowKey={(r) => r.name}
              searchPlaceholder="Search alarm…"
              searchText={(r) => r.name}
              defaultSort={{ id: "total", dir: "desc" }}
              pageSize={10}
              columns={[
                { id: "name", header: "Alarm", sortValue: (r: AlarmsDurationItem) => r.name, cell: (r) => <span className="text-xs">{r.name}</span> },
                { id: "cls", header: "Type", sortValue: (r) => r.cls, cell: (r) => (r.cls === "stopping" ? <Pill tone="red">Fault</Pill> : <Pill tone="neutral">Advisory</Pill>) },
                { id: "intervals", header: "Cycles", align: "right", sortValue: (r) => r.intervals, cell: (r) => r.intervals.toLocaleString() },
                { id: "avg", header: "Avg wait", align: "right", sortValue: (r) => r.avg_min, cell: (r) => fmtDuration(r.avg_min) },
                { id: "total", header: "Total lost", align: "right", sortValue: (r) => r.total_min, cell: (r) => <span className="font-semibold tabular-nums">{fmtDuration(r.total_min)}</span> },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader right={<Pill tone="info">secondary</Pill>}>Alarm frequency by theme</CardHeader>
          <CardBody>
            <p className="text-sm text-ink-500 mb-3">
              How often each theme fires. High counts flag nuisance alarms, but don&apos;t set priority on their own — cross-reference with time lost above.
            </p>
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
        <CardHeader right={<Pill tone="info">{data.top_alarms.length} by frequency</Pill>}>Most frequent alarms</CardHeader>
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
