import { Callout, Card, CardBody, CardHeader, PageHeader, Pill, Stat } from "@/components/ui";
import { gap } from "@/lib/data";
import { fmtGbp, ragClass } from "@/lib/format";
import { GapClient } from "./Client";

export default function GapAnalysisPage() {
  return (
    <div>
      <PageHeader
        title="Gap Analysis"
        subtitle={`Consultant matrix auto-scored against the epol PTA DBFs. ${gap.summary.scored_from_data} KPIs scored from data (of ${gap.summary.matrix_total} in full matrix). Every red has cited DBF evidence.`}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat value={gap.summary.total.toString()} label="KPIs scored" />
        <Stat value={gap.summary.green.toString()} label="Green (≥4.0)" tone="green" />
        <Stat value={gap.summary.amber.toString()} label="Amber (3.0–3.9)" tone="amber" />
        <Stat value={gap.summary.red.toString()} label="Red (<3.0)" tone="red" />
        <Stat value={fmtGbp(gap.summary.total_gap_gbp)} label="Annual gap quantified" tone="info" />
      </div>

      <Callout title="What this dashboard delivers" tone="info">
        Each KPI maps to a specific epol PTA DBF table — every score is defensible at audit. Annual £ gaps are bottom-up sizings based on the
        magnitude of the underlying patterns (not audited financial figures). KPIs without auto-scoring evidence remain for consultant judgement.
      </Callout>

      <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wide mt-6 mb-3">Section scorecard</h2>
      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Section</th>
                <th className="px-4 py-2 font-medium text-right">Avg</th>
                <th className="px-4 py-2 font-medium text-right">Green</th>
                <th className="px-4 py-2 font-medium text-right">Amber</th>
                <th className="px-4 py-2 font-medium text-right">Red</th>
                <th className="px-4 py-2 font-medium text-right">KPIs</th>
                <th className="px-4 py-2 font-medium text-right">Annual £</th>
              </tr>
            </thead>
            <tbody>
              {gap.sections.map((s) => {
                const tone = s.avg == null ? "" : s.avg >= 4 ? "text-rag-green" : s.avg >= 3 ? "text-rag-amber" : "text-rag-red";
                return (
                  <tr key={s.section} className="border-b border-ink-100 dark:border-ink-800">
                    <td className="px-4 py-2">{s.section}</td>
                    <td className={["px-4 py-2 text-right tabular-nums font-semibold", tone].join(" ")}>{s.avg?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.green}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.amber}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.red}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.total}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.gap_gbp ? fmtGbp(s.gap_gbp) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wide mt-6 mb-3">All KPIs</h2>
      <GapClient kpis={gap.kpis} />
    </div>
  );
}
