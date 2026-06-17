import { Callout, PageHeader, Pill, Stat } from "@/components/ui";
import { alarmsInsights } from "@/lib/data";
import { fmtNumber, fmtPct } from "@/lib/format";
import { AlarmsClient } from "./Client";

export default function AlarmsPage() {
  const c = alarmsInsights.coverage;
  const t = alarmsInsights.totals;
  const bc = alarmsInsights.batch_conformance;
  const d = alarmsInsights.duration;

  return (
    <div>
      <PageHeader
        title="Alarms & Conformance"
        subtitle="Alarms are downtime. This view prioritises where time is lost — active alarm time (raised → cleared) — over raw frequency, alongside shift profile and conformance correlation. From ALMLOGS, MANLOG, and BWEIGHS."
      />

      <Callout title="Data coverage" tone="amber">
        Alarm ring buffer: <strong>{c.alarm_log_from} → {c.alarm_log_to}</strong> ({c.alarm_log_hours}h).
        Batch window: <strong>{c.batch_window_from} → {c.batch_window_to}</strong> ({c.batch_window_count?.toLocaleString()} batches).
        Batch–alarm correlation uses timestamp overlap on <strong>{c.sep22_correlation_batches} batches</strong> — ALMLOGS.LOG_BATCH is not populated.
      </Callout>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <Stat value={`${Math.round(d.total_hours).toLocaleString()} h`} label="Time lost to alarms" tone="red" hint={`${fmtNumber(d.intervals)} raise→clear cycles`} />
        <Stat value={fmtNumber(t.alarm_events_operational)} label="Operational alarms" tone="amber" hint={`${fmtNumber(t.windows_noise_events)} Windows noise excluded`} />
        <Stat value={t.unique_alarm_types.toString()} label="Alarm types" />
        <Stat value={fmtPct(bc.batches_conform_pct)} label="Conform batches" tone="amber" hint={`${bc.batches_conform} / ${bc.batches_conform + bc.batches_nonconform}`} />
        <Stat value={fmtPct(bc.weighments_conform_pct)} label="Conform weighments" tone="green" hint={`${fmtNumber(bc.weighments_conform)} / ${fmtNumber(bc.weighments_conform + bc.weighments_nonconform)}`} />
        <Stat value={fmtNumber(t.manual_events)} label="Manual interventions" tone="amber" hint={`${c.manual_log_from?.slice(0, 10)} → ${c.manual_log_to?.slice(0, 10)}`} />
      </div>

      <AlarmsClient data={alarmsInsights} />
    </div>
  );
}
