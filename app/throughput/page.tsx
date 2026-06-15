import { Callout, PageHeader, Stat } from "@/components/ui";
import { throughput } from "@/lib/data";
import { fmtNumber, fmtPct } from "@/lib/format";
import { ThroughputClient } from "./Client";

export default function ThroughputPage() {
  const s = throughput.summary;
  const range =
    throughput.window_from && throughput.window_to
      ? `${throughput.window_from} → ${throughput.window_to}`
      : "batch window";

  return (
    <div>
      <PageHeader
        title="Throughput & Cycle Time"
        subtitle={`Batch cycle time (release → completion) and production rate · ${s.batches_timed.toLocaleString()} timed batches · ${range}. Daily output, route & SKU rate, and slow-cycle outliers.`}
      />

      <Callout title="Method" tone="info">
        {throughput.notes[0]} {throughput.notes[1]} {throughput.notes[3]}
      </Callout>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <Stat value={fmtNumber(s.total_tonnes)} label="Tonnes produced" tone="info" hint={`${fmtNumber(s.total_hours)} batch-hours`} />
        <Stat value={`${s.batches_per_day_mean}`} label="Batches / day" />
        <Stat value={`${s.duration_min_mean} min`} label="Mean cycle time" hint={`σ ${s.duration_min_stdev}`} />
        <Stat value={`${s.t_per_h_mean}`} label="Mean t/h (lead-time)" hint={`median ${s.t_per_h_median}`} />
        <Stat value={`${s.t_per_h_p10} – ${s.t_per_h_p90}`} label="t/h P10 – P90" />
        <Stat value={fmtPct(s.pct_timed)} label="Batches timed" hint={`${s.batches_timed} / ${s.batches_total}`} />
      </div>

      <ThroughputClient data={throughput} />
    </div>
  );
}
