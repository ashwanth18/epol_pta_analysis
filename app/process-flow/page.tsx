import { Callout, Card, CardBody, CardHeader, PageHeader, Pill, Stat } from "@/components/ui";
import { processFlow } from "@/lib/data";
import { parseTopIngredients } from "./buildFlow";
import { ProcessFlowClient } from "./ProcessFlowClient";

function fmtT(n: number) {
  return n.toLocaleString("en-GB", { maximumFractionDigits: 1 });
}

export default function ProcessFlowPage({
  searchParams,
}: {
  searchParams: { top?: string };
}) {
  const d = processFlow;
  const topIngredients = parseTopIngredients(searchParams.top, d);
  const range = d.window_from && d.window_to ? `${d.window_from} → ${d.window_to}` : "production window";

  return (
    <div>
      <PageHeader
        title="Process Flow"
        subtitle={`Material mass through the mill — from ingredient weighment to finished product. ${fmtT(d.total_t)} t across ${d.weighments.toLocaleString("en-GB")} weighments · ${range}.`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat value={`${fmtT(d.total_t)} t`} label="Mass through the mill" tone="info" />
        <Stat value={d.weighments.toLocaleString("en-GB")} label="Weighments" />
        <Stat value={String(d.links.length)} label="Material paths" />
        <Stat value={String(d.nodes.length)} label="Flow nodes" tone="green" />
      </div>

      <ProcessFlowClient data={d} topIngredients={topIngredients} />

      <Card className="mt-4">
        <CardHeader right={<Pill tone="info">BWEIGHS → BSTARTS</Pill>}>How to read this</CardHeader>
        <CardBody className="space-y-3">
          <Callout title="What the four stages mean" tone="info">
            <ul className="list-disc pl-4 space-y-1 mt-1 text-sm">
              <li><strong>Ingredient</strong> — raw material weighed (`BWEIGHS.MAT_CODE`).</li>
              <li><strong>Weigher</strong> — physical scale that dispensed it (`WHR_NAME`): bulk AW1–AW3, additive MXADDS/AW2ADDS, liquids MMLIQ.</li>
              <li><strong>Press route</strong> — production line (`BSTARTS.ROUTE`), e.g. PP2, MB, PB4.</li>
              <li><strong>Product</strong> — finished formula/SKU (`BSTARTS.FRM_CODE`).</li>
            </ul>
          </Callout>
          <div className="text-sm text-ink-600 dark:text-ink-300 space-y-1">
            {d.notes.map((n, i) => (
              <p key={i}>• {n}</p>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
