import { Callout, Card, CardBody, CardHeader, PageHeader, Pill, Stat } from "@/components/ui";
import { pdm } from "@/lib/data";
import { fmtGbp, fmtNumber } from "@/lib/format";
import { PdmClient } from "./Client";

export default function PdmPage() {
  return (
    <div>
      <PageHeader
        title="Predictive Maintenance"
        subtitle="Weigher drift, manual-intervention hot-spots, alarm patterns, and material stockout forecasts — synthesised from logs across the plant."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat value={fmtNumber(pdm.totals.manual_events)} label="Manual interventions" tone="amber" />
        <Stat value={fmtNumber(pdm.totals.alarm_events)} label="Alarm events" tone="red" />
        <Stat value={pdm.totals.materials_tracked.toString()} label="Materials tracked" />
        <Stat value={pdm.totals.critical.toString()} label="Critical stock (<7d)" tone="red" />
        <Stat value={pdm.totals.overstocked.toString()} label="Overstocked (>150d)" tone="amber" />
      </div>

      <Callout title="Action items derived from this data" tone="amber">
        Press-line stability (PL1 PRS HOLD ~20/day) is the leading wear indicator — schedule die/roller inspection before unplanned downtime hits.
        Five materials carry &gt;150 days cover — release that working capital. Additive weighers drift means recalibration is overdue.
      </Callout>

      <PdmClient data={pdm} />
    </div>
  );
}
