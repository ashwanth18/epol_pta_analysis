import { Card, CardBody, CardHeader, PageHeader, Pill, Stat } from "@/components/ui";
import { knowledgeGraph } from "@/lib/data";
import { fmtGbp } from "@/lib/format";
import { KgClient } from "./Client";

export default function KnowledgeGraphPage() {
  const totalValue = knowledgeGraph.products.reduce((sum, p) => sum + (p.value || 0), 0);
  return (
    <div>
      <PageHeader
        title="Knowledge Graph"
        subtitle="How epol PTA DBF tables feed business concepts that turn into commercial products. Read left-to-right: data → concept → £."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat value={knowledgeGraph.tables.length.toString()} label="DBF tables" />
        <Stat value={knowledgeGraph.concepts.length.toString()} label="Domain concepts" />
        <Stat value={knowledgeGraph.products.length.toString()} label="Commercial products" />
        <Stat value={(knowledgeGraph.edges_table_concept.length + knowledgeGraph.edges_concept_product.length).toString()} label="Edges" />
        <Stat value={fmtGbp(totalValue)} label="Total value mapped" tone="info" />
      </div>

      <KgClient data={knowledgeGraph} />

      <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wide mt-8 mb-3">Highest-leverage tables</h2>
      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Table</th>
                <th className="px-4 py-2 font-medium">Feeds</th>
                <th className="px-4 py-2 font-medium">Critical for</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["BWEIGHS", "7 of 8 products", "Certificates, recall, gap analysis, process flow"],
                ["BSTARTS", "6 of 8 products", "Every batch-level analysis"],
                ["BEND2S", "5 of 8 products", "Throughput, certificates, batch weight"],
                ["CCLOGS", "4 of 8 products", "Carryover audit, recall, gap analysis, certificates"],
                ["MSTLOG", "3 of 8 products", "Working capital, stock forecast, gap analysis"],
                ["MANLOG", "3 of 8 products", "PDM, gap analysis, KPI dashboard"],
                ["ALMLOGS", "3 of 8 products", "PDM, alarms, gap analysis"],
                ["INTLOGS", "2 of 8 products", "Recall, intake traceability"],
              ].map(([tab, feeds, crit]) => (
                <tr key={tab} className="border-b border-ink-100 dark:border-ink-800">
                  <td className="px-4 py-2 font-mono text-xs font-semibold">{tab}</td>
                  <td className="px-4 py-2"><Pill tone="info">{feeds}</Pill></td>
                  <td className="px-4 py-2 text-ink-600 dark:text-ink-300">{crit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
