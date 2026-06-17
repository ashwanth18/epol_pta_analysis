import { Callout, Card, CardBody, CardHeader, PageHeader, Pill, Stat } from "@/components/ui";
import { gap } from "@/lib/data";
import { fmtGbp, monthLabel, ragClass } from "@/lib/format";
import { GapClient } from "./Client";

function scoreRag(sc: number): "RED" | "AMBER" | "GREEN" {
  return sc >= 4 ? "GREEN" : sc >= 3 ? "AMBER" : "RED";
}

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

      <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wide mt-6 mb-3">Month on month</h2>
      <Card>
        <CardHeader right={<Pill tone="info">{gap.monthly.length} months · 1–5 scale</Pill>}>Score trend by control</CardHeader>
        <CardBody className="p-0">
          <p className="text-xs text-ink-500 px-4 pt-3">
            The controls whose evidence is bucketable by month, re-scored each month with the same thresholds as the matrix above. Each cell is the 1–5 score, RAG-coloured. The latest month may be partial.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm mt-2">
              <thead className="bg-ink-50 dark:bg-ink-800 border-y border-ink-200 dark:border-ink-700">
                <tr className="text-left">
                  <th className="px-4 py-2 font-medium">Control</th>
                  {gap.monthly.map((m) => (
                    <th key={m.month} className="px-3 py-2 font-medium text-center whitespace-nowrap">{monthLabel(m.month)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gap.monthly_kpis.map((kpi) => (
                  <tr key={kpi} className="border-b border-ink-100 dark:border-ink-800">
                    <td className="px-4 py-2 whitespace-nowrap">{kpi}</td>
                    {gap.monthly.map((m) => {
                      const sc = m.scores[kpi];
                      return (
                        <td key={m.month} className="px-3 py-2 text-center">
                          <span className={["inline-flex items-center justify-center w-7 h-7 rounded-md border tabular-nums font-semibold", ragClass(scoreRag(sc))].join(" ")}>
                            {sc}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t-2 border-ink-200 dark:border-ink-700 font-semibold">
                  <td className="px-4 py-2">Overall avg</td>
                  {gap.monthly.map((m) => (
                    <td key={m.month} className="px-3 py-2 text-center">
                      <span className={["inline-flex items-center justify-center px-2 h-7 rounded-md border tabular-nums", ragClass(m.rag)].join(" ")}>
                        {m.avg.toFixed(1)}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wide mt-6 mb-3">All KPIs</h2>
      <GapClient kpis={gap.kpis} />
    </div>
  );
}
