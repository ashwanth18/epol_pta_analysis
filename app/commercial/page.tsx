import { Card, CardBody, CardHeader, PageHeader, Pill, Stat } from "@/components/ui";
import { commercial } from "@/lib/data";
import { fmtGbp, fmtNumber, fmtPct } from "@/lib/format";
import { CommercialClient } from "./Client";

export default function CommercialPage() {
  const p = commercial.production;
  const range = p.date_from && p.date_to ? `${p.date_from} → ${p.date_to}` : `${p.days_observed} days`;
  return (
    <div>
      <PageHeader
        title="Commercial Insights"
        subtitle={`${p.batches.toLocaleString()} batches · ${fmtNumber(p.tonnes)} t · ${range}. Data coverage, batching accuracy, production, throughput, SKUs and customers.`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat value={fmtNumber(p.tonnes) + " t"} label="Tonnes produced" />
        <Stat value={p.batches.toLocaleString()} label="Batches" />
        <Stat value={`${p.mean_t_day} ± ${p.std_t_day} t`} label="Mean daily tonnage" hint="± 1 stdev" />
        <Stat value={p.unique_skus.toString()} label="Unique SKUs run" />
        <Stat value={`${commercial.throughput.t_per_h_mean} t/h`} label="Mean throughput" tone="info" hint={`${fmtPct(commercial.throughput.pct_timed)} batches timed`} />
        <Stat value={`${commercial.throughput.duration_min_mean} min`} label="Mean cycle time" />
        <Stat value={fmtPct(p.unassigned_pct)} label="Batches w/o customer" tone={p.unassigned_pct > 15 ? "red" : "green"} />
      </div>

      <CommercialClient data={commercial} />

      <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wide mt-6 mb-3">Operational alerts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {commercial.alerts.map((a) => (
          <Card key={a.title}>
            <CardHeader right={<Pill tone={a.level === "red" ? "red" : a.level === "amber" ? "amber" : "green"}>{a.level.toUpperCase()}</Pill>}>
              {a.title}
            </CardHeader>
            <CardBody>
              <div className="font-mono text-sm mb-1">{a.value}</div>
              <div className="text-sm text-ink-500 mb-2">{a.note}</div>
              <div className="text-xs">Annual impact: <span className="font-semibold">{fmtGbp(a.impact_gbp)}</span></div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
