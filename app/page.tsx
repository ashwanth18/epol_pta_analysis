import Link from "next/link";
import { Activity, BellRing, BookOpen, Database, GaugeCircle, GitFork, ShieldCheck, Wrench, ArrowRight } from "lucide-react";
import { alarmsInsights, commercial, throughput, gap, inventory, pdm, certificates } from "@/lib/data";
import { Card, CardBody, CardHeader, PageHeader, Pill, Stat } from "@/components/ui";
import { fmtGbp, fmtNumber } from "@/lib/format";

const dashboards = [
  {
    href: "/explorer",
    title: "Data Explorer",
    desc: "Searchable catalog of the epol PTA DBF tables — schema, descriptions, sources, and shared-field relationships.",
    icon: Database,
    metric: `${inventory.total} tables`,
  },
  {
    href: "/knowledge-graph",
    title: "Knowledge Graph",
    desc: "How DBF tables feed business concepts feed commercial products — visualized as a directed value chain.",
    icon: GitFork,
    metric: `${inventory.total_records.toLocaleString()} records`,
  },
  {
    href: "/gap-analysis",
    title: "Gap Analysis",
    desc: "Consultant KPI matrix auto-scored from data. Red/Amber/Green with cited DBF evidence.",
    icon: ShieldCheck,
    metric: fmtGbp(gap.summary.total_gap_gbp) + " quantified",
  },
  {
    href: "/commercial",
    title: "Commercial Insights",
    desc: "Production, throughput, weighers, SKUs, customers and the most pressing operational alerts.",
    icon: Activity,
    metric: `${commercial.production.tonnes.toLocaleString()} t · ${commercial.production.batches.toLocaleString()} batches`,
  },
  {
    href: "/throughput",
    title: "Throughput & Cycle Time",
    desc: "Batch cycle time (release → completion), daily output, throughput rate by route & SKU, and slow-cycle outliers.",
    icon: GaugeCircle,
    metric: `${throughput.summary.duration_min_mean} min · ${throughput.summary.batches_per_day_mean} batches/day`,
  },
  {
    href: "/alarms",
    title: "Alarms & Conformance",
    desc: "Alarm themes, hourly profile, carryover/changeover discipline (CCLOGS), and batch conformance from BWEIGHS.",
    icon: BellRing,
    metric: `${alarmsInsights.totals.alarm_events_operational.toLocaleString()} operational alarms`,
  },
  {
    href: "/pdm",
    title: "Predictive Maintenance",
    desc: "Weigher drift, manual interventions, alarm hot-spots, and material stockout forecasts.",
    icon: Wrench,
    metric: `${pdm.totals.manual_events.toLocaleString()} manual events tracked`,
  },
  {
    href: "/certificates",
    title: "Batch Certificates",
    desc: "Generate per-batch certificates with full ingredient, weight and carryover traceability.",
    icon: BookOpen,
    metric: `${certificates.batches.length.toLocaleString()} batches indexed`,
  },
];

export default function HomePage() {
  return (
    <div>
      <PageHeader
        title="epol PTA Analytics"
        subtitle={`A complete feed-mill intelligence layer over the epol PTA DBF data. Eight dashboards, one source of truth · ${commercial.production.date_from} → ${commercial.production.date_to}.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat value={fmtNumber(inventory.total)} label="DBF tables catalogued" />
        <Stat value={fmtNumber(inventory.total_records)} label="Total records" tone="info" />
        <Stat value={fmtNumber(commercial.production.batches)} label="Batches in window" />
        <Stat value={fmtNumber(commercial.production.tonnes) + " t"} label={`Produced (${commercial.production.days_observed} days)`} />
        <Stat value={gap.summary.red.toString()} label="Red KPIs (auto-scored)" tone="red" />
        <Stat value={gap.summary.amber.toString()} label="Amber KPIs" tone="amber" />
        <Stat value={gap.summary.green.toString()} label="Green KPIs" tone="green" />
        <Stat value={fmtGbp(gap.summary.total_gap_gbp)} label="Annual gap quantified" tone="info" />
      </div>

      <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wide mb-3">Dashboards</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {dashboards.map((d) => {
          const Icon = d.icon;
          return (
            <Link key={d.href} href={d.href} className="group">
              <Card className="hover:border-accent/50 transition-colors h-full">
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-md bg-accent-50 dark:bg-accent/15 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-accent" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-ink-400 group-hover:text-accent transition-colors" />
                  </div>
                  <div className="font-semibold mb-1">{d.title}</div>
                  <div className="text-sm text-ink-500 mb-3 leading-relaxed">{d.desc}</div>
                  <Pill tone="info">{d.metric}</Pill>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>

      <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wide mb-3">Top operational alerts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {commercial.alerts.map((a) => (
          <Card key={a.title} className="border-l-4" >
            <CardHeader right={<Pill tone={a.level === "red" ? "red" : a.level === "amber" ? "amber" : "green"}>{a.level.toUpperCase()}</Pill>}>
              {a.title}
            </CardHeader>
            <CardBody>
              <div className="font-mono text-sm mb-1">{a.value}</div>
              <div className="text-sm text-ink-500 mb-2">{a.note}</div>
              <div className="text-xs text-ink-500">Annual impact: <span className="font-semibold text-ink-700 dark:text-ink-300">{fmtGbp(a.impact_gbp)}</span></div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>How this app works</CardHeader>
        <CardBody className="text-sm text-ink-600 dark:text-ink-300 space-y-2 leading-relaxed">
          <p>
            Daily DBF snapshots live in <code className="text-xs px-1.5 py-0.5 bg-ink-100 dark:bg-ink-800 rounded">epolPTA/2026/MM/DD/</code>. A Python pipeline
            (<code className="text-xs px-1.5 py-0.5 bg-ink-100 dark:bg-ink-800 rounded">scripts/export.py</code>) merges and de-duplicates every daily
            snapshot and writes pre-computed JSON into <code className="text-xs px-1.5 py-0.5 bg-ink-100 dark:bg-ink-800 rounded">data/</code>. Next.js pages
            import that JSON at build time — no DBFs are shipped to the browser.
          </p>
          <p>
            Refresh: add new daily folders under <code className="text-xs px-1.5 py-0.5 bg-ink-100 dark:bg-ink-800 rounded">epolPTA/2026/</code>, run
            <code className="text-xs px-1.5 py-0.5 bg-ink-100 dark:bg-ink-800 rounded ml-1">npm run export-data</code>, and reload.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
